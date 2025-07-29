import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import reactCompiler from 'eslint-plugin-react-compiler';

/**
 * @type {import("typescript-eslint").ConfigArray}
 **/
const config = tseslint.config(
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
    // ESLint
    rules: {},
  },
  // TypeScript
  {
    rules: {},
  }
);

export default config;
