import grafanaConfig from '@grafana/eslint-config';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import eslint from '@eslint/js';

export default tseslint.config(
  ...grafanaConfig,
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  eslintReact.configs['recommended-typescript'],
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {},
  },
  {
    settings: {
      // eslint-plugin-react's "detect" calls context.getFilename, which ESLint 10 removed
      react: { version: '19.2' },
    },
    rules: {
      'react/prop-types': 'off',
    },
  },
  {
    rules: {},
  }
);
