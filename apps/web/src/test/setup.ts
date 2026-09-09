import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not auto-clean the DOM between tests unless `globals` is enabled,
// so we unmount explicitly.
afterEach(() => {
  cleanup();
});
