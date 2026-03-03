// ready-layer/tailwind.config.ts
//
// Tailwind CSS configuration for the Requiem enterprise dashboard.
// Extended with Stitch design system tokens for unified theming.

import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: "class",
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        destructive: 'rgb(var(--destructive) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        // Requiem brand palette
        requiem: {
          50:  '#f0f4ff',
          100: '#dce6fd',
          500: '#3b5bdb',
          600: '#3451c7',
          700: '#2c45b0',
          900: '#1a2a6e',
        },
        // Stitch design system tokens - ReadyLayer brand
        stitch: {
          primary: '#137fec',
          'primary-dark': '#0b5cb5',
          'background-light': '#f6f7f8',
          'background-dark': '#101922',
          'surface-dark': '#1c252e',
          'surface-darker': '#151e27',
          'border-dark': '#2a3441',
          'text-secondary': '#94a3b8',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Noto Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-in',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
