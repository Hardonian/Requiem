/* eslint-disable no-restricted-imports */
import fs from 'fs';
import path from 'path';

/**
 * Centralized IO Utility
 *
 * This is the ONLY place where the 'fs' module should be imported directly.
 * All other modules must use these wrappers to ensure auditability and policy enforcement.
 */

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeTextFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!fileExists(filePath)) return null;
  try {
    return JSON.parse(readTextFile(filePath)) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  writeTextFile(filePath, JSON.stringify(data, null, 2));
}

export function deleteFile(filePath: string): void {
  if (fileExists(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function readDir(dirPath: string): string[] {
  return fs.readdirSync(dirPath);
}

export function statFile(filePath: string): fs.Stats {
  return fs.statSync(filePath);
}

export function isDirectory(filePath: string): boolean {
  return fs.statSync(filePath).isDirectory();
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
