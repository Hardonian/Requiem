#!/usr/bin/env tsx
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

const CLI_PATH = path.join(process.cwd(), 'packages/cli/src/cli.ts');

async function main() {
  console.log('📊 Verifying Dashboard command...');

  // 1. Start Dashboard
  const port = 3005;
  console.log(`  Starting dashboard on port ${port}...`);

  const child = spawn('npx', ['tsx', CLI_PATH, 'dashboard', '--port', port.toString()], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env }
  });

  // Wait for output or timeout
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for dashboard')), 10000);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes(`http://localhost:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr.on('data', (data) => {
      // console.error('[Dashboard stderr]', data.toString());
    });
  });

  console.log('  ✓ Dashboard process started');

  // 2. Verify API Endpoint
  await new Promise<void>((resolve, reject) => {
    http.get(`http://localhost:${port}/api/stats`, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`API returned status ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (typeof json.total_decisions !== 'number') {
            reject(new Error('Invalid JSON structure'));
          } else {
            console.log('  ✓ API /api/stats returned valid JSON');
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  // 3. Cleanup
  child.kill();
  console.log('✅ Dashboard verification passed');
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
