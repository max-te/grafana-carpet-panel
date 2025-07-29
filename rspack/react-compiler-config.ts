import type { SourceLocation as BabelSourceLocation } from '@babel/types';
import type { SourceLocation } from 'babel-plugin-react-compiler';
import { consola } from 'consola';
import { type ReactCompilerConfig, reactCompilerLoader } from 'react-compiler-webpack';

function formatSite(file: string, loc?: SourceLocation | null): string {
  if (!loc) return file;
  if (loc instanceof Symbol) return '<generated source code>';
  const {
    identifierName,
    filename,
    start: { line, column },
  } = loc as BabelSourceLocation;
  const identifier = identifierName ? `${identifierName} (` : '';
  const identifierEnd = identifierName ? `)` : '';
  return `${identifier}${filename || file}:${line.toFixed(0)}:${column.toFixed(0)}${identifierEnd}`;
}

export const reactCompilerConfig = {
  loader: reactCompilerLoader,
  options: {
    target: '17',
    panicThreshold: 'all_errors',
    compilationMode: 'annotation',
    logger: {
      logEvent(filename, event) {
        const file = filename ? filename : '<unknown file>';
        switch (event.kind) {
          case 'CompileError': {
            const err = new Error(
              `${event.detail.severity}: ${event.detail.reason}. ${event.detail.description || ''}`
            );
            err.name = event.detail.severity;
            err.stack =
              `${event.detail.severity}: ${event.detail.reason}` +
              `\n    at ${event.detail.loc ? formatSite(file, event.detail.loc) : file}` +
              (event.fnLoc ? `\n    at ${formatSite(file, event.fnLoc)}` : '');
            consola.warn(err);

            if (event.detail.suggestions) {
              consola.debug('Suggestions:', event.detail.suggestions);
            }
            break;
          }
          case 'PipelineError': {
            consola.error('react-compiler pipeline error', event);
            break;
          }
          case 'CompileSuccess': {
            const siteInFile =
              event.fnName || event.fnLoc?.identifierName || event.fnLoc?.start.line.toFixed(0) || '<unknown function>';
            consola.success('react-compiler compiled', `${file}:${siteInFile}`);
            break;
          }
          case 'CompileSkip': {
            consola.debug('react-compiler compile skip', file, event.reason);
            break;
          }
        }
      },
    },
  } as Partial<ReactCompilerConfig>,
  // Partial<...> because babel-plugin-react-compiler does not mark optional properties as optional
};
