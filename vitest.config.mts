import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['lib/**', 'hooks/**', 'app/**'],
      // The data-contract test is deliberately red until the `ordinal`
      // word-class translation gap is fixed (see tests/data/vocabulary.test.ts);
      // still emit a coverage report while that's the case.
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
});
