import { API_URL, ensureSession, isConfigured, supabase } from './supabase';
import { mockProducts, mockPromos } from '../data/mock';
import { Mode, Product, Promo } from '../types';

const PAGE = 20;

export async function fetchProducts(page: number): Promise<{ items: Product[]; hasMore: boolean }> {
  if (!isConfigured) return { items: mockProducts(page), hasMore: page < 50 };
  const response = await fetch(`${API_URL}/products?page=${page}&size=${PAGE}`);
  if (!response.ok) throw new Error('Could not load items');
  return response.json();
}

export async function fetchPromos(): Promise<Promo[]> {
  if (!isConfigured) return mockPromos;
  const response = await fetch(`${API_URL}/promos`);
  if (!response.ok) return mockPromos;
  return response.json();
}

type AuthenticatedOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

async function authenticatedRequest<T>(path: string, options: AuthenticatedOptions = {}): Promise<T> {
  if (!isConfigured) throw new Error('Connect the app to its backend before using this feature.');
  const session = await ensureSession();
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const result = await response.json() as T | { error?: string };
  if (!response.ok) {
    throw new Error(
      typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
        ? result.error
        : 'The request could not be completed.',
    );
  }
  return result as T;
}

export type CheckoutInput = {
  mode: Mode;
  items: { product_id: string; qty: number }[];
  lat: number;
  lng: number;
  customer: { name: string; email: string; phone: string };
};

export type OrderItem = {
  qty: number;
  unit_price: number;
  products: { name: string; unit: string; image_url: string | null } | null;
};

export type CustomerOrder = {
  id: string;
  mode: Mode;
  status: import('../theme').OrderStatus;
  subtotal: number;
  delivery_fee: number;
  created_at: string;
  order_items: OrderItem[];
};

export function initializePayment(input: CheckoutInput) {
  return authenticatedRequest<{
    payment_url: string;
    tx_ref: string;
    amount: number;
    currency: string;
    delivery_fee: number;
    distance_km: number;
    subtotal: number;
    items: { product_id: string; qty: number; unit_price: number }[];
  }>('/payments/initialize', { method: 'POST', body: input });
}

export function confirmPayment(txRef: string, transactionId: string) {
  return authenticatedRequest<{ order_id: string }>('/payments/confirm', {
    method: 'POST',
    body: { tx_ref: txRef, transaction_id: transactionId },
  });
}

export function fetchOrderHistory() {
  return authenticatedRequest<CustomerOrder[]>('/orders');
}

export function submitSupplierApplication(input: {
  farmName: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  products: string;
}) {
  return authenticatedRequest<{ id: string; status: string; created_at: string }>('/supplier-applications', {
    method: 'POST',
    body: input,
  });
}

export { supabase };
