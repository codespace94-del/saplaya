import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

type Point = { x: number; y: number };
type FlyCtx = {
  setCartTarget: (p: Point) => void;
  fly: (from: Point) => void;
  jiggleKey: number;
};

const Ctx = createContext<FlyCtx>(null as unknown as FlyCtx);
export const useFly = () => useContext(Ctx);

export function FlyProvider({ children }: { children: React.ReactNode }) {
  const target = useRef<Point>({ x: 200, y: 800 });
  const [jiggleKey, setJiggleKey] = useState(0);
  const [particles, setParticles] = useState<{ id: number; from: Point }[]>([]);
  const nextId = useRef(1);

  const setCartTarget = useCallback((p: Point) => {
    target.current = p;
  }, []);

  const fly = useCallback((from: Point) => {
    setParticles((ps) => [...ps, { id: nextId.current++, from }]);
  }, []);

  const done = useCallback((id: number) => {
    setParticles((ps) => ps.filter((p) => p.id !== id));
    setJiggleKey((k) => k + 1); // cart icon jiggles when the particle lands
  }, []);

  return (
    <Ctx.Provider value={{ setCartTarget, fly, jiggleKey }}>
      {children}
      {particles.map((p) => (
        <Particle key={p.id} from={p.from} to={target.current} onDone={() => done(p.id)} />
      ))}
    </Ctx.Provider>
  );
}

function Particle({ from, to, onDone }: { from: Point; to: Point; onDone: () => void }) {
  const t = useSharedValue(0);
  const arc = Math.max(120, Math.abs(to.y - from.y) * 0.4);

  React.useEffect(() => {
    t.value = withTiming(1, { duration: 750, easing: Easing.inOut(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const x = from.x + (to.x - from.x) * t.value;
    // linear travel minus a sine bump = a smooth arc
    const y = from.y + (to.y - from.y) * t.value - Math.sin(Math.PI * t.value) * arc;
    return {
      transform: [{ translateX: x - 10 }, { translateY: y - 10 }, { scale: 1 - 0.5 * t.value }],
      opacity: t.value > 0.95 ? 0 : 1,
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.yellowDeep,
    borderWidth: 3,
    borderColor: colors.greenLight,
    zIndex: 999,
  },
});
