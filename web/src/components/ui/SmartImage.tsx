'use client';

import { useState } from 'react';
import { cn } from '@/lib/format';

const TILES = [
  'from-[#FFE0B2] to-[#FFCC80]',
  'from-[#C8E6C9] to-[#A5D6A7]',
  'from-[#FFF9C4] to-[#FFF176]',
  'from-[#F8BBD0] to-[#F48FB1]',
  'from-[#DCEDC8] to-[#AED581]',
];

/** A photo that quietly turns into a coloured emoji tile if the picture can't load. */
export function SmartImage({
  src, alt, emoji = '🥬', className, imgClassName,
}: { src?: string; alt: string; emoji?: string; className?: string; imgClassName?: string }) {
  const [failed, setFailed] = useState(false);
  const tile = TILES[(alt.length + emoji.length) % TILES.length];

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn('grid place-items-center bg-gradient-to-br', tile, className)}
      >
        <span className="select-none text-[2.2em] leading-none">{emoji}</span>
      </div>
    );
  }
  return (
    <div className={cn('overflow-hidden bg-line', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn('h-full w-full object-cover', imgClassName)}
      />
    </div>
  );
}
