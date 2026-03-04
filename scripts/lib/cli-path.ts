import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CliResolution {
  command: string;
  source: 'workspace-build' | 'path';
  candidates: string[];
}

export function resolveCliPath(rootDir: string): CliResolution {
  const candidates = [
    path.join(rootDir, 'build', 'Release', 'requiem.exe'),
    path.join(rootDir, 'build', 'Release', 'requiem'),
    path.join(rootDir, 'build', 'Debug', 'requiem.exe'),
    path.join(rootDir, 'build', 'Debug', 'requiem'),
    path.join(rootDir, 'build', 'requiem.exe'),
    path.join(rootDir, 'build', 'requiem'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { command: candidate, source: 'workspace-build', candidates };
    }
  }

  return { command: 'requiem', source: 'path', candidates };
}
