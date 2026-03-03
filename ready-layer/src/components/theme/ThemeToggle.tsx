'use client';

import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const activeTheme = theme === 'system' ? resolvedTheme : theme;

  return (
    <button
      type="button"
      onClick={() => setTheme(activeTheme === 'dark' ? 'light' : 'dark')}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      aria-label="Toggle light and dark mode"
    >
      {activeTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
}
