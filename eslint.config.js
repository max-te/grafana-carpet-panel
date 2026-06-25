import grafanaConfig from '@grafana/eslint-config';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import reactCompiler from 'eslint-plugin-react-compiler';
import eslint from '@eslint/js';

export default tseslint.config(
  ...grafanaConfig,
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
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
    rules: {
      'react/prop-types': 'off',
    },
  },
  {
    rules: {},
  }
);
