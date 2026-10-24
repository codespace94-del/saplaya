import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFly } from '../store/FlyContext';
import { useStore } from '../store/StoreContext';
import { colors } from '../theme';

/** Tab-bar cart icon: reports its screen position (particle target) and jiggles on landing. */
export default function CartTabIcon({ color, size }: { color: string; size: number }) {
  const { setCartTarget, jiggleKey } = useFly();
  const { count } = useStore();
  const ref = useRef<View>(null);
  const rot = useSharedValue(0);

  useEffect(() => {
    if (jiggleKey === 0) return;
    rot.value = withSequence(
      withTiming(-18, { duration: 70 }),
      withTiming(16, { duration: 90 }),
      withTiming(-10, { duration: 90 }),
      withTiming(6, { duration: 80 }),
      withTiming(0, { duration: 70 })
    );
  }, [jiggleKey, rot]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }, { scale: 1 + Math.abs(rot.value) / 90 }] }));

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => ref.current?.measureInWindow((x, y, w, h) => setCartTarget({ x: x + w / 2, y: y + h / 2 }))}
    >
      <Animated.View style={style}>
        <Ionicons name="cart" size={size} color={color} />
      </Animated.View>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : Math.round(count)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.yellowDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.ink },
});
