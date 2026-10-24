import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store/StoreContext';
import { colors, radius } from '../theme';

const H = 64;

/** Big, obvious two-option slide toggle. */
export function ModeToggle() {
  const { mode, setMode } = useStore();
  const wholesale = mode === 'wholesale';
  const [w, setW] = React.useState(0);
  const half = w / 2;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        setMode(wholesale ? 'retail' : 'wholesale');
      }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="switch"
      accessibilityLabel="Switch between retail and wholesale"
      style={styles.track}
    >
      <MotiView
        style={[styles.thumb, { width: Math.max(0, half - 6) }]}
        animate={{ translateX: wholesale ? half : 0, backgroundColor: wholesale ? colors.yellowDeep : colors.green }}
        transition={{ type: 'spring', damping: 14, stiffness: 160 }}
      />
      <View style={styles.label}>
        <Ionicons name="basket" size={22} color={wholesale ? colors.muted : colors.white} />
        <Text style={[styles.text, { color: wholesale ? colors.muted : colors.white }]}>Retail</Text>
      </View>
      <View style={styles.label}>
        <MaterialCommunityIcons name="package-variant-closed" size={22} color={wholesale ? colors.ink : colors.muted} />
        <Text style={[styles.text, { color: wholesale ? colors.ink : colors.muted }]}>Wholesale</Text>
      </View>
    </Pressable>
  );
}

/** Background graphic that morphs: single basket (retail) ⇄ stacked wooden crates (wholesale). */
export function ModeBackdrop() {
  const { mode } = useStore();
  const wholesale = mode === 'wholesale';
  return (
    <View style={styles.backdrop} pointerEvents="none">
      <MotiView
        style={styles.abs}
        animate={{ opacity: wholesale ? 0 : 1, scale: wholesale ? 0.7 : 1, translateY: wholesale ? 20 : 0 }}
        transition={{ type: 'timing', duration: 450 }}
      >
        <MaterialCommunityIcons name="basket" size={150} color="rgba(76,175,80,0.16)" />
      </MotiView>
      <MotiView
        style={styles.abs}
        animate={{ opacity: wholesale ? 1 : 0, scale: wholesale ? 1 : 0.7, translateY: wholesale ? 0 : 20 }}
        transition={{ type: 'spring', damping: 12 }}
      >
        <Crates />
      </MotiView>
    </View>
  );
}

function Crate({ w = 92 }: { w?: number }) {
  return (
    <View style={[styles.crate, { width: w }]}>
      <View style={styles.slat} />
      <View style={styles.slat} />
      <View style={styles.slat} />
    </View>
  );
}

function Crates() {
  return (
    <View style={{ alignItems: 'center', opacity: 0.55 }}>
      <Crate />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Crate />
        <Crate />
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Crate />
        <Crate />
        <Crate />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: H,
    marginHorizontal: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
  },
  thumb: { position: 'absolute', left: 3, top: 3, height: H - 10, borderRadius: radius.xl - 4 },
  label: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontSize: 18, fontWeight: '800' },
  backdrop: { position: 'absolute', right: -10, top: 70, width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  crate: { height: 28, backgroundColor: colors.wood, borderWidth: 2, borderColor: colors.woodDark, borderRadius: 4, justifyContent: 'space-evenly', paddingVertical: 2 },
  slat: { height: 3, backgroundColor: colors.woodDark, opacity: 0.55 },
});
