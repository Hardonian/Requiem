import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { DecisionRepository } from '../db/decisions';
import { hash } from '../lib/hash';

export const importCommand = new Command('import')
  .description('Ingest decision logs from an external CSV file')
  .argument('<file>', 'Path to CSV file')
  .option('--tenant <id>', 'Default tenant ID if missing in CSV')
  .action((file: string, options: { tenant?: string }) => {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`📖 Reading ${filePath}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

    if (lines.length < 2) {
      console.error('❌ CSV file must have a header row and at least one data row.');
      process.exit(1);
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1);

    console.log(`Processing ${rows.length} rows...`);
    let success = 0;
    let failed = 0;

    for (const rowStr of rows) {
      try {
        const values = parseCsvLine(rowStr);
        const row: Record<string, string> = {};

        headers.forEach((h, i) => {
          if (i < values.length) row[h] = values[i];
        });

        const tenantId = row['tenant_id'] || options.tenant;
        if (!tenantId) throw new Error('Missing tenant_id');

        const input = tryParse(row['decision_input'] || '{}');
        const output = tryParse(row['decision_output'] || '{}');

        DecisionRepository.create({
          tenant_id: tenantId,
          source_type: row['source_type'] || 'csv_import',
          source_ref: row['source_ref'] || 'unknown',
          input_fingerprint: row['input_fingerprint'] || hash(JSON.stringify(input)),
          decision_input: input,
          decision_output: output,
          status: (row['status'] as any) || 'evaluated',
          execution_latency: row['execution_latency'] ? parseFloat(row['execution_latency']) : undefined,
          outcome_status: (row['outcome_status'] as any) || null
        });
        success++;
      } catch (e) {
        failed++;
      }
    }

    console.log(`✅ Import complete: ${success} imported, ${failed} failed.`);
  });

function tryParse(str: string) {
  try { return JSON.parse(str); } catch { return { raw: str }; }
}

function parseCsvLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
}
