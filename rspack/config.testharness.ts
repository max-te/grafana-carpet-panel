import { defineConfig } from '@rspack/cli';
import { rspack, type RspackOptions } from '@rspack/core';
import path from 'path';
import { reactCompilerConfig } from './react-compiler-config.ts';

const config = async (env: Record<string, any>, argv: Record<string, any>) => {
  return defineConfig({
    entry: './testsupport/index.tsx',
    context: path.resolve(import.meta.dirname, '..'),
    devtool: 'inline-source-map',
    mode: 'development',
    watchOptions: {
      poll: true,
    },
    devServer: {
      setupMiddlewares: (middlewares, devServer) => {
        middlewares.push({
          name: 'fonts',
          path: '/public/fonts/inter',
          middleware: async (req, res) => {
            res.statusCode = 302;
            res.setHeader('Location', 'https://fonts.gstatic.com/s/inter/v19/UcCo3FwrK3iLTcviYwY.woff2');
            res.end();
          },
        });
        return middlewares;
      },
    },
    module: {
      rules: [
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
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      tsConfig: "./tsconfig.json"
    },
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: './testsupport/index.html',
      }),
    ],
  }) satisfies RspackOptions;
};

export default config;
