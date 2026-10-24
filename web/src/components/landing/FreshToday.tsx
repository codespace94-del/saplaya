import { Sprout } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import { formatTZS } from '@/lib/format';
import { photoUrl } from '@/lib/images';
import { SHOWCASE } from '@/lib/showcase';

export function FreshToday() {
  return (
    <section id="fresh" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5">
        <h2 className="max-w-xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          On the shelf this morning.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Picked, packed and out the same day. Every item tells you how long ago it left the field.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {SHOWCASE.map((it, i) => (
            <article
              key={it.name}
              className={`group relative overflow-hidden rounded-[1.75rem] bg-line ${i === 0 ? 'col-span-2 row-span-2 min-h-[320px] lg:min-h-0' : 'aspect-[4/5]'}`}
            >
              <SmartImage
                src={photoUrl(it.photo, i === 0 ? 1200 : 700)}
                alt={it.name}
                emoji={it.emoji}
                className="absolute inset-0 text-6xl"
                imgClassName="transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-leaf-deep">
                <Sprout size={14} /> Harvested {it.hrs} hours ago
              </div>
              <div className="absolute inset-x-4 bottom-4 text-white">
                <h3 className={`font-display font-extrabold ${i === 0 ? 'text-3xl' : 'text-xl'}`}>{it.name}</h3>
                <p className="mt-0.5 font-bold text-sun">
                  {formatTZS(it.retail)} <span className="text-sm font-medium text-white/80">per {it.unit}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
