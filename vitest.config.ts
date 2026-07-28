import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Metro/Expo resolve the '@/*' alias from tsconfig.json's `paths`
    // automatically; Vitest doesn't, so it needs to be declared here too.
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  test: {
    // tests/release-safety.test.mjs is a separate, plain `node --test`
    // source-text-assertion suite (npm run test:release) -- keep it out of
    // vitest's own discovery so the two runners don't collide.
    include: ['src/**/*.test.ts'],
  },
});
