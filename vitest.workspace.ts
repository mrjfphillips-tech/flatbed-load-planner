import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'shared',
      root: './packages/shared',
      globals: true,
      environment: 'node',
    },
  },
  {
    test: {
      name: 'backend',
      root: './packages/backend',
      globals: true,
      environment: 'node',
    },
  },
  {
    test: {
      name: 'frontend',
      root: './packages/frontend',
      globals: true,
      environment: 'jsdom',
    },
  },
]);
