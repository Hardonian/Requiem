#!/usr/bin/env tsx
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

const CLI_PATH = path.join(process.cwd(), 'packages/cli/src/cli.ts');

async function main() {
  console.log('🍽️  Verifying Serve command...');

  const port = 4005;
  console.log(`  Starting server on port ${port}...`);

  const child = spawn('npx', ['tsx', CLI_PATH, 'serve', '--port', port.toString()], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env }
  });

  // Wait for server start
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for server')), 10000);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes(`http://localhost:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr.on('data', (data) => {
      // Optional: log stderr if needed
    });
  });

  console.log('  ✓ Server started');

  // Test /health
  await new Promise<void>((resolve, reject) => {
    http.get(`http://localhost:${port}/health`, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Health check failed: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok') resolve();
          else reject(new Error('Health check returned invalid status'));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
  console.log('  ✓ Health check passed');

  child.kill();
  console.log('✅ Serve verification passed');
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
