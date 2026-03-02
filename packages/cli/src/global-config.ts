import path from 'path';
import os from 'os';
import { readJsonFile, writeJsonFile } from './lib/io.js';

const CONFIG_DIR = path.join(os.homedir(), '.requiem');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface GlobalConfig {
  defaultTenantId?: string;
  engineMode?: 'ts' | 'requiem';
  [key: string]: unknown;
}

export function readConfig(): GlobalConfig {
  return readJsonFile<GlobalConfig>(CONFIG_FILE) || {};
}

export function writeConfig(config: GlobalConfig) {
  writeJsonFile(CONFIG_FILE, config);
}

export function setConfigValue(key: string, value: unknown) {
  const config = readConfig();
  config[key] = value;
  writeConfig(config);
}

export function getConfigValue(key: string): unknown {
  const config = readConfig();
  return config[key];
}

