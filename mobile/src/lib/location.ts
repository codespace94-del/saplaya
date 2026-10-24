import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { STORE } from './delivery';

export type Place = { lat: number; lng: number; label: string; approximate: boolean };

const FALLBACK: Place = { lat: STORE.lat + 0.018, lng: STORE.lng, label: 'Dodoma', approximate: true };
const STORAGE_KEY = 'saplaya-delivery-place';

type DeliveryContextValue = {
  place: Place;
  setPlace: (place: Place) => Promise<void>;
  useCurrentLocation: () => Promise<Place>;
};

const DeliveryContext = createContext<DeliveryContextValue | null>(null);

async function readCurrentLocation(): Promise<Place> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Allow location access or choose a saved delivery address.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  let label = 'Your location';
  try {
    const [address] = await Location.reverseGeocodeAsync(position.coords);
    label = [address?.district ?? address?.street, address?.city].filter(Boolean).join(', ') || label;
  } catch {
    label = 'Your location';
  }
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    label,
    approximate: false,
  };
}

export function DeliveryProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlaceState] = useState<Place>(FALLBACK);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then(async (saved) => {
      if (saved) {
        if (active) setPlaceState(JSON.parse(saved) as Place);
        return;
      }
      try {
        const current = await readCurrentLocation();
        if (active) {
          setPlaceState(current);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        }
      } catch {
        if (active) setPlaceState(FALLBACK);
      }
    }).catch(() => {
      if (active) setPlaceState(FALLBACK);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPlace = useCallback(async (nextPlace: Place) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlace));
    setPlaceState(nextPlace);
  }, []);

  const useCurrentLocation = useCallback(async () => {
    const current = await readCurrentLocation();
    await setPlace(current);
    return current;
  }, [setPlace]);

  const value = useMemo(() => ({ place, setPlace, useCurrentLocation }), [place, setPlace, useCurrentLocation]);
  return React.createElement(DeliveryContext.Provider, { value }, children);
}

export function useDeliveryPlace(): Place {
  const context = useContext(DeliveryContext);
  if (!context) throw new Error('useDeliveryPlace must be used within a DeliveryProvider.');
  return context.place;
}

export function useDeliveryActions() {
  const context = useContext(DeliveryContext);
  if (!context) throw new Error('useDeliveryActions must be used within a DeliveryProvider.');
  return { setPlace: context.setPlace, useCurrentLocation: context.useCurrentLocation };
}
