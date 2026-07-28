import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests/release-safety.test.mjs is a separate, plain `node --test`
    // source-text-assertion suite (npm run test:release) -- keep it out of
    // vitest's own discovery so the two runners don't collide.
    include: ['src/**/*.test.ts'],
  },
});
