import fs from 'node:fs';
import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import { readdirSync, statSync, existsSync } from 'node:fs';
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

function findPluginJsonFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const fullPath = path.join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else if (entry === 'plugin.json') {
          const rel = path.relative(process.cwd(), fullPath);
          const parts = rel.split(/[/\\]/);
          if (parts.includes('src')) results.push(fullPath);
        }
      } catch {
        // skip unreadable entries
      }
    }
  }
  walk(process.cwd());
  return results;
}

const MODULE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function findModuleFile(folder: string): string | undefined {
  for (const ext of MODULE_EXTENSIONS) {
    const file = path.join(folder, `module${ext}`);
    if (existsSync(file)) return file;
  }
  return undefined;
}

// Support bundling nested plugins by finding all plugin.json files in src directory
// then checking for a sibling module.[jt]sx? file.
export async function getEntries(): Promise<Record<string, string>> {
  const pluginsJson = findPluginJsonFiles();

  const entries: Record<string, string> = {};
  for (const pluginJson of pluginsJson) {
    const folder = path.dirname(pluginJson);
    const moduleFile = findModuleFile(folder);
    if (!moduleFile) continue;
    const pluginPath = path.dirname(moduleFile);
    const pluginName = path.relative(process.cwd(), pluginPath).replace(/src\/?/i, '');
    const entryName = pluginName === '' ? 'module' : `${pluginName}/module`;
    entries[entryName] = moduleFile;
  }
  return entries;
}
