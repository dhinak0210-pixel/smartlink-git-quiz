import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0D1117',
        surface: '#161B22',
        'surface-hover': '#21262D',
        'surface-border': '#30363D',
        text: '#E6EDF3',
        'text-muted': '#8B949E',
        git: {
          orange: '#F97316',
          dark: '#EA580C',
          light: '#FB923C',
        },
        correct: '#3FB950',
        wrong: '#F85149',
        warning: '#D29922',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
