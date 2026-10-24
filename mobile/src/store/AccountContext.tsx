import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';
import { ensureSession, supabase } from '../lib/supabase';

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
  sendPhoneOtp: (phone: string, fullName?: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (profile: AccountProfile) => Promise<void>;
  uploadAvatar: (asset: ImagePickerAsset) => Promise<void>;
  addAddress: (address: Omit<SavedAddress, 'id' | 'isDefault'>) => Promise<void>;
  selectAddress: (id: string) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  addReview: (rating: number, message: string) => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

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
    const processAuthUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      if (typeof code === 'string') {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        return;
      }
      const fragment = url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      }
    };
    const handle = (url: string) => {
      void processAuthUrl(url).catch((authError: unknown) => {
        if (active) setError(authError instanceof Error ? authError.message : 'Could not verify your email link.');
      });
    };
    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    }).catch((urlError: unknown) => {
      if (active) setError(urlError instanceof Error ? urlError.message : 'Could not open your email link.');
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
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
      options: { emailRedirectTo: Linking.createURL('auth/callback'), data: { full_name: fullName.trim() } },
    });
    if (signUpError) throw signUpError;
    if (data.session?.user) setUser(data.session.user);
    return !data.session;
  }, []);

  const sendPhoneOtp = useCallback(async (phone: string, fullName?: string) => {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: true,
        ...(fullName ? { data: { full_name: fullName.trim() } } : {}),
      },
    });
    if (otpError) throw otpError;
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (verifyError) throw verifyError;
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  const saveProfile = useCallback(async (nextProfile: AccountProfile) => {
    const session = await ensureSession();
    const result = await supabase.from('customer_profiles').upsert({
      customer_id: session.user.id,
      full_name: nextProfile.fullName.trim(),
      phone: nextProfile.phone.trim(),
      avatar_url: nextProfile.avatarUrl,
      updated_at: new Date().toISOString(),
    });
    if (result.error) throw new Error(result.error.message);
    setProfile(nextProfile);
  }, []);

  const uploadAvatar = useCallback(async (asset: ImagePickerAsset) => {
    let avatarUrl = asset.uri;
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
    await saveProfile({ ...profile, avatarUrl });
  }, [profile, saveProfile]);

  const addAddress = useCallback(async (input: Omit<SavedAddress, 'id' | 'isDefault'>) => {
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
  }, [addresses]);

  const selectAddress = useCallback(async (id: string) => {
    const address = addresses.find((entry) => entry.id === id);
    if (!address) throw new Error('This saved address could not be found.');
    const session = await ensureSession();
    const { error: unsetError } = await supabase.from('customer_addresses')
      .update({ is_default: false }).eq('customer_id', session.user.id);
    if (unsetError) throw new Error(unsetError.message);
    const { error: setError } = await supabase.from('customer_addresses')
      .update({ is_default: true }).eq('customer_id', session.user.id).eq('id', id);
    if (setError) throw new Error(setError.message);
    const next = addresses.map((entry) => ({ ...entry, isDefault: entry.id === id }));
    setAddresses(next);
  }, [addresses]);

  const removeAddress = useCallback(async (id: string) => {
    const session = await ensureSession();
    const { error: deleteError } = await supabase.from('customer_addresses')
      .delete().eq('customer_id', session.user.id).eq('id', id);
    if (deleteError) throw new Error(deleteError.message);
    const next = addresses.filter((entry) => entry.id !== id);
    if (!next.some((entry) => entry.isDefault) && next.length) next[0].isDefault = true;
    setAddresses(next);
  }, [addresses]);

  const addReview = useCallback(async (rating: number, message: string) => {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !message.trim()) {
      throw new Error('Choose a rating and write a short review.');
    }
    let nextReview: CustomerReview;
    const session = await ensureSession();
    const { data, error: insertError } = await supabase.from('customer_reviews').insert({
      customer_id: session.user.id,
      rating,
      message: message.trim(),
    }).select('id, rating, message, created_at').single();
    const saved = requireData(data, insertError, 'Could not save your review.');
    nextReview = { id: saved.id, rating: saved.rating, message: saved.message, createdAt: saved.created_at };
    const next = [nextReview, ...reviews];
    setReviews(next);
  }, [reviews]);

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
    sendPhoneOtp,
    verifyPhoneOtp,
    signOut,
    saveProfile,
    uploadAvatar,
    addAddress,
    selectAddress,
    removeAddress,
    addReview,
  }), [
    user, profile, addresses, reviews, loading, error, signIn, register, sendPhoneOtp, verifyPhoneOtp, signOut,
    saveProfile, uploadAvatar, addAddress, selectAddress, removeAddress, addReview,
  ]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used within an AccountProvider.');
  return value;
}
