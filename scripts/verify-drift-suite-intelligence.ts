import fs from 'node:fs';
import path from 'node:path';

const tenantId = process.env.REQUIEM_TENANT_ID || 'default-tenant';
const signalPath = path.join(process.env.REQUIEM_INTELLIGENCE_STORE_DIR || '.requiem/intelligence', 'signals.ndjson');

const signals = fs.existsSync(signalPath)
  ? fs.readFileSync(signalPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as { tenant_id?: string; severity?: string })
    .filter((s) => s.tenant_id === tenantId)
  : [];

const critical = signals.filter((s) => s.severity === 'CRITICAL');

const report = {
  tenant_id: tenantId,
  total_signals: signals.length,
  critical_signals: critical.length,
  status: critical.length > 0 ? 'CRITICAL' : 'STABLE',
  generated_at: new Date().toISOString(),
};

const outDir = path.join('artifacts', 'reports');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'intelligence_drift_report.json'), JSON.stringify(report, null, 2));

if (critical.length > 0) {
  process.stderr.write(`CRITICAL drift signals detected: ${critical.length}\n`);
  process.exit(2);
}

process.stdout.write('verify:drift-suite passed\n');
