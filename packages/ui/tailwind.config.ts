import type { Config } from 'tailwindcss/types/config'

/**
 * Requiem UI Design System - Tailwind Configuration
 * 
 * HARVESTED_FROM: ReadyLayer/tailwind.config.ts
 * EXTENSION_POINT: Add new theme tokens in extend.colors, extend.boxShadow
 */

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // TEXT TOKENS - Clear hierarchy
        text: {
          primary: 'hsl(var(--text))',
          muted: 'hsl(var(--text-muted))',
          subtle: 'hsl(var(--text-subtle))',
          inverse: 'hsl(var(--text-inverse))',
        },

        // BORDER TOKENS
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: 'hsl(var(--border))',
          strong: 'hsl(var(--border-strong))',
        },

        // RING TOKEN
        ring: {
          DEFAULT: 'hsl(var(--ring))',
          focus: 'hsl(var(--ring))',
        },

        // ACCENT / BRAND TOKENS
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          hover: 'hsl(var(--accent-hover))',
          muted: 'hsl(var(--accent-muted))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        // PRIMARY VARIANTS
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          light: 'hsl(var(--primary-light))',
          dark: 'hsl(var(--primary-dark))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        // SURFACE SYSTEM - Layered elevation
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
          raised: 'hsl(var(--surface-raised))',
          overlay: 'hsl(var(--surface-overlay))',
          hover: 'hsl(var(--surface-hover))',
          dark: 'hsl(var(--surface-dark))',
          code: 'hsl(var(--surface-code))',
        },

        // STATUS TOKENS
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          muted: 'hsl(var(--success-muted))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          muted: 'hsl(var(--warning-muted))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))',
          muted: 'hsl(var(--danger-muted))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          muted: 'hsl(var(--info-muted))',
        },

        // LEGACY COMPATIBILITY
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        input: 'hsl(var(--input))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // CHART COLORS - WCAG AA compliant
        chart: {
          primary: '#4F46E5',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          default: '#4F46E5',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Inter', 'sans-serif'],
        body: ['var(--font-body)', 'Noto Sans', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        DEFAULT: 'var(--radius)',
      },
      boxShadow: {
        'surface-flat': 'none',
        'surface-raised': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'surface-overlay': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'glow': '0 0 40px -10px rgba(29, 100, 237, 0.3)',
        'glow-green': '0 0 40px -10px rgba(19, 236, 91, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
