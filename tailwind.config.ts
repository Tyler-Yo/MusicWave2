import type { Config } from 'tailwindcss';

/** Every color is a CSS variable so dark/light themes swap at runtime (see src/index.css). */
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        elevated: token('elevated'),
        surface: token('surface'),
        surface2: token('surface-2'),
        line: token('line'),
        fg: token('fg'),
        muted: token('muted'),
        subtle: token('subtle'),
        primary: token('primary'),
        'primary-strong': token('primary-strong'),
        'on-primary': token('on-primary'),
        accent: token('accent'),
        ember: token('ember'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 10px 30px -12px rgb(0 0 0 / 0.45)',
        glow: '0 0 0 1px rgb(var(--c-primary) / 0.35), 0 8px 30px -6px rgb(var(--c-primary) / 0.45)',
        player: '0 -12px 40px -16px rgb(0 0 0 / 0.55)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        spin: { to: { transform: 'rotate(360deg)' } },
        eq: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        drift: {
          '0%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(8%, -6%, 0) scale(1.12)' },
          '66%': { transform: 'translate3d(-6%, 8%, 0) scale(0.94)' },
          '100%': { transform: 'translate3d(0,0,0) scale(1)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.18)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 240ms ease-out both',
        'fade-up': 'fade-up 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slide-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'spin-slow': 'spin 9s linear infinite',
        eq: 'eq 900ms ease-in-out infinite',
        drift: 'drift 22s ease-in-out infinite',
        breathe: 'breathe 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
