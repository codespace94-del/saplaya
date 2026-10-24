import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        leaf: { DEFAULT: '#2E7D32', deep: '#1B5E20', soft: '#E8F5E9' },
        sprout: '#4CAF50',
        sun: { DEFAULT: '#FFD54F', deep: '#FFB300', soft: '#FFF8E1' },
        milk: '#F9FBF7',
        ink: { DEFAULT: '#15261A', soft: '#46604B', mute: '#6B7A6C' },
        line: '#E3EBE0',
        wood: { DEFAULT: '#B07A3E', dark: '#8A5A26' },
        st: {
          pending: '#FFB300',
          packing: '#0288D1',
          route: '#7B1FA2',
          done: '#2E7D32',
          cancel: '#D32F2F',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        lift: '0 18px 40px -18px rgba(27,94,32,0.45)',
        soft: '0 1px 0 rgba(27,94,32,0.05), 0 14px 28px -18px rgba(27,94,32,0.35)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: { floaty: 'floaty 5s ease-in-out infinite' },
    },
  },
  plugins: [],
};

export default config;
