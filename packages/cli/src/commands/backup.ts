import { Command } from 'commander';
import * as path from 'path';
import { getDB } from '../db/connection.js';
import { writeJsonFile } from '../lib/io.js';

export const backup = new Command('backup')
  .description('Dump database to JSON file')
  .option('-f, --file <path>', 'Output file path', 'requiem-backup.json')
  .action((options: { file: string }) => {
    const db = getDB();
    const tables = ['decisions', 'junctions', 'action_intents'];
    const dump: Record<string, unknown[]> = {};

    console.log('📦 Starting database backup...');

    for (const table of tables) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        dump[table] = rows;
        console.log(`   • ${table}: ${rows.length} records`);
      } catch (e) {
        console.warn(`   ⚠️ Could not dump table ${table}:`, (e as Error).message);
        dump[table] = [];
      }
    }

    const outputPath = path.resolve(process.cwd(), options.file);
    writeJsonFile(outputPath, dump);
    console.log(`✅ Backup saved to: ${outputPath}`);
  });

