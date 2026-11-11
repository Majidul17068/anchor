/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        anchor: {
          bg: 'var(--anchor-bg)',
          surface: 'var(--anchor-surface)',
          'surface-elevated': 'var(--anchor-surface-elevated)',
          'surface-sunken': 'var(--anchor-surface-sunken)',
          border: 'var(--anchor-border)',
          'border-subtle': 'var(--anchor-border-subtle)',
          text: 'var(--anchor-text)',
          'text-muted': 'var(--anchor-text-muted)',
          'text-subtle': 'var(--anchor-text-subtle)',
          accent: 'var(--anchor-accent)',
          'accent-hover': 'var(--anchor-accent-hover)',
          'accent-subtle': 'var(--anchor-accent-subtle)',
          warn: 'var(--anchor-warn)',
          'warn-subtle': 'var(--anchor-warn-subtle)',
          ok: 'var(--anchor-ok)',
          'ok-subtle': 'var(--anchor-ok-subtle)',
          info: 'var(--anchor-info)',
          'info-subtle': 'var(--anchor-info-subtle)',
          danger: 'var(--anchor-danger)',
          'danger-subtle': 'var(--anchor-danger-subtle)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        elevated: '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        modal: '0 20px 40px -8px rgba(0, 0, 0, 0.65)',
        dropdown: '0 8px 24px -4px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
};
