/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
        },
        edge: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        content: {
          DEFAULT: 'var(--color-text)',
          soft: 'var(--color-text-soft)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
          ring: 'var(--color-primary-ring)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          soft: 'var(--color-info-soft)',
        },
      },
      borderRadius: {
        'design-sm': '10px',
        'design-md': '14px',
        'design-lg': '18px',
        'design-xl': '24px',
        'design-pill': '999px',
      },
      boxShadow: {
        'design-sm': '0 1px 2px rgba(16, 24, 40, 0.04)',
        'design-md': '0 8px 24px rgba(16, 24, 40, 0.08)',
        'design-lg': '0 16px 40px rgba(16, 24, 40, 0.10)',
      },
      fontFamily: {
        sans: ['"Inter"', '"SF Pro Text"', '"SF Pro Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
