/**
 * Artifact Store (CAS-shadow)
 *
 * Implements "JSON Collapse":
 * - Deduplicate large JSON blobs into hash-addressed files.
 * - Store references (refs) in the database.
 */

import fs from 'fs';
import path from 'path';
import { getPathConfigFromEnv, ensureDir } from '../lib/paths.js';
import { hash } from '../lib/hash.js';
import { logger } from '../core/index.js';

const COLLAPSE_THRESHOLD = 64 * 1024; // 64KB

export class ArtifactStore {
  /**
   * Store a blob and return a ref if it exceeds threshold
   */
  static collapseSync(data: string | object): string {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);

    if (raw.length < COLLAPSE_THRESHOLD) {
      return raw;
    }

    const digest = hash(raw);
    const paths = getPathConfigFromEnv();
    const artifactsDir = path.join(paths.casDir, 'artifacts');
    const subdir = digest.substring(0, 2);
    const finalDir = path.join(artifactsDir, subdir);
    const filePath = path.join(finalDir, digest);

    if (fs.existsSync(filePath)) {
      return `cas:${digest}`;
    }

    ensureDir(finalDir);
    fs.writeFileSync(filePath, raw);

    logger.debug('db.artifact_collapsed', `Collapsed large JSON into artifact: ${digest}`, {
      size: raw.length,
      threshold: COLLAPSE_THRESHOLD
    });

    return `cas:${digest}`;
  }

  /**
   * Expand a ref back into a string
   */
  static expand(ref: string | null): string | null {
    if (!ref || !ref.startsWith('cas:')) {
      return ref;
    }

    const digest = ref.substring(4);
    const paths = getPathConfigFromEnv();
    const artifactsDir = path.join(paths.casDir, 'artifacts');
    const subdir = digest.substring(0, 2);
    const filePath = path.join(artifactsDir, subdir, digest);

    if (!fs.existsSync(filePath)) {
      logger.error('db.artifact_missing', `Referenced artifact missing from CAS: ${digest}`);
      return null;
    }

    return fs.readFileSync(filePath, 'utf-8');
  }
}
