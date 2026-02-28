// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
    },
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['dist/**', 'node_modules/**'],
    rules: {
      // UI components must be pure — no server-only imports
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'fs', message: 'UI cannot use filesystem' },
          { name: 'child_process', message: 'UI cannot spawn processes' },
          { name: 'crypto', message: 'Use web crypto API instead' },
        ],
        patterns: [
          { group: ['../cli/**'], message: 'UI cannot import CLI' },
          { group: ['@requiem/cli/**'], message: 'UI cannot import CLI' },
        ],
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  }
);
