import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.requiem');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface GlobalConfig {
  defaultTenantId?: string;
  engineMode?: 'ts' | 'requiem';
  [key: string]: unknown;
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readConfig(): GlobalConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return {};
  }
}

export function writeConfig(config: GlobalConfig) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
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
