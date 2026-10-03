import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    env: {
      "I18NEXT_NO_SUPPORT_NOTICE": "1"
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    server: {
      deps: {
        inline: ['@grafana/data', '@grafana/runtime', '@grafana/ui'],
      },
    },
  },
});
