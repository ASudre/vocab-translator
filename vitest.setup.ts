import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // Guarded: files using `// @vitest-environment node` (e.g. the data
  // contract test) have no localStorage global at all.
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
