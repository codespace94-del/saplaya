import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ensureSession, supabase } from './supabase';
import type { CustomerIdentity } from './customer-auth.types';

function identityFor(user: User): CustomerIdentity {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    is_anonymous: Boolean(user.is_anonymous),
  };
}

export function getCurrentPhoneIdentity(): CustomerIdentity | null {
  return null;
}

export function subscribePhoneAuth(_listener: (user: CustomerIdentity | null) => void): () => void {
  return () => undefined;
}

export async function sendPhoneOtp(phone: string, fullName?: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
      ...(fullName ? { data: { full_name: fullName.trim() } } : {}),
    },
  });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<CustomerIdentity> {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return a signed-in user after verifying the code.');
  return identityFor(data.user);
}

export async function getCustomerDataContext(): Promise<{ client: SupabaseClient; userId: string }> {
  const session = await ensureSession();
  return { client: supabase, userId: session.user.id };
}

export async function getCustomerApiToken(): Promise<string> {
  const session = await ensureSession();
  return session.access_token;
}

export async function signOutPhoneAuth(): Promise<void> {}
