import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';
import { isConfigured, ensureSession, supabase } from '../lib/supabase';

export type AccountProfile = {
  fullName: string;
  phone: string;
  avatarUrl: string | null;
};

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
};

export type CustomerReview = {
  id: string;
  rating: number;
  message: string;
  createdAt: string;
};

type AccountContextValue = {
  user: User | null;
  isSignedIn: boolean;
  profile: AccountProfile;
  addresses: SavedAddress[];
  reviews: CustomerReview[];
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  saveProfile: (profile: AccountProfile) => Promise<void>;
  uploadAvatar: (asset: ImagePickerAsset) => Promise<void>;
  addAddress: (address: Omit<SavedAddress, 'id' | 'isDefault'>) => Promise<void>;
  selectAddress: (id: string) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  addReview: (rating: number, message: string) => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);
const DEMO_STORAGE_KEY = 'saplaya-demo-account';

const emptyProfile: AccountProfile = { fullName: '', phone: '', avatarUrl: null };

function requireData<T>(data: T | null, error: { message: string } | null, message: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(message);
  return data;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile>(emptyProfile);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) throw sessionError;
      if (active) setUser(data.session?.user ?? null);
    }).catch((sessionError: unknown) => {
      if (active) setError(sessionError instanceof Error ? sessionError.message : 'Could not restore your account.');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      if (!isConfigured) {
        const saved = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
        const data = saved ? JSON.parse(saved) as { profile: AccountProfile; addresses: SavedAddress[]; reviews: CustomerReview[] } : null;
        if (active) {
          setProfile(data?.profile ?? emptyProfile);
          setAddresses(data?.addresses ?? []);
          setReviews(data?.reviews ?? []);
        }
        return;
      }
      if (!user) {
        if (active) {
          setProfile(emptyProfile);
          setAddresses([]);
          setReviews([]);
        }
        return;
      }

      const [profileResult, addressResult, reviewResult] = await Promise.all([
        supabase.from('customer_profiles').select('full_name, phone, avatar_url').eq('customer_id', user.id).maybeSingle(),
        supabase.from('customer_addresses').select('id, label, address, lat, lng, is_default').eq('customer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('customer_reviews').select('id, rating, message, created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (profileResult.error || addressResult.error || reviewResult.error) {
        throw new Error(profileResult.error?.message ?? addressResult.error?.message ?? reviewResult.error?.message);
      }
      if (active) {
        setProfile({
          fullName: profileResult.data?.full_name ?? '',
          phone: profileResult.data?.phone ?? '',
          avatarUrl: profileResult.data?.avatar_url ?? null,
        });
        setAddresses((addressResult.data ?? []).map((address) => ({
          id: address.id,
          label: address.label,
          address: address.address,
          lat: Number(address.lat),
          lng: Number(address.lng),
          isDefault: address.is_default,
        })));
        setReviews((reviewResult.data ?? []).map((review) => ({
          id: review.id,
          rating: review.rating,
          message: review.message,
          createdAt: review.created_at,
        })));
      }
    };

    load().catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your account details.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isConfigured) throw new Error('Connect Supabase and the app backend before signing in.');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    if (!isConfigured) throw new Error('Connect Supabase and the app backend before creating an account.');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user.is_anonymous) {
      const { data, error: updateError } = await supabase.auth.updateUser({
        email,
        password,
        data: { full_name: fullName.trim() },
      });
      if (updateError) throw updateError;
      if (data.user) setUser(data.user);
      return false;
    }
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (signUpError) throw signUpError;
    if (data.session?.user) setUser(data.session.user);
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    if (!isConfigured) {
      await AsyncStorage.removeItem(DEMO_STORAGE_KEY);
      setProfile(emptyProfile);
      setAddresses([]);
      setReviews([]);
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  const persistDemo = useCallback(async (
    nextProfile: AccountProfile,
    nextAddresses: SavedAddress[],
    nextReviews: CustomerReview[],
  ) => {
    await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
      profile: nextProfile,
      addresses: nextAddresses,
      reviews: nextReviews,
    }));
  }, []);

  const saveProfile = useCallback(async (nextProfile: AccountProfile) => {
    if (isConfigured) {
      const session = await ensureSession();
      const result = await supabase.from('customer_profiles').upsert({
        customer_id: session.user.id,
        full_name: nextProfile.fullName.trim(),
        phone: nextProfile.phone.trim(),
        avatar_url: nextProfile.avatarUrl,
        updated_at: new Date().toISOString(),
      });
      if (result.error) throw new Error(result.error.message);
    } else {
      await persistDemo(nextProfile, addresses, reviews);
    }
    setProfile(nextProfile);
  }, [addresses, persistDemo, reviews]);

  const uploadAvatar = useCallback(async (asset: ImagePickerAsset) => {
    let avatarUrl = asset.uri;
    if (isConfigured) {
      const session = await ensureSession();
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Could not read the selected photo.');
      const file = await response.blob();
      const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
      const path = `${session.user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('customer-avatars').upload(path, file, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: true,
      });
      if (uploadError) throw new Error(uploadError.message);
      avatarUrl = supabase.storage.from('customer-avatars').getPublicUrl(path).data.publicUrl;
    }
    await saveProfile({ ...profile, avatarUrl });
  }, [profile, saveProfile]);

  const addAddress = useCallback(async (input: Omit<SavedAddress, 'id' | 'isDefault'>) => {
    if (isConfigured) {
      const session = await ensureSession();
      const { data, error: insertError } = await supabase.from('customer_addresses').insert({
        customer_id: session.user.id,
        label: input.label.trim(),
        address: input.address.trim(),
        lat: input.lat,
        lng: input.lng,
        is_default: addresses.length === 0,
      }).select('id, label, address, lat, lng, is_default').single();
      const saved = requireData(data, insertError, 'Could not save this address.');
      setAddresses((current) => [{ ...input, id: saved.id, isDefault: saved.is_default }, ...current]);
      return;
    }
    const next = [...addresses, { ...input, id: `address-${Date.now()}`, isDefault: addresses.length === 0 }];
    await persistDemo(profile, next, reviews);
    setAddresses(next);
  }, [addresses, persistDemo, profile, reviews]);

  const selectAddress = useCallback(async (id: string) => {
    const address = addresses.find((entry) => entry.id === id);
    if (!address) throw new Error('This saved address could not be found.');
    if (isConfigured) {
      const session = await ensureSession();
      const { error: unsetError } = await supabase.from('customer_addresses')
        .update({ is_default: false }).eq('customer_id', session.user.id);
      if (unsetError) throw new Error(unsetError.message);
      const { error: setError } = await supabase.from('customer_addresses')
        .update({ is_default: true }).eq('customer_id', session.user.id).eq('id', id);
      if (setError) throw new Error(setError.message);
    }
    const next = addresses.map((entry) => ({ ...entry, isDefault: entry.id === id }));
    if (!isConfigured) await persistDemo(profile, next, reviews);
    setAddresses(next);
  }, [addresses, persistDemo, profile, reviews]);

  const removeAddress = useCallback(async (id: string) => {
    if (isConfigured) {
      const session = await ensureSession();
      const { error: deleteError } = await supabase.from('customer_addresses')
        .delete().eq('customer_id', session.user.id).eq('id', id);
      if (deleteError) throw new Error(deleteError.message);
    }
    const next = addresses.filter((entry) => entry.id !== id);
    if (!next.some((entry) => entry.isDefault) && next.length) next[0].isDefault = true;
    if (!isConfigured) await persistDemo(profile, next, reviews);
    setAddresses(next);
  }, [addresses, persistDemo, profile, reviews]);

  const addReview = useCallback(async (rating: number, message: string) => {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !message.trim()) {
      throw new Error('Choose a rating and write a short review.');
    }
    let nextReview: CustomerReview;
    if (isConfigured) {
      const session = await ensureSession();
      const { data, error: insertError } = await supabase.from('customer_reviews').insert({
        customer_id: session.user.id,
        rating,
        message: message.trim(),
      }).select('id, rating, message, created_at').single();
      const saved = requireData(data, insertError, 'Could not save your review.');
      nextReview = { id: saved.id, rating: saved.rating, message: saved.message, createdAt: saved.created_at };
    } else {
      nextReview = { id: `review-${Date.now()}`, rating, message: message.trim(), createdAt: new Date().toISOString() };
    }
    const next = [nextReview, ...reviews];
    if (!isConfigured) await persistDemo(profile, addresses, next);
    setReviews(next);
  }, [addresses, persistDemo, profile, reviews]);

  const value = useMemo<AccountContextValue>(() => ({
    user,
    isSignedIn: Boolean(user && !user.is_anonymous),
    profile,
    addresses,
    reviews,
    loading,
    error,
    signIn,
    register,
    signOut,
    saveProfile,
    uploadAvatar,
    addAddress,
    selectAddress,
    removeAddress,
    addReview,
  }), [
    user, profile, addresses, reviews, loading, error, signIn, register, signOut,
    saveProfile, uploadAvatar, addAddress, selectAddress, removeAddress, addReview,
  ]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used within an AccountProvider.');
  return value;
}
