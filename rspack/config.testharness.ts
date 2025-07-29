import { defineConfig } from '@rspack/cli';
import { rspack, type RspackOptions } from '@rspack/core';
import path from 'path';
import { defineReactCompilerLoaderOption, reactCompilerLoader } from 'react-compiler-webpack';

const config = async (env: Record<string, any>, argv: Record<string, any>) => {
  return defineConfig({
    entry: path.resolve(process.cwd(), 'testsupport/index.tsx'),
    context: path.join(process.cwd(), 'testsupport'),
    devtool: 'eval-source-map',
    mode: 'development',
    devServer: {
      watchFiles: 'src',
    },
    module: {
      rules: [
        {
          resolve: {
            alias: {
              'react-loading-skeleton': path.resolve(
                import.meta.dirname,
                '../node_modules/react-loading-skeleton/dist/index.js'
              ),
            },
          },
        },
        {
          exclude: /(node_modules)/,
          test: /\.[tj]sx?$/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
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
            {
              loader: reactCompilerLoader,
              options: defineReactCompilerLoaderOption({
                target: '17',
                // React Compiler options goes here
              }),
            },
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
            publicPath: 'img/',
            outputPath: 'img/',
            filename: env.production ? '[hash][ext]' : '[file]',
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
          generator: {
            publicPath: 'fonts/',
            outputPath: 'fonts/',
            filename: env.production ? '[hash][ext]' : '[name][ext]',
          },
        },
      ],
    },
    output: {
      filename: 'index.js',
      clean: true,
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      modules: [path.resolve(process.cwd(), 'testsupport'), 'node_modules'],
    },
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: path.resolve(process.cwd(), 'testsupport/index.html'),
        filename: 'index.html',
      }),
    ],
  }) satisfies RspackOptions;
};

export default config;
