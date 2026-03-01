import { Command } from 'commander';
import http from 'http';
import { DecisionRepository } from '../db/decisions';

export const dashboard = new Command('dashboard')
  .description('Launch local telemetry dashboard')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .action(async (options: { port: string }) => {
    const port = parseInt(options.port, 10);

    const server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://localhost:${port}`);

      try {
        if (url.pathname === '/api/stats') {
          const stats = DecisionRepository.getStats();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(stats));
          return;
        }

        if (url.pathname === '/api/decisions') {
          const limit = parseInt(url.searchParams.get('limit') || '50', 10);
          const decisions = DecisionRepository.list({ limit });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(decisions));
          return;
        }

        if (url.pathname.startsWith('/api/decisions/')) {
          const id = url.pathname.split('/').pop();
          if (id) {
            const decision = DecisionRepository.findById(id);
            if (decision) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(decision));
              return;
            }
          }
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        if (url.pathname === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(getDashboardHtml());
          return;
        }

        res.writeHead(404);
        res.end('Not found');
      } catch (e) {
        console.error(e);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });

    server.listen(port, () => {
      console.log(`\n📊 Requiem Dashboard running at http://localhost:${port}`);
      console.log('   Hit Ctrl+C to stop server');
    });
  });

function getDashboardHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Requiem Dashboard</title>
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #3b82f6; --border: #334155; }
    body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: var(--card); padding: 20px; border-radius: 8px; border: 1px solid var(--border); }
    .stat-value { font-size: 2em; font-weight: bold; color: var(--accent); }
    .stat-label { color: #94a3b8; font-size: 0.9em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--border); }
    th { color: #94a3b8; font-weight: 600; }
    tr:hover { background: #334155; cursor: pointer; }
    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 600; }
    .status-success { background: #059669; color: #d1fae5; }
    .status-failure { background: #dc2626; color: #fee2e2; }
    .status-evaluated { background: #2563eb; color: #dbeafe; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); }
    .modal-content { background: var(--card); margin: 5% auto; padding: 20px; width: 80%; max-height: 90vh; overflow-y: auto; border-radius: 8px; }
    pre { background: #0f172a; padding: 10px; border-radius: 4px; overflow-x: auto; }
    .close { float: right; cursor: pointer; font-size: 1.5em; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h1>Requiem Control Plane</h1>
      <button onclick="refresh()" style="padding: 8px 16px; background: var(--accent); border: none; color: white; border-radius: 4px; cursor: pointer;">Refresh</button>
    </div>

    <div class="grid" id="stats"></div>

    <div class="card">
      <h2 style="margin-top: 0;">Recent Decisions</h2>
      <table id="decisions">
        <thead>
          <tr><th>ID</th><th>Timestamp</th><th>Source</th><th>Status</th><th>Latency</th><th>Cost</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <div id="detailModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal()">&times;</span>
      <h2 id="modalTitle">Decision Details</h2>
      <div id="modalBody"></div>
    </div>
  </div>

  <script>
    async function fetchStats() {
      const res = await fetch('/api/stats');
      const data = await res.json();
      document.getElementById('stats').innerHTML = \`
        <div class="card"><div class="stat-value">\${data.total_decisions}</div><div class="stat-label">Total Decisions</div></div>
        <div class="card"><div class="stat-value">\${data.avg_latency_ms.toFixed(0)}ms</div><div class="stat-label">Avg Latency</div></div>
        <div class="card"><div class="stat-value">$\${data.total_cost_usd.toFixed(4)}</div><div class="stat-label">Total Cost</div></div>
        <div class="card"><div class="stat-value">\${(data.success_rate * 100).toFixed(1)}%</div><div class="stat-label">Success Rate</div></div>
      \`;
    }

    async function fetchDecisions() {
      const res = await fetch('/api/decisions?limit=20');
      const data = await res.json();
      document.getElementById('decisions').querySelector('tbody').innerHTML = data.map(d => {
        let cost = '0.0000';
        try { if (d.usage) cost = JSON.parse(d.usage).cost_usd.toFixed(6); } catch(e) {}
        const statusClass = d.outcome_status === 'success' ? 'status-success' : d.outcome_status === 'failure' ? 'status-failure' : 'status-evaluated';
        return \`<tr onclick="showDetails('\${d.id}')"><td>\${d.id.substring(0, 8)}...</td><td>\${new Date(d.created_at).toLocaleTimeString()}</td><td>\${d.source_ref}</td><td><span class="status-badge \${statusClass}">\${d.status}</span></td><td>\${d.execution_latency ? d.execution_latency.toFixed(0) + 'ms' : '-'}</td><td>$\${cost}</td></tr>\`;
      }).join('');
    }

    async function showDetails(id) {
      const res = await fetch('/api/decisions/' + id);
      const data = await res.json();
      let content = '<h3>Metadata</h3><pre>' + JSON.stringify({ id: data.id, tenant: data.tenant_id, created: data.created_at, source: data.source_type + '/' + data.source_ref, fingerprint: data.input_fingerprint }, null, 2) + '</pre>';
      content += '<h3>Input</h3><pre>' + formatJson(data.decision_input) + '</pre>';
      content += '<h3>Output</h3><pre>' + formatJson(data.decision_output) + '</pre>';
      if (data.decision_trace) content += '<h3>Trace</h3><pre>' + formatJson(data.decision_trace) + '</pre>';
      document.getElementById('modalBody').innerHTML = content;
      document.getElementById('detailModal').style.display = 'block';
    }

    function formatJson(str) { try { return JSON.stringify(JSON.parse(str), null, 2); } catch (e) { return str; } }
    function closeModal() { document.getElementById('detailModal').style.display = 'none'; }
    function refresh() { fetchStats(); fetchDecisions(); }
    refresh(); setInterval(refresh, 5000);
    window.onclick = function(event) { if (event.target == document.getElementById('detailModal')) closeModal(); }
  </script>
</body>
</html>`;
}
