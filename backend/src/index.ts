import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PORT = '3000',
  STORE_LAT = '-6.1630', // Dodoma pickup hub
  STORE_LNG = '35.7516',
  FLUTTERWAVE_SECRET_KEY,
  PUBLIC_API_URL,
  PAYMENT_APP_CALLBACK_URL = 'saplaya://payment-callback',
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

// Service-role client: bypasses RLS. NEVER ship this key inside the mobile app.
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Auth helpers ----------
type AuthedRequest = Request & { userId?: string; supplierId?: string };

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });
  req.userId = data.user.id;
  next();
}

async function requireSupplier(req: AuthedRequest, res: Response, next: NextFunction) {
  await requireUser(req, res, async () => {
    const { data } = await db.from('suppliers').select('id').eq('admin_user_id', req.userId!).maybeSingle();
    if (!data) return res.status(403).json({ error: 'Not a supplier admin' });
    req.supplierId = data.id;
    next();
  });
}

// ---------- Delivery tiers (single source of truth; the app mirrors this) ----------
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function deliveryFor(km: number) {
  if (km <= 5) return 0;
  if (km <= 10) return 2000;
  return 4000;
}

// ---------- Customer routes (suppliers are never exposed) ----------
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/products', async (req, res) => {
  const page = Math.max(0, Number(req.query.page ?? 0));
  const size = Math.min(40, Number(req.query.size ?? 20));
  const { data, error } = await db
    .from('storefront_products')
    .select('*')
    .order('name')
    .range(page * size, page * size + size - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data, hasMore: (data?.length ?? 0) === size });
});

app.get('/promos', async (_req, res) => {
  const { data, error } = await db.from('promos').select('*').eq('active', true).order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const checkoutSchema = z.object({
  mode: z.enum(['retail', 'wholesale']),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    qty: z.number().positive().max(10000),
  })).min(1).max(100).superRefine((items, ctx) => {
    const ids = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (ids.has(item.product_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'product_id'],
          message: 'Each product can only appear once.',
        });
      }
      ids.add(item.product_id);
    }
  }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(5).max(32),
  }),
});

const applicationSchema = z.object({
  farmName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(5).max(32),
  location: z.string().trim().min(2).max(240),
  products: z.string().trim().min(2).max(1000),
});

function isFlutterwaveConfigured() {
  return Boolean(FLUTTERWAVE_SECRET_KEY && PUBLIC_API_URL);
}

async function flutterwaveRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!FLUTTERWAVE_SECRET_KEY) throw new Error('Flutterwave checkout is not configured.');

  const response = await fetch(`https://api.flutterwave.com/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const result = await response.json() as {
    status?: string;
    message?: string;
    data?: T;
  };
  if (!response.ok || result.status !== 'success' || result.data === undefined) {
    throw new Error(result.message ?? 'Flutterwave could not process the request.');
  }
  return result.data;
}

function paymentCallbackUrl(transactionRef: string, transactionId: string, status: string) {
  const callback = new URL(PAYMENT_APP_CALLBACK_URL);
  callback.searchParams.set('tx_ref', transactionRef);
  callback.searchParams.set('transaction_id', transactionId);
  callback.searchParams.set('status', status);
  return callback.toString();
}

app.get('/orders', requireUser, async (req: AuthedRequest, res) => {
  const { data, error } = await db
    .from('orders')
    .select('id, mode, status, subtotal, delivery_fee, created_at, order_items(qty, unit_price, products(name, unit, image_url))')
    .eq('customer_id', req.userId!)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: 'Could not load order history.' });
  res.json(data);
});

app.post('/payments/initialize', requireUser, async (req: AuthedRequest, res) => {
  if (!isFlutterwaveConfigured()) {
    return res.status(503).json({ error: 'Flutterwave checkout is not configured on the server.' });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { mode, items, lat, lng, customer } = parsed.data;

  const { data: products, error: productError } = await db
    .from('products')
    .select('id, name, stock, active, retail_price, wholesale_price, wholesale_min_qty')
    .in('id', items.map((item) => item.product_id));
  if (productError) return res.status(500).json({ error: 'Could not validate the basket.' });
  if (!products || products.length !== items.length) {
    return res.status(400).json({ error: 'One or more items are no longer available.' });
  }

  let subtotal = 0;
  const pricedItems: { product_id: string; qty: number; unit_price: number }[] = [];
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.product_id);
    if (!product || !product.active) {
      return res.status(400).json({ error: 'One or more items are no longer available.' });
    }
    if (Number(product.stock) < item.qty) {
      return res.status(400).json({ error: `${product.name} no longer has enough stock.` });
    }
    if (mode === 'wholesale' && item.qty < Number(product.wholesale_min_qty)) {
      return res.status(400).json({ error: `Wholesale minimum for ${product.name} is ${product.wholesale_min_qty}.` });
    }
    const price = Math.round(Number(mode === 'wholesale' ? product.wholesale_price : product.retail_price));
    pricedItems.push({ product_id: item.product_id, qty: item.qty, unit_price: price });
    subtotal += Math.round(price * item.qty);
  }

  const distance = haversineKm(Number(STORE_LAT), Number(STORE_LNG), lat, lng);
  const fee = deliveryFor(distance);
  const amount = subtotal + fee;
  const transactionRef = `saplaya-${randomUUID()}`;
  const { error: paymentError } = await db.from('checkout_payments').insert({
    transaction_ref: transactionRef,
    customer_id: req.userId,
    mode,
    items: pricedItems,
    delivery_fee: fee,
    distance_km: Number(distance.toFixed(2)),
    dest_lat: lat,
    dest_lng: lng,
    customer_email: customer.email,
    customer_name: customer.name,
    customer_phone: customer.phone,
    amount,
    currency: 'TZS',
  });
  if (paymentError) {
    console.error('Could not create checkout payment record:', paymentError.message);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }

  try {
    const payment = await flutterwaveRequest<{ link: string }>('payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: transactionRef,
        amount,
        currency: 'TZS',
        redirect_url: `${PUBLIC_API_URL!.replace(/\/+$/, '')}/payments/callback`,
        customer: {
          email: customer.email,
          phonenumber: customer.phone,
          name: customer.name,
        },
        customizations: {
          title: 'Saplaya',
          description: 'Fresh groceries delivery',
        },
      }),
    });
    if (!payment.link) throw new Error('Flutterwave did not return a checkout link.');
    return res.status(201).json({
      payment_url: payment.link,
      tx_ref: transactionRef,
      amount,
      currency: 'TZS',
      delivery_fee: fee,
      distance_km: Number(distance.toFixed(2)),
      subtotal,
      items: pricedItems,
    });
  } catch (error) {
    await db.from('checkout_payments').update({ status: 'failed' }).eq('transaction_ref', transactionRef);
    console.error('Flutterwave payment initialization failed:', error);
    return res.status(502).json({ error: 'Could not open secure payment checkout. Please try again.' });
  }
});

app.get('/payments/callback', (req, res) => {
  const transactionRef = String(req.query.tx_ref ?? '');
  const transactionId = String(req.query.transaction_id ?? '');
  const status = String(req.query.status ?? 'failed');
  if (!/^saplaya-[0-9a-f-]{36}$/i.test(transactionRef) || !/^\d+$/.test(transactionId)) {
    return res.redirect(302, paymentCallbackUrl('', '', 'failed'));
  }
  res.redirect(302, paymentCallbackUrl(transactionRef, transactionId, status));
});

const confirmPaymentSchema = z.object({
  tx_ref: z.string().regex(/^saplaya-[0-9a-f-]{36}$/i),
  transaction_id: z.string().regex(/^\d+$/),
});

app.post('/payments/confirm', requireUser, async (req: AuthedRequest, res) => {
  if (!FLUTTERWAVE_SECRET_KEY) {
    return res.status(503).json({ error: 'Flutterwave checkout is not configured on the server.' });
  }
  const parsed = confirmPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { tx_ref: transactionRef, transaction_id: transactionId } = parsed.data;
  const { data: payment, error: paymentError } = await db
    .from('checkout_payments')
    .select('amount, currency, status, order_id, gateway_transaction_id')
    .eq('transaction_ref', transactionRef)
    .eq('customer_id', req.userId!)
    .maybeSingle();
  if (paymentError) return res.status(500).json({ error: 'Could not verify this checkout.' });
  if (!payment) return res.status(404).json({ error: 'Payment reference was not found for this account.' });

  try {
    const verified = await flutterwaveRequest<{
      id: number;
      tx_ref: string;
      status: string;
      amount: number;
      currency: string;
    }>(`transactions/${encodeURIComponent(transactionId)}/verify`);
    if (
      String(verified.id) !== transactionId
      || verified.tx_ref !== transactionRef
      || verified.status !== 'successful'
      || Math.round(Number(verified.amount)) !== Number(payment.amount)
      || verified.currency !== payment.currency
    ) {
      if (verified.tx_ref === transactionRef && ['failed', 'cancelled'].includes(verified.status) && payment.status === 'pending') {
        await db.from('checkout_payments').update({ status: 'failed' }).eq('transaction_ref', transactionRef);
      }
      return res.status(402).json({ error: 'Payment has not been verified. You have not been charged for an order.' });
    }

    const { data: orderId, error } = await db.rpc('complete_flutterwave_payment', {
      p_transaction_ref: transactionRef,
      p_gateway_transaction_id: transactionId,
    });
    if (error) {
      console.error('Verified payment could not be converted to an order:', error.message);
      return res.status(409).json({ error: 'Payment was received, but the order could not be completed. Please contact support with your payment reference.' });
    }
    return res.json({ order_id: orderId });
  } catch (error) {
    console.error('Flutterwave transaction verification failed:', error);
    return res.status(502).json({ error: 'Could not verify the payment right now. Please try again.' });
  }
});

app.post('/supplier-applications', requireUser, async (req: AuthedRequest, res) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { data, error } = await db.from('supplier_applications').insert({
    customer_id: req.userId,
    farm_name: parsed.data.farmName,
    contact_name: parsed.data.contactName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    location: parsed.data.location,
    products: parsed.data.products,
  }).select('id, status, created_at').single();
  if (error) {
    console.error('Could not save supplier application:', error.message);
    return res.status(500).json({ error: 'Could not submit your application. Please try again.' });
  }
  return res.status(201).json(data);
});

// ---------- Supplier admin routes ----------
app.get('/admin/orders', requireSupplier, async (req: AuthedRequest, res) => {
  const { data, error } = await db
    .from('supplier_orders')
    .select('id, order_id, status, updated_at, order_items(qty, unit_price, products(name, unit))')
    .eq('supplier_id', req.supplierId!)
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const statusSchema = z.object({ status: z.enum(['pending', 'packing', 'en_route', 'delivered', 'cancelled']) });

// This is what makes the customer's tracking screen glow in real time:
// updating supplier_orders fires the trigger -> orders.status -> Supabase Realtime.
app.patch('/admin/supplier-orders/:id/status', requireSupplier, async (req: AuthedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { data, error } = await db
    .from('supplier_orders')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('supplier_id', req.supplierId!)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.get('/admin/inventory-movements', requireSupplier, async (req: AuthedRequest, res) => {
  const { data, error } = await db
    .from('inventory_movements')
    .select('id, kind, qty_change, stock_after, created_at, order_id, products(name, unit)')
    .eq('supplier_id', req.supplierId!)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const restockSchema = z.object({ product_id: z.string().uuid(), qty: z.number().positive() });

app.post('/admin/restock', requireSupplier, async (req: AuthedRequest, res) => {
  const parsed = restockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { data: p } = await db
    .from('products')
    .select('stock')
    .eq('id', parsed.data.product_id)
    .eq('supplier_id', req.supplierId!)
    .maybeSingle();
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const stockAfter = Number(p.stock) + parsed.data.qty;
  await db.from('products').update({ stock: stockAfter, harvested_at: new Date().toISOString() })
    .eq('id', parsed.data.product_id);
  await db.from('inventory_movements').insert({
    supplier_id: req.supplierId, product_id: parsed.data.product_id,
    kind: 'restock', qty_change: parsed.data.qty, stock_after: stockAfter,
  });
  res.json({ stock: stockAfter });
});

app.listen(Number(PORT), () => console.log(`Saplaya API on :${PORT}`));
