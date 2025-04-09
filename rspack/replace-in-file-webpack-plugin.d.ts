declare module 'replace-in-file-webpack-plugin' {
  import webpack from 'webpack';

  interface Rule {
    /**
     * A search pattern - can be a string or RegExp
     */
    search: string | RegExp;
    /**
     * A replacement string or function that returns a string
     */
    replace: string | ((substring: string, ...args: any[]) => string);
  }

  interface PluginOptions {
    /**
     * Base directory for files. Defaults to webpack context
     */
    dir?: string;
    /**
     * Specific files to process (relative to dir)
     */
    files?: string[];
    /**
     * RegExp pattern(s) to test files against
     */
    test?: RegExp | RegExp[];
    /**
     * Rules for search and replace operations
     */
    rules: Rule[];
  }

  /**
   * Webpack plugin to replace content in files after the build
   */
  class ReplaceInFilePlugin {
    constructor(options?: PluginOptions[]);
    /**
     * Apply the plugin to the webpack compiler
     */
    apply(compiler: webpack.Compiler): void;
  }

  export = ReplaceInFilePlugin;
}