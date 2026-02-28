// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    files: ['src/**/*.ts'],
    ignores: ['dist/**', 'node_modules/**'],
    rules: {
      // Boundary enforcement: core must not import server/web
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'fs', message: 'Use centralized IO in lib/ only' },
          { name: 'child_process', message: 'Use engine adapter only' },
        ],
        patterns: [
          { group: ['../ready-layer/**'], message: 'CLI cannot import ready-layer' },
        ],
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  }
);
