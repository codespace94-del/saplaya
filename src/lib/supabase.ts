import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isConfigured = Boolean(url && anon && API_URL);

export const supabase = createClient(url || 'http://localhost', anon || 'anon', {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Keep guest checkout frictionless; guest sessions can later be upgraded to accounts.
export async function ensureSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;
  const res = await supabase.auth.signInAnonymously();
  if (res.error) throw res.error;
  if (!res.data.session) throw new Error('Could not create an account session.');
  return res.data.session;
}
