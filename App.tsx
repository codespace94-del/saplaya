import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatePresence, MotiView } from 'moti';
import { StyleSheet } from 'react-native';
import Navigation from './src/navigation';
import SplashMorph from './src/components/SplashMorph';
import { StoreProvider } from './src/store/StoreContext';
import { AccountProvider } from './src/store/AccountContext';
import { FlyProvider } from './src/store/FlyContext';
import { ensureSession, isConfigured } from './src/lib/supabase';
import { DeliveryProvider } from './src/lib/location';

export default function App() {
  const [splash, setSplash] = useState(true);
  const finish = useCallback(() => setSplash(false), []);

  useEffect(() => {
    if (isConfigured) {
      ensureSession().catch((error: unknown) => {
        console.error('Could not initialize the customer session:', error);
      });
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AccountProvider>
          <DeliveryProvider>
            <StoreProvider>
              <FlyProvider>
                <StatusBar style="dark" />
                <Navigation />
                <AnimatePresence>
                  {splash && (
                    <MotiView
                      key="splash"
                      style={StyleSheet.absoluteFill}
                      from={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'timing', duration: 400 }}
                    >
                      <SplashMorph onFinish={finish} />
                    </MotiView>
                  )}
                </AnimatePresence>
              </FlyProvider>
            </StoreProvider>
          </DeliveryProvider>
        </AccountProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
