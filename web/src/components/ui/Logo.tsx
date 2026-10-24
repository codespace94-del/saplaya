'use client';

import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';
import { cn } from '@/lib/format';

/** The Saplaya mark: a sprout that springs up when it first appears. */
export function LogoMark({ size = 40, grow = false }: { size?: number; grow?: boolean }) {
  return (
    <motion.span
      initial={grow ? { scale: 0, rotate: -20 } : false}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', damping: 8, stiffness: 140, delay: 0.1 }}
      className="relative grid shrink-0 place-items-center rounded-[34%] bg-leaf ring-[3px] ring-sun"
      style={{ width: size, height: size }}
    >
      <Sprout color="#fff" size={size * 0.58} strokeWidth={2.4} />
      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-sun-deep ring-2 ring-milk" style={{ width: size * 0.26, height: size * 0.26 }} />
    </motion.span>
  );
}

export function Logo({ className, dark = false, grow = false }: { className?: string; dark?: boolean; grow?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark grow={grow} />
      <span className={cn('font-display text-2xl font-extrabold tracking-tight', dark ? 'text-white' : 'text-leaf')}>
        Sapla<span className="text-sun-deep">ya</span>
      </span>
    </span>
  );
}
