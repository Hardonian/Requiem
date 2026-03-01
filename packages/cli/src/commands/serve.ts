import { Command } from 'commander';
import * as http from 'http';
import { DecisionRepository } from '../db/decisions';

export const serve = new Command('serve')
  .description('Expose decision engine as a REST API')
  .option('-p, --port <number>', 'Port to run server on', '8080')
  .action((options: { port: string }) => {
    const port = parseInt(options.port, 10);

    // In a real implementation, this would use the PolicyEngine and EngineAdapter.
    // This is a simplified telemetry sink server for demonstration.
    const server = http.createServer((req, res) => {
      // 1. Health check
      if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
        return;
      }

      // 2. Decision ingest (Telemetry Sink)
      if (req.url === '/v1/decisions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            DecisionRepository.create({
              tenant_id: data.tenant_id || 'default',
              source_type: 'api_serve',
              source_ref: data.source || 'remote_client',
              input_fingerprint: data.fingerprint || 'unknown',
              decision_input: data.input || {},
              decision_output: data.output || {},
              status: 'evaluated',
              execution_latency: data.latency_ms
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'accepted', id: 'remote' }));
          } catch (e) {
            res.writeHead(400);
            res.end('Invalid JSON');
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    server.listen(port, () => {
      console.log(`\n📡 Requiem Serve active at http://localhost:${port}`);
      console.log('Ingesting decisions from remote clients...\n');
    });
  });
