'use client';

import { motion } from 'framer-motion';
import { ClipboardList, DoorOpen, ShoppingBag, Truck } from 'lucide-react';

const STEPS = [
  { icon: ClipboardList, color: '#FFB300', title: 'We get your order', text: 'The moment you tap Place order, the farm that grew your food is told.' },
  { icon: ShoppingBag, color: '#0288D1', title: 'The farm packs it', text: 'Your items are picked, weighed and packed in paper bags.' },
  { icon: Truck, color: '#7B1FA2', title: 'On the way', text: 'A Saplaya van brings it to you. Watch it move on the map.' },
  { icon: DoorOpen, color: '#2E7D32', title: 'At your door', text: 'Fresh food, delivered. Pay when it arrives.' },
];

/** The same four stages, in the same colours, that customers see in the app. */
export function Pipeline() {
  return (
    <section id="how" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5">
        <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Follow your order from the field to your front door.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Every step lights up in the app as it happens, so you never have to call and ask.
        </p>

        <motion.ol
          initial="off"
          whileInView="on"
          viewport={{ once: true, margin: '-120px' }}
          className="mt-14 grid gap-10 md:grid-cols-4 md:gap-0"
        >
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const delay = i * 0.55;
            return (
              <li key={s.title} className="relative flex gap-5 md:block md:px-4 md:text-center">
                {i < STEPS.length - 1 && (
                  <motion.span
                    aria-hidden
                    variants={{ off: { scaleX: 0 }, on: { scaleX: 1, transition: { delay: delay + 0.3, duration: 0.5 } } }}
                    style={{ backgroundColor: STEPS[i + 1].color, transformOrigin: 'left' }}
                    className="absolute left-[calc(50%+44px)] right-[calc(-50%+44px)] top-[38px] hidden h-1.5 rounded-full md:block"
                  />
                )}
                <motion.span
                  variants={{
                    off: { backgroundColor: '#FFFFFF', borderColor: '#E3EBE0', color: '#6B7A6C', boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
                    on: { backgroundColor: s.color, borderColor: s.color, color: '#FFFFFF', boxShadow: `0 0 34px 6px ${s.color}66`, transition: { delay, duration: 0.5 } },
                  }}
                  className="relative z-10 grid h-[78px] w-[78px] shrink-0 place-items-center rounded-full border-[3px] md:mx-auto"
                >
                  <Icon size={34} />
                </motion.span>
                <div className="md:mt-5">
                  <h3 className="font-display text-xl font-extrabold">{s.title}</h3>
                  <p className="mt-1.5 text-ink-soft">{s.text}</p>
                </div>
              </li>
            );
          })}
        </motion.ol>
      </div>
    </section>
  );
}
