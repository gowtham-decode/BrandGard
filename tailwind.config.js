/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          tint: 'var(--tint)',
        },
        ok: {
          DEFAULT: 'var(--ok)',
          tint: 'var(--ok-tint)',
        },
        warn: {
          DEFAULT: 'var(--warn)',
          tint: 'var(--warn-tint)',
        },
        bad: {
          DEFAULT: 'var(--bad)',
          tint: 'var(--bad-tint)',
        },
      },
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        panel: '14px',
        input: '11px',
        button: '10px',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
