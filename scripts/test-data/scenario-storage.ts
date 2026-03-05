import { buildBundle, createSeededRng, exportBundle } from './generator.js';

export function generateStorageScenario(seed = 7373, count = 28): ReturnType<typeof buildBundle> {
  const rand = createSeededRng(seed);
  const records = Array.from({ length: count }, (_, i) => {
    const status = rand() > 0.9 ? 'corrupt' : 'healthy';
    return {
      object_id: `cas-${i + 1}`,
      wal_seq: i + 1000,
      bytes: Math.floor(rand() * 8192) + 256,
      checksum_match: status === 'healthy',
      status,
      lineage_depth: Math.floor(rand() * 9) + 1,
    };
  });
  return buildBundle(seed, 'storage-integrity', records);
}

if (process.argv[1]?.includes('scenario-storage')) {
  exportBundle('scripts/test-data/out-storage.json', generateStorageScenario());
}
