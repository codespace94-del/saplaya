'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/format';

const QA = [
  { q: 'How fast is delivery?', a: 'Most orders inside Dodoma arrive the same day. You can follow your order on a map in the app.' },
  { q: 'When is delivery free?', a: 'Delivery is free within 5 km of our hub. From 5 to 10 km it costs TSh 2,000, and beyond 10 km it costs TSh 4,000. The app shows the price before you order.' },
  { q: 'What does wholesale mode do?', a: 'It switches every price to the bulk price. Each item shows the smallest amount you can order, for example 10 kg of tomatoes.' },
  { q: 'Can the farm see my details?', a: 'The farm sees your first name and your delivery area so it can pack your order. It never sees your phone number.' },
  { q: 'How do I pay?', a: 'You pay when your order arrives at your door.' },
  { q: 'How does a farm join?', a: 'Fill in the form in the farmers section. We call you within 2 working days, and after approval you get an email with your sign-in link.' },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Questions people ask us.</h2>
        <div className="divide-y divide-line rounded-[2rem] bg-white px-6 shadow-soft">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-bold"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  {item.q}
                  <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', isOpen ? 'bg-leaf text-white' : 'bg-leaf-soft text-leaf')}>
                    <Plus size={20} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="pb-5 pr-12 text-lg text-ink-soft">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
