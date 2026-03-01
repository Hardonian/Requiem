import { Command } from 'commander';
import * as path from 'path';
import { getDB } from '../db/connection';
import { readJsonFile, fileExists } from '../lib/io';

export const restore = new Command('restore')
  .description('Restore database from JSON backup')
  .option('-f, --file <path>', 'Backup file path', 'requiem-backup.json')
  .option('--clean', 'Clear database before restoring')
  .action((options: { file: string; clean?: boolean }) => {
    const db = getDB();
    const inputPath = path.resolve(process.cwd(), options.file);

    if (!fileExists(inputPath)) {
      console.error(`❌ Backup file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log(`📦 Restoring from ${inputPath}...`);

    try {
      const dump = readJsonFile<Record<string, Record<string, unknown>[]>>(inputPath);
      if (!dump) throw new Error('Failed to parse backup file');

      const tables = ['decisions', 'junctions', 'action_intents'];

      if (options.clean) {
        console.log('   🧹 Clearing existing data...');
        for (const table of tables) {
          db.prepare(`DELETE FROM ${table}`).run();
        }
      }

      for (const table of tables) {
        if (dump[table] && Array.isArray(dump[table])) {
          const rows = dump[table];
          console.log(`   • ${table}: Restoring ${rows.length} records...`);

          let success = 0;
          let fail = 0;

          for (const row of rows) {
            try {
              const keys = Object.keys(row);
              if (keys.length === 0) continue;

              const cols = keys.join(', ');
              // Create placeholders to satisfy the SQL parser
              const placeholders = keys.map(() => '?').join(', ');

              const stmt = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
              stmt.run(Object.values(row));
              success++;
            } catch (e) {
              fail++;
            }
          }
          console.log(`     ✅ ${success} inserted, ${fail} failed`);
        }
      }

      console.log('✅ Restore complete.');
    } catch (e) {
      console.error('❌ Restore failed:', (e as Error).message);
      process.exit(1);
    }
  });
