/**
 * @fileoverview Cross-platform path resolver for Requiem
 * 
 * Handles path resolution across different platforms (Windows, Linux, macOS).
 * Provides consistent path handling for:
 * - Config files
 * - Data directories
 * - CAS storage
 * - Logs
 */

import path from 'path';
import os from 'os';
import { homedir } from 'os';

export interface PathConfig {
  configDir: string;
  dataDir: string;
  casDir: string;
  logDir: string;
  cacheDir: string;
}

const DEFAULT_CONFIG_DIR = path.join(homedir(), '.requiem');
const DEFAULT_DATA_DIR = path.join(DEFAULT_CONFIG_DIR, 'data');
const DEFAULT_CAS_DIR = path.join(DEFAULT_DATA_DIR, 'cas');
const DEFAULT_LOG_DIR = path.join(DEFAULT_CONFIG_DIR, 'logs');
const DEFAULT_CACHE_DIR = path.join(DEFAULT_CONFIG_DIR, 'cache');

/**
 * Get the platform-specific path separator
 */
export function getPathSeparator(): string {
  return path.sep;
}

/**
 * Normalize a path for the current platform
 */
export function normalizePath(inputPath: string): string {
  return path.normalize(inputPath);
}

/**
 * Join path segments (cross-platform)
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Get absolute path (cross-platform)
 */
export function resolvePath(...segments: string[]): string {
  return path.resolve(...segments);
}

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(inputPath: string): boolean {
  return path.isAbsolute(inputPath);
}

/**
 * Get the relative path between two paths
 */
export function relativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Get the file extension
 */
export function getExtension(inputPath: string): string {
  return path.extname(inputPath);
}

/**
 * Get the base name of a file
 */
export function getBaseName(inputPath: string, ext?: string): string {
  return path.basename(inputPath, ext);
}

/**
 * Get the directory name of a path
 */
export function getDirName(inputPath: string): string {
  return path.dirname(inputPath);
}

/**
 * Create the default path configuration
 */
export function getDefaultPathConfig(): PathConfig {
  return {
    configDir: DEFAULT_CONFIG_DIR,
    dataDir: DEFAULT_DATA_DIR,
    casDir: DEFAULT_CAS_DIR,
    logDir: DEFAULT_LOG_DIR,
    cacheDir: DEFAULT_CACHE_DIR,
  };
}

/**
 * Create path config from environment variables or defaults
 */
export function getPathConfigFromEnv(): PathConfig {
  return {
    configDir: process.env.REQUIEM_CONFIG_DIR || DEFAULT_CONFIG_DIR,
    dataDir: process.env.REQUIEM_DATA_DIR || DEFAULT_DATA_DIR,
    casDir: process.env.REQUIEM_CAS_DIR || DEFAULT_CAS_DIR,
    logDir: process.env.REQUIEM_LOG_DIR || DEFAULT_LOG_DIR,
    cacheDir: process.env.REQUIEM_CACHE_DIR || DEFAULT_CACHE_DIR,
  };
}

/**
 * Ensure a directory exists (creates if not)
 */
export function ensureDir(dirPath: string): void {
  const fs = require('fs');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the platform name
 */
export function getPlatform(): 'windows' | 'linux' | 'darwin' | 'unknown' {
  const platform = os.platform();
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'darwin';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return getPlatform() === 'darwin';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

/**
 * Convert Windows path to cross-platform compatible path
 * (for storage/serialization)
 */
export function toCrossPlatformPath(windowsPath: string): string {
  return windowsPath.replace(/\\/g, '/');
}

/**
 * Convert cross-platform path to Windows-compatible path
 * (for display/local operations)
 */
export function toNativePath(crossPlatformPath: string): string {
  if (isWindows()) {
    return crossPlatformPath.replace(/\//g, path.sep);
  }
  return crossPlatformPath;
}

/**
 * Get the temp directory for the current platform
 */
export function getTempDir(): string {
  return os.tmpdir();
}

/**
 * Get the home directory for the current user
 */
export function getHomeDir(): string {
  return homedir();
}

export default {
  getPathSeparator,
  normalizePath,
  joinPath,
  resolvePath,
  isAbsolutePath,
  relativePath,
  getExtension,
  getBaseName,
  getDirName,
  getDefaultPathConfig,
  getPathConfigFromEnv,
  ensureDir,
  getPlatform,
  isWindows,
  isMacOS,
  isLinux,
  toCrossPlatformPath,
  toNativePath,
  getTempDir,
  getHomeDir,
};
