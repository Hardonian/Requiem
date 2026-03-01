import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { getDB } from '../db/connection';

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
    fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));
    console.log(`✅ Backup saved to: ${outputPath}`);
  });

