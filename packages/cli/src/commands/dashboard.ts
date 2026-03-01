import { Command } from 'commander';
import * as http from 'http';
import * as path from 'path';
import { DecisionRepository } from '../db/decisions';

export const dashboard = new Command('dashboard')
  .description('Launch the local telemetry dashboard')
  .option('-p, --port <number>', 'Port to run dashboard on', '3000')
  .action(async (options: { port: string }) => {
    const port = parseInt(options.port, 10);

    const server = http.createServer((req, res) => {
      if (req.url === '/api/stats') {
        const stats = DecisionRepository.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
        return;
      }

      if (req.url === '/api/recent') {
        const recent = DecisionRepository.list(10);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(recent));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getDashboardHtml());
    });

    server.listen(port, () => {
      console.log(`\n🚀 Requiem Dashboard running at http://localhost:${port}`);
      console.log('Press Ctrl+C to stop.\n');
    });
  });

function getDashboardHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Requiem Telemetry Dashboard</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .card { background: #1e293b; padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #334155; }
        .label { color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem; }
        .value { font-size: 1.5rem; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 0.5rem; overflow: hidden; }
        th { text-align: left; padding: 1rem; background: #334155; color: #94a3b8; font-weight: 500; }
        td { padding: 1rem; border-top: 1px solid #334155; }
        .status { padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; }
        .status-evaluated { background: #065f46; color: #34d399; }
        .status-pending { background: #92400e; color: #fbbf24; }
    </style>
</head>
<body>
    <h1 style="margin-bottom: 2rem">📊 Requiem Live Telemetry</h1>

    <div class="grid" id="stats">
        <div class="card"><div class="label">Total Decisions</div><div class="value" id="total">0</div></div>
        <div class="card"><div class="label">Avg Latency</div><div class="value" id="latency">0ms</div></div>
        <div class="card"><div class="label">Total Cost</div><div class="value" id="cost">$0.00</div></div>
        <div class="card"><div class="label">Success Rate</div><div class="value" id="rate">0%</div></div>
    </div>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Tenant</th>
                <th>Model / Source</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Created</th>
            </tr>
        </thead>
        <tbody id="recent"></tbody>
    </table>

    <script>
        async function refresh() {
            const statsRes = await fetch('/api/stats');
            const stats = await statsRes.json();
            document.getElementById('total').textContent = stats.total_decisions;
            document.getElementById('latency').textContent = stats.avg_latency_ms.toFixed(1) + 'ms';
            document.getElementById('cost').textContent = '$' + stats.total_cost_usd.toFixed(4);
            document.getElementById('rate').textContent = (stats.success_rate * 100).toFixed(1) + '%';

            const recentRes = await fetch('/api/recent');
            const recent = await recentRes.json();
            const body = document.getElementById('recent');
            body.innerHTML = recent.map(r => \`
                <tr>
                    <td style="font-family: monospace">\${r.id.substring(0,8)}</td>
                    <td>\${r.tenant_id}</td>
                    <td>\${r.source_ref}</td>
                    <td><span class="status status-\${r.status}">\${r.status}</span></td>
                    <td>\${r.execution_latency}ms</td>
                    <td style="color: #94a3b8">\${new Date(r.created_at).toLocaleTimeString()}</td>
                </tr>
            \`).join('');
        }
        refresh();
        setInterval(refresh, 5000);
    </script>
</body>
</html>
  \`;
}
