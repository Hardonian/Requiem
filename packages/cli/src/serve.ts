import { Command } from 'commander';
import http from 'http';
import { evaluateDecision } from '../engine/adapter';

export const serve = new Command('serve')
  .description('Expose the decision engine as a REST API')
  .option('-p, --port <number>', 'Port to listen on', '4000')
  .action(async (options: { port: string }) => {
    const port = parseInt(options.port, 10);

    const server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '0.2.0' }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/decide') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            if (!body) throw new Error('Empty request body');
            const input = JSON.parse(body);

            // Execute decision via the engine adapter
            const result = await evaluateDecision(input);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error('Decision error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: err instanceof Error ? err.message : String(err)
            }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, () => {
      console.log(`\n🚀 Requiem Decision Engine serving at http://localhost:${port}`);
      console.log(`   POST /decide`);
      console.log(`   GET  /health`);
      console.log('   Hit Ctrl+C to stop server');
    });
  });
