import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { fetchProducts, fetchPromos } from '../lib/api';
import { useDeliveryPlace } from '../lib/location';
import { ModeBackdrop, ModeToggle } from '../components/ModeToggle';
import PromoSlider from '../components/PromoSlider';
import ProductCard from '../components/ProductCard';
import { useStore } from '../store/StoreContext';
import { colors } from '../theme';
import { Product, Promo } from '../types';

export default function HomeScreen({ navigation }: any) {
  const { mode } = useStore();
  const place = useDeliveryPlace();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigateToRoot = (screen: 'Account' | 'LocationPicker') => {
    const rootNavigation = navigation.getParent('RootStack');
    if (!rootNavigation) {
      console.error(`Could not find the root navigator to open ${screen}.`);
      return;
    }
    rootNavigation.navigate(screen);
  };

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetchProducts(page);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage((p) => p + 1);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page]);

  useEffect(() => {
    fetchPromos().then(setPromos).catch(() => {});
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <View>
      {/* Delivery location with van icon */}
      <View style={styles.topBar}>
        <Pressable style={styles.loc} onPress={() => navigateToRoot('LocationPicker')} accessibilityRole="button" accessibilityLabel={`Change delivery location, currently ${place.label}`}>
          <MotiView
            from={{ translateX: -8 }}
            animate={{ translateX: 0 }}
            transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
            style={styles.van}
          >
            <MaterialCommunityIcons name="van-utility" size={24} color={colors.white} />
          </MotiView>
          <View style={{ flex: 1 }}>
            <Text style={styles.locSmall}>Delivering to · Tap to change</Text>
            <Text style={styles.locBig} numberOfLines={1}>
              {place.label} <Ionicons name="chevron-down" size={14} color={colors.green} />
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.accountButton} onPress={() => navigateToRoot('Account')} accessibilityRole="button" accessibilityLabel="Open your account">
          <Ionicons name="person-outline" size={23} color={colors.green} />
        </Pressable>
      </View>

      <PromoSlider promos={promos} />

      <Text style={styles.q}>How are you shopping today?</Text>
      <ModeToggle />

      <Text style={styles.section}>{mode === 'retail' ? 'Fresh today' : 'Bulk prices'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ModeBackdrop />
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => (
          <ProductCard product={item} index={index} onPress={() => navigation.navigate('Product', { product: item })} />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={colors.green} style={{ margin: 24 }} />
          ) : error ? (
            <Text style={styles.err} onPress={loadMore}>{error} — tap to retry</Text>
          ) : null
        }
        onEndReachedThreshold={0.6}
        onEndReached={loadMore}
        columnWrapperStyle={{ paddingHorizontal: 14 }}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  loc: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 6, gap: 12 },
  van: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  accountButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  locSmall: { fontSize: 12, color: colors.muted },
  locBig: { fontSize: 18, fontWeight: '800', color: colors.ink },
  q: { fontSize: 20, fontWeight: '800', color: colors.ink, marginHorizontal: 20, marginTop: 22, marginBottom: 10 },
  section: { fontSize: 22, fontWeight: '900', color: colors.green, marginHorizontal: 20, marginTop: 22, marginBottom: 6 },
  err: { textAlign: 'center', color: '#D32F2F', padding: 20, fontWeight: '700' },
});
