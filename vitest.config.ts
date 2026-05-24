import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    server: {
      deps: {
        inline: ['@grafana/data', '@grafana/runtime', '@grafana/ui'],
      },
    },
  },
});
