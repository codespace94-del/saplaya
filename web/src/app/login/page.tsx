'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, Sprout } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Fields';
import { Logo } from '@/components/ui/Logo';
import { getSupabase } from '@/lib/supabase';
import { useBoot, useDB, useMe } from '@/lib/store';
import { loadAdminData } from '@/lib/admin-data';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/format';

const home = (role: Role) => (role === 'driver' ? '/admin/orders' : '/admin');

export default function LoginPage() {
  const router = useRouter();
  const ready = useBoot((s) => s.ready);
  const me = useMe();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && me) router.replace(home(me.role));
  }, [ready, me, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      const data = await loadAdminData();
      useDB.setState(data);
      const member = useDB.getState().team.find((teamMember) => teamMember.id === useDB.getState().sessionId);
      if (!member) throw new Error('This account does not have an active Saplaya team role.');
      router.replace(home(member.role));
    } catch (loginError) {
      await getSupabase().auth.signOut();
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="field-lines relative hidden overflow-hidden bg-leaf-deep p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" aria-label="Back to Saplaya"><Logo dark grow /></Link>
        <div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 10, delay: 0.2 }}
            className="mb-8 grid h-24 w-24 place-items-center rounded-[2rem] bg-sun text-leaf-deep"
          >
            <motion.span animate={{ rotate: [-6, 6, -6] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
              <Sprout size={52} strokeWidth={2.2} />
            </motion.span>
          </motion.div>
          <h1 className="max-w-md font-display text-5xl font-extrabold leading-[1.02] tracking-tight">
            Your farm&rsquo;s orders and stock, in one simple place.
          </h1>
          <ul className="mt-8 max-w-md space-y-3 text-lg text-white/85">
            <li className="flex items-start gap-3"><ShieldCheck className="mt-1 shrink-0 text-sun" size={22} /> Your role controls what you can access.</li>
            <li className="flex items-start gap-3"><Lock className="mt-1 shrink-0 text-sun" size={22} /> Sign-in is securely managed by Supabase.</li>
          </ul>
        </div>
        <p className="text-white/60">Saplaya team and farm sign in</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-xl">
          <Link href="/" className="mb-8 inline-block lg:hidden" aria-label="Back to Saplaya"><Logo /></Link>
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-lg text-ink-soft">Sign in to manage orders, stock and your team.</p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <Field label="Email">
              <Input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="you@yourfarm.co.tz" autoComplete="username" required />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} className="pr-14" autoComplete="current-password" required />
                <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-ink-soft hover:bg-leaf-soft">
                  {show ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </Field>
            {error && <p role="alert" className="rounded-2xl bg-[#FFEBEE] p-3 font-semibold text-[#B71C1C]">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy} icon={<ArrowRight size={22} />}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className={cn('mt-6 text-center text-sm text-ink-mute', !process.env.NEXT_PUBLIC_API_URL && 'text-[#B71C1C]')}>
            Sign-in requires an active Saplaya team account and a connected API.
          </p>
          <p className="mt-8 text-center text-ink-soft">
            Not a supplier yet? <Link href="/#farmers" className="font-bold text-leaf underline underline-offset-4">Apply to sell on Saplaya</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
