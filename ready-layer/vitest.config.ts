import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@requiem/ai/mcp': path.resolve(__dirname, '../packages/ai/src/mcp/index.ts'),
      '@requiem/ai/bootstrap': path.resolve(__dirname, '../packages/ai/src/bootstrap.ts'),
    },
  },
});
