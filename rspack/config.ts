import { defineConfig } from '@rspack/cli';
import { rspack, type SwcLoaderOptions, type RspackOptions } from '@rspack/core';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import { getPackageJson, getPluginJson, hasReadme, getEntries } from './utils.ts';
import path from 'path';
import { DIST_DIR } from './constants.ts';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';
import { RspackVirtualModulePlugin } from 'rspack-plugin-virtual-module';
import { BuildModeRspackPlugin } from './BuildModeRspackPlugin.ts';
import { reactCompilerConfig } from './react-compiler-config.ts';

const pluginJson = getPluginJson();

const virtualPublicPath = new RspackVirtualModulePlugin({
  'node_modules/grafana-public-path.js': `
import amdMetaModule from 'amd-module';

__webpack_public_path__ =
  amdMetaModule && amdMetaModule.uri
    ? amdMetaModule.uri.slice(0, amdMetaModule.uri.lastIndexOf('/') + 1)
    : 'public/plugins/${pluginJson.id}/';
`,
});

const config = async (env: Record<string, any>, argv: Record<string, any>) => {
  return defineConfig({
    entry: await getEntries(),
    context: path.join(process.cwd(), 'src'),
    devtool: env.production ? 'source-map' : 'eval-source-map',
    mode: env.production ? 'production' : 'development',
    externals: [
      { 'amd-module': 'module' },
      'lodash',
      'jquery',
      'moment',
      'slate',
      'emotion',
      '@emotion/react',
      '@emotion/css',
      'prismjs',
      'slate-plain-serializer',
      '@grafana/slate-react',
      'react',
      'react-dom',
      'react-redux',
      'redux',
      'rxjs',
      'react-router',
      'react-router-dom',
      'd3',
      'angular',
      /^@grafana\/ui/i,
      /^@grafana\/runtime/i,
      /^@grafana\/data/i,

      // Mark legacy SDK imports as external if their name starts with the "grafana/" prefix
      ({ request }, callback) => {
        const prefix = 'grafana/';
        const hasPrefix = (request: string) => request.indexOf(prefix) === 0;
        const stripPrefix = (request: string) => request.substring(prefix.length);

        if (request && hasPrefix(request)) {
          return callback(undefined, stripPrefix(request));
        }

        callback();
      },
    ],

    module: {
      rules: [
        {
          resolve: {
            alias: {
              'react-reconciler$': path.resolve(
                import.meta.dirname,
                '../node_modules/react-reconciler/cjs/react-reconciler.production.min.js'
              ),
            },
          },
        },
        // This must come first in the rules array otherwise it breaks sourcemaps.
        {
          test: /src\/(?:.*\/)?module\.tsx?$/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {} satisfies SwcLoaderOptions,
            },
          ],
        },
        {
          exclude: /(node_modules)/,
          test: /\.[tj]sx?$/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  baseUrl: path.resolve(import.meta.dirname, 'src'),
                  target: 'es2015',
                  loose: false,
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                    decorators: false,
                    dynamicImport: true,
                  },
                },
              },
            },
            reactCompilerConfig,
          ],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            // Keep publicPath relative for host.com/grafana/ deployments
            publicPath: `public/plugins/${pluginJson.id}/img/`,
            outputPath: 'img/',
            filename: env.production ? '[hash][ext]' : '[file]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
          generator: {
            // Keep publicPath relative for host.com/grafana/ deployments
            publicPath: `public/plugins/${pluginJson.id}/fonts/`,
            outputPath: 'fonts/',
            filename: env.production ? '[hash][ext]' : '[name][ext]',
          },
        },
      ],
    },

    output: {
      clean: {
        // It really doesn't matter if this regex syntax works. We just need to prevent rspack from deleting the directory, since it's mounted by docker.
        keep: (f) => f.endsWith('LICENSE'),
      },
      filename: '[name].js',
      chunkFilename: env.production ? '[name].js?_cache=[contenthash]' : '[name].js',
      library: {
        type: 'amd',
      },
      path: path.resolve(process.cwd(), DIST_DIR),
      publicPath: `public/plugins/${pluginJson.id}/`,
      uniqueName: pluginJson.id,
      crossOriginLoading: 'anonymous',
    },

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      // handle resolving "rootDir" paths
      modules: [path.resolve(process.cwd(), 'src'), 'node_modules'],
    },

    plugins: [
      new BuildModeRspackPlugin(),
      virtualPublicPath,
      new rspack.CopyRspackPlugin({
        patterns: [
          // If src/README.md exists use it; otherwise the root README
          // To `compiler.options.output`
          {
            from: hasReadme() ? 'README.md' : '../README.md',
            to: '.',
            force: true,
          },
          { from: 'plugin.json', to: '.' },
          { from: '../LICENSE', to: '.' },
          { from: '../CHANGELOG.md', to: '.', force: true },
          { from: '**/*.json', to: '.' }, // TODO<Add an error for checking the basic structure of the repo>
          { from: '**/*.svg', to: '.', noErrorOnMissing: true }, // Optional
          { from: '**/*.png', to: '.', noErrorOnMissing: true }, // Optional
          { from: '**/*.html', to: '.', noErrorOnMissing: true }, // Optional
          { from: 'img/**/*', to: '.', noErrorOnMissing: true }, // Optional
          { from: 'libs/**/*', to: '.', noErrorOnMissing: true }, // Optional
          { from: 'static/**/*', to: '.', noErrorOnMissing: true }, // Optional
        ],
      }),
      // Replace certain template-variables in the README and plugin.json
      new ReplaceInFileWebpackPlugin([
        {
          dir: DIST_DIR,
          files: ['plugin.json', 'README.md'],
          rules: [
            {
              search: /\%VERSION\%/g,
              replace: getPackageJson().version,
            },
            {
              search: /\%TODAY\%/g,
              replace: new Date().toISOString().substring(0, 10),
            },
            {
              search: /\%PLUGIN_ID\%/g,
              replace: pluginJson.id,
            },
          ],
        },
      ]),
      ...(env.development
        ? [
            new TsCheckerRspackPlugin({
              async: Boolean(env.development),
              issue: {
                include: [{ file: '**/*.{ts,tsx}' }],
              },
              typescript: {
                configFile: path.join(process.cwd(), 'tsconfig.json'),
              },
            }),
            new ESLintPlugin({
              extensions: ['.ts', '.tsx'],
              lintDirtyModulesOnly: Boolean(env.development), // don't lint on start, only lint changed files
            }),
          ]
        : []),
    ],
  }) satisfies RspackOptions;
};

export default config;
