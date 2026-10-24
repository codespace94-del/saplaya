import { Nav } from '@/components/landing/Nav';
import { Hero } from '@/components/landing/Hero';
import { Pipeline } from '@/components/landing/Pipeline';
import { FreshToday } from '@/components/landing/FreshToday';
import { TwoWays } from '@/components/landing/TwoWays';
import { Farmers } from '@/components/landing/Farmers';
import { Faq } from '@/components/landing/Faq';
import { Download, Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Pipeline />
        <FreshToday />
        <TwoWays />
        <Farmers />
        <Faq />
        <Download />
      </main>
      <Footer />
    </>
  );
}
