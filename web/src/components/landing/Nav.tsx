'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { LinkButton } from '@/components/ui/Button';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#fresh', label: 'Fresh today' },
  { href: '#farmers', label: 'For farmers' },
  { href: '#faq', label: 'Questions' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-milk/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5">
        <Link href="/" aria-label="Saplaya home">
          <Logo grow />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-xl px-4 py-2 text-[15px] font-semibold text-ink-soft transition hover:bg-leaf-soft hover:text-leaf-deep">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <LinkButton href="/login" variant="ghost">Farm sign in</LinkButton>
          <LinkButton href="#download" variant="sun">Get the app</LinkButton>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-leaf-soft lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-milk lg:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-lg font-semibold text-ink hover:bg-leaf-soft">
                  {l.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <LinkButton href="/login" variant="soft">Farm sign in</LinkButton>
                <LinkButton href="#download" variant="sun">Get the app</LinkButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
