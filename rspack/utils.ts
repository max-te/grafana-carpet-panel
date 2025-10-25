import fs from 'node:fs';
import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
// import { Glob } from 'bun';
import { SOURCE_DIR } from './constants.ts';

export function isWSL() {
  if (process.platform !== 'linux') {
    return false;
  }

  if (os.release().toLowerCase().includes('microsoft')) {
    return true;
  }

  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

export function getPackageJson() {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
}

export function getPluginJson() {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `${SOURCE_DIR}/plugin.json`), 'utf8'));
}

export function hasReadme() {
  return fs.existsSync(path.resolve(process.cwd(), SOURCE_DIR, 'README.md'));
}

async function glob(pattern: string, opts?: { absolute: boolean }) {
  return new Promise((resolve, reject) => {
    fs.glob(pattern, (err, matches) => {
      if (err) reject(err);
      if (opts?.absolute) resolve(matches.map((p) =>  path.resolve(process.cwd(), p)))
      else resolve(matches)
    }
    )
  })
}

// Support bundling nested plugins by finding all plugin.json files in src directory
// then checking for a sibling module.[jt]sx? file.
export async function getEntries(): Promise<Record<string, string>> {
  const pluginsJson = await glob('**/src/**/plugin.json', { absolute: true });

  const plugins = await Promise.all(
    pluginsJson.map((pluginJson) => {
      const folder = path.dirname(pluginJson);
      return glob(`${folder}/module.{ts,tsx,js,jsx}`, { absolute: true });
    })
  );

  return plugins.reduce(
    (result, modules) => {
      return modules.reduce((result, module) => {
        const pluginPath = path.dirname(module);
        const pluginName = path.relative(process.cwd(), pluginPath).replace(/src\/?/i, '');
        const entryName = pluginName === '' ? 'module' : `${pluginName}/module`;

        result[entryName] = module;
        return result;
      }, result);
    },
    {} as Record<string, string>
  );
}
