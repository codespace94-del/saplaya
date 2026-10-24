import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { MotiView } from 'moti';
import ScreenHeader from '../components/ScreenHeader';
import { confirmPayment, initializePayment } from '../lib/api';
import { Place, useDeliveryActions, useDeliveryPlace } from '../lib/location';
import { STORE, deliveryTier, distanceKm } from '../lib/delivery';
import { useAccount } from '../store/AccountContext';
import { useStore } from '../store/StoreContext';
import { colors, formatTZS, radius, shadow } from '../theme';

WebBrowser.maybeCompleteAuthSession();

type PaymentSession = Awaited<ReturnType<typeof initializePayment>>;

export default function CheckoutScreen({ navigation }: any) {
  const { lines, mode, subtotal, priceOf, clear, setLastOrderId } = useStore();
  const { profile, user, addresses, selectAddress } = useAccount();
  const place = useDeliveryPlace();
  const { setPlace } = useDeliveryActions();
  const [name, setName] = useState(profile.fullName);
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(profile.phone);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses.find((address) => address.isDefault)?.id ?? null);
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{ txRef: string; orderTrackingId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const km = distanceKm(STORE.lat, STORE.lng, place.lat, place.lng);
  const tier = deliveryTier(km);
  const estimate = subtotal + tier.fee;
  const basketKey = useMemo(
    () => JSON.stringify({ mode, lines: lines.map(({ product, qty }) => [product.id, qty]), lat: place.lat, lng: place.lng, name, email, phone }),
    [mode, lines, place.lat, place.lng, name, email, phone],
  );

  useEffect(() => {
    if (pendingVerification) return;
    setPayment(null);
  }, [basketKey, pendingVerification]);

  useEffect(() => {
    if (!name && profile.fullName) setName(profile.fullName);
    if (!email && user?.email) setEmail(user.email);
    if (!phone && profile.phone) setPhone(profile.phone);
  }, [profile.fullName, profile.phone, user?.email, name, email, phone]);

  const chooseAddress = async (id: string) => {
    const saved = addresses.find((address) => address.id === id);
    if (!saved) return;
    try {
      await selectAddress(id);
      await setPlace({ lat: saved.lat, lng: saved.lng, label: saved.address, approximate: false });
      setSelectedAddressId(id);
    } catch (error) {
      Alert.alert('Could not select address', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const validate = () => {
    if (!lines.length) {
      Alert.alert('Your basket is empty', 'Add an item before starting checkout.');
      return false;
    }
    const unavailable = lines.find((line) => line.qty > line.product.stock);
    if (unavailable) {
      Alert.alert('Stock changed', `${unavailable.product.name} no longer has enough stock. Update your basket before checkout.`);
      return false;
    }
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Complete your contact details', 'Add your name, email and phone number for the delivery and payment receipt.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Check your email address', 'Enter a valid email address for the payment receipt.');
      return false;
    }
    if (phone.trim().length < 5) {
      Alert.alert('Check your phone number', 'Enter a phone number where the delivery team can reach you.');
      return false;
    }
    if (mode === 'wholesale') {
      const belowMinimum = lines.find((line) => line.qty < line.product.wholesale_min_qty);
      if (belowMinimum) {
        Alert.alert('Wholesale minimum', `${belowMinimum.product.name} needs at least ${belowMinimum.product.wholesale_min_qty} ${belowMinimum.product.unit}.`);
        return false;
      }
    }
    return true;
  };

  const completeOrder = async (txRef: string, orderTrackingId: string) => {
    setPendingVerification({ txRef, orderTrackingId });
    try {
      const result = await confirmPayment(txRef, orderTrackingId);
      const order = {
        id: result.order_id,
        mode,
        status: 'pending' as const,
        subtotal: payment?.subtotal ?? subtotal,
        delivery_fee: payment?.delivery_fee ?? tier.fee,
        created_at: new Date().toISOString(),
        order_items: lines.map((line) => ({
          qty: line.qty,
          unit_price: payment?.items.find((item) => item.product_id === line.product.id)?.unit_price ?? priceOf(line.product),
          products: { name: line.product.name, unit: line.product.unit, image_url: line.product.image_url },
        })),
      };
      clear();
      setLastOrderId(result.order_id);
      setPayment(null);
      setPendingVerification(null);
      navigation.navigate('Tabs', { screen: 'Tracking', params: { orderId: result.order_id, order } });
    } catch (error) {
      Alert.alert(
        'Payment verification pending',
        `${error instanceof Error ? error.message : 'The payment could not be verified right now.'} Your basket is still here. Retry verification before starting another payment.`,
      );
    }
  };

  const startCheckout = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (!payment) {
        const initialized = await initializePayment({
          mode,
          items: lines.map((line) => ({ product_id: line.product.id, qty: line.qty })),
          lat: place.lat,
          lng: place.lng,
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim() },
        });
        setPayment(initialized);
        return;
      }

      const callbackUrl = Linking.createURL('payment-callback');
      const result = await WebBrowser.openAuthSessionAsync(payment.payment_url, callbackUrl, { preferEphemeralSession: true });
      if (result.type !== 'success' || !result.url) return;
      const callback = Linking.parse(result.url);
      const query = callback.queryParams ?? {};
      const txRef = query.tx_ref;
      const orderTrackingId = query.order_tracking_id;
      if (typeof txRef !== 'string' || typeof orderTrackingId !== 'string') {
        Alert.alert('Payment not completed', 'No order was placed. You can try checkout again when you’re ready.');
        setPayment(null);
        return;
      }
      await completeOrder(txRef, orderTrackingId);
    } catch (error) {
      Alert.alert('Could not start checkout', error instanceof Error ? error.message : 'Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const retryVerification = async () => {
    if (!pendingVerification) return;
    setBusy(true);
    try {
      await completeOrder(pendingVerification.txRef, pendingVerification.orderTrackingId);
    } finally {
      setBusy(false);
    }
  };

  if (!lines.length) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Ionicons name="basket-outline" size={74} color={colors.greenLight} />
          <Text style={styles.heading}>Your basket is empty</Text>
          <Text style={styles.subheading}>Add something fresh before checkout.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}>
            <Text style={styles.primaryText}>Back to shop</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 230 }}>
          <Text style={styles.heading}>Delivery details</Text>
          <Text style={styles.subheading}>Who should we contact about this order?</Text>
          <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Email for payment receipt" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />

          <View style={styles.deliveryCard}>
            <View style={styles.deliveryTop}>
              <View style={styles.pin}><Ionicons name="location" size={20} color={colors.green} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Delivering to</Text>
                <Text style={styles.address}>{place.label}</Text>
                <Text style={styles.helper}>{km.toFixed(1)} km from our hub{place.approximate ? ' · approximate location' : ''}</Text>
              </View>
              <Pressable onPress={() => navigation.navigate('LocationPicker')} accessibilityLabel="Change delivery location">
                <Text style={styles.change}>Change</Text>
              </Pressable>
            </View>
            {addresses.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedAddresses}>
                {addresses.map((address) => (
                  <Pressable
                    key={address.id}
                    style={[styles.addressChip, selectedAddressId === address.id && styles.addressChipSelected]}
                    onPress={() => chooseAddress(address.id)}
                  >
                    <Text style={[styles.addressChipText, selectedAddressId === address.id && styles.addressChipTextSelected]}>{address.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <Text style={styles.heading}>Your order</Text>
          {lines.map((line) => {
            const unitPrice = payment?.items.find((item) => item.product_id === line.product.id)?.unit_price ?? priceOf(line.product);
            return (
              <View key={line.product.id} style={styles.orderLine}>
                <Text style={styles.orderName}>{line.qty} × {line.product.name}</Text>
                <Text style={styles.orderPrice}>{formatTZS(unitPrice * line.qty)}</Text>
              </View>
            );
          })}
          <View style={styles.totalCard}>
            <SummaryRow label="Items" value={formatTZS(payment?.subtotal ?? subtotal)} />
            <SummaryRow label={tier.label} value={payment ? (payment.delivery_fee === 0 ? 'FREE' : formatTZS(payment.delivery_fee)) : (tier.free ? 'FREE' : formatTZS(tier.fee))} />
            <View style={styles.divider} />
            <SummaryRow label="Estimated total" value={formatTZS(payment?.amount ?? estimate)} bold />
            {payment && <Text style={styles.confirmText}>Server-confirmed total · {payment.currency}</Text>}
          </View>

          <View style={styles.secureCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.green} />
            <Text style={styles.secureText}>
              Pay securely through Pesapal. Your order is placed only after the payment is verified.
            </Text>
          </View>

          {pendingVerification ? (
            <Pressable style={styles.primaryButton} onPress={retryVerification} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Retry payment verification</Text>}
            </Pressable>
          ) : (
            <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={startCheckout} disabled={busy}>
              {busy
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.primaryText}>
                  {payment ? `Continue to Pesapal · ${formatTZS(payment.amount)}` : 'Review secure payment'}
                </Text>}
            </Pressable>
          )}
          <Text style={styles.disclaimer}>
            {payment
              ? 'Review the confirmed total above, then continue to the secure payment page.'
              : 'Your final total is checked against live prices and delivery distance before you pay.'}
          </Text>
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={colors.muted} />
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 40 },
  heading: { marginTop: 8, marginBottom: 5, color: colors.ink, fontSize: 22, fontWeight: '900' },
  subheading: { marginBottom: 16, color: colors.muted, fontSize: 14, lineHeight: 20 },
  field: { marginBottom: 13 },
  label: { marginBottom: 6, color: colors.ink, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 51, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, color: colors.ink, fontSize: 15 },
  deliveryCard: { marginVertical: 10, padding: 15, borderRadius: radius.md, backgroundColor: colors.white, ...shadow },
  deliveryTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  pin: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EFF7EC', alignItems: 'center', justifyContent: 'center' },
  address: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  helper: { color: colors.muted, fontSize: 12, marginTop: 4 },
  change: { color: colors.green, fontSize: 14, fontWeight: '900', padding: 8 },
  savedAddresses: { gap: 8, paddingTop: 13 },
  addressChip: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, paddingHorizontal: 13, paddingVertical: 8 },
  addressChipSelected: { backgroundColor: '#E8F5E9', borderColor: colors.green },
  addressChipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  addressChipTextSelected: { color: colors.green },
  orderLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  orderName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  orderPrice: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  totalCard: { marginTop: 14, padding: 16, borderRadius: radius.md, backgroundColor: colors.white },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryLabel: { color: colors.muted, fontSize: 14 },
  summaryValue: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  summaryBold: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  divider: { height: 1, marginVertical: 7, backgroundColor: colors.line },
  confirmText: { marginTop: 8, textAlign: 'right', color: colors.green, fontSize: 12, fontWeight: '800' },
  secureCard: { flexDirection: 'row', gap: 10, marginTop: 15, padding: 13, borderRadius: radius.md, backgroundColor: '#EFF7EC' },
  secureText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 56, marginTop: 18, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.65 },
  disclaimer: { marginTop: 9, textAlign: 'center', color: colors.muted, fontSize: 12, lineHeight: 17 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 },
});
