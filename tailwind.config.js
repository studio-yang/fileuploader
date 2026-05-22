/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      colors: {
        violet: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
        pink:   { 400: '#f472b6', 500: '#ec4899' },
        cyan:   { 400: '#22d3ee', 500: '#06b6d4' },
        lime:   { 400: '#a3e635', 500: '#84cc16' },
        amber:  { 400: '#fbbf24', 500: '#f59e0b' },
        coral:  { 400: '#fb7185', 500: '#f43f5e' },
      },
    },
  },
  plugins: [],
};
