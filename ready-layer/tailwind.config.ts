// ready-layer/tailwind.config.ts
//
// Tailwind CSS configuration for the Requiem enterprise dashboard.

import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Requiem brand palette
        requiem: {
          50:  '#f0f4ff',
          100: '#dce6fd',
          500: '#3b5bdb',
          600: '#3451c7',
          700: '#2c45b0',
          900: '#1a2a6e',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-in',
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
