#!/usr/bin/env node
/**
 * @fileoverview Connect command - Test and monitor connectivity.
 *
 * Supports:
 * - test: Test DNS, TLS, proxy, provider reachability
 * - status: Show provider summary and connection status
 *
 * Output formats: --json, --jsonl, --table
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const VERSION = '0.2.0';

interface ConnectivityTest {
  name: string;
  type: 'dns' | 'tls' | 'proxy' | 'provider';
  url: string;
  status: 'ok' | 'error' | 'warning' | 'skipped';
  latency?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface ProviderStatus {
  name: string;
  type: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  latency?: number;
  lastCheck?: string;
  error?: string;
}

const PROVIDERS = [
  { name: 'openai', type: 'openai', endpoint: 'https://api.openai.com/v1' },
  { name: 'anthropic', type: 'anthropic', endpoint: 'https://api.anthropic.com' },
  { name: 'google', type: 'google', endpoint: 'https://generativelanguage.googleapis.com' },
];

async function testDNS(hostname: string): Promise<ConnectivityTest> {
  const start = Date.now();
  try {
    execSync(`nslookup ${hostname}`, { stdio: 'pipe' });
    return {
      name: 'DNS Resolution',
      type: 'dns',
      url: hostname,
      status: 'ok',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'DNS Resolution',
      type: 'dns',
      url: hostname,
      status: 'error',
      error: error instanceof Error ? error.message : 'DNS lookup failed',
    };
  }
}

async function testTLS(url: string): Promise<ConnectivityTest> {
  const start = Date.now();
  try {
    // Use curl to test TLS
    const result = execSync(`curl -sI -w "\\n%{http_code}" --max-time 10 ${url}`, {
      encoding: 'utf-8',
    });
    const latency = Date.now() - start;
    const lines = result.split('\n');
    const statusCode = lines[lines.length - 1];

    if (statusCode.startsWith('2') || statusCode.startsWith('3')) {
      return {
        name: 'TLS Connection',
        type: 'tls',
        url,
        status: 'ok',
        latency,
        details: { httpStatus: statusCode },
      };
    }
    return {
      name: 'TLS Connection',
      type: 'tls',
      url,
      status: 'warning',
      latency,
      error: `HTTP ${statusCode}`,
    };
  } catch (error) {
    return {
      name: 'TLS Connection',
      type: 'tls',
      url,
      status: 'error',
      error: error instanceof Error ? error.message : 'TLS test failed',
    };
  }
}

async function testProxy(): Promise<ConnectivityTest> {
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];
  const proxy = proxyVars.find(v => process.env[v]);

  if (!proxy) {
    return {
      name: 'Proxy Configuration',
      type: 'proxy',
      url: 'N/A',
      status: 'skipped',
      details: { message: 'No proxy configured' },
    };
  }

  return {
    name: 'Proxy Configuration',
    type: 'proxy',
    url: proxy,
    status: 'ok',
    details: { configured: true },
  };
}

async function testProvider(provider: { name: string; type: string; endpoint: string }): Promise<ProviderStatus> {
  const start = Date.now();
  let status: ProviderStatus = {
    name: provider.name,
    type: provider.type,
    endpoint: provider.endpoint,
    status: 'unknown',
    lastCheck: new Date().toISOString(),
  };

  try {
    const result = execSync(`curl -sI --max-time 10 ${provider.endpoint}`, {
      encoding: 'utf-8',
    });
    const latency = Date.now() - start;
    const lines = result.split('\n');
    const statusCode = lines[lines.length - 1];

    status.latency = latency;
    if (statusCode.startsWith('2') || statusCode.startsWith('3')) {
      status.status = 'connected';
    } else if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
      status.status = 'error';
      status.error = `HTTP ${statusCode}`;
    }
  } catch (error) {
    status.status = 'error';
    status.error = error instanceof Error ? error.message : 'Connection failed';
    status.latency = Date.now() - start;
  }

  return status;
}

export const connect = new Command('connect')
  .description('Test connectivity and provider status')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--timeout <ms>', 'Timeout for each test', '10000')
  .action(async (options) => {
    // Default to showing status
    await showStatus(options);
  });

// Subcommand: test
connect.command('test')
  .description('Run connectivity tests')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .option('--timeout <ms>', 'Timeout for each test', '10000')
  .option('--skip-providers', 'Skip provider tests')
  .action(async (options) => {
    const tests: ConnectivityTest[] = [];

    // DNS tests
    console.log('Running connectivity tests...\n');

    tests.push(await testDNS('google.com'));
    tests.push(await testDNS('api.openai.com'));

    // TLS tests
    tests.push(await testTLS('https://google.com'));
    tests.push(await testTLS('https://api.openai.com'));

    // Proxy test
    tests.push(await testProxy());

    // Provider tests
    if (!options.skipProviders) {
      for (const provider of PROVIDERS) {
        const result = await testProvider(provider);
        tests.push({
          name: `${provider.name} Provider`,
          type: 'provider',
          url: provider.endpoint,
          status: result.status === 'connected' ? 'ok' : result.status === 'error' ? 'error' : 'warning',
          latency: result.latency,
          error: result.error,
        });
      }
    }

    // Output results
    if (options.json || options.format === 'json') {
      console.log(JSON.stringify({ tests }, null, 2));
    } else if (options.jsonl || options.format === 'jsonl') {
      for (const test of tests) {
        console.log(JSON.stringify(test));
      }
    } else {
      printTestResults(tests);
    }
  });

// Subcommand: status
connect.command('status')
  .description('Show provider connectivity status')
  .option('--json', 'Output in JSON format')
  .option('--jsonl', 'Output in JSONL format')
  .option('--format <type>', 'Output format: json, jsonl, table', 'table')
  .action(async (options) => {
    await showStatus(options);
  });

async function showStatus(options: { json?: boolean; jsonl?: boolean; format?: string }): Promise<void> {
  const providers: ProviderStatus[] = [];

  for (const provider of PROVIDERS) {
    const status = await testProvider(provider);
    providers.push(status);
  }

  if (options.json || options.format === 'json') {
    console.log(JSON.stringify({ providers }, null, 2));
  } else if (options.jsonl || options.format === 'jsonl') {
    for (const provider of providers) {
      console.log(JSON.stringify(provider));
    }
  } else {
    printProviderStatus(providers);
  }
}

function printTestResults(tests: ConnectivityTest[]): void {
  console.log('');
  console.log(`┌${'─'.repeat(70)}┐`);
  console.log(`│ Connectivity Test Results`.padEnd(71) + '│');
  console.log(`├${'─'.repeat(70)}┤`);

  for (const test of tests) {
    const statusIcon = test.status === 'ok' ? '✓' : test.status === 'error' ? '✗' : test.status === 'warning' ? '⚠' : '-';
    const latency = test.latency ? `${test.latency}ms` : '-';
    console.log(
      `│  ${statusIcon} ${test.name.padEnd(20)} ${test.url.slice(0, 25).padEnd(25)} ${latency.padEnd(8)}│`
    );
    if (test.error) {
      console.log(`│    Error: ${test.error.slice(0, 55)}`.padEnd(71) + '│');
    }
  }

  console.log(`└${'─'.repeat(70)}┘`);
  console.log('');

  const passed = tests.filter(t => t.status === 'ok').length;
  const failed = tests.filter(t => t.status === 'error').length;
  console.log(`Summary: ${passed} passed, ${failed} failed\n`);
}

function printProviderStatus(providers: ProviderStatus[]): void {
  console.log('');
  console.log(`┌${'─'.repeat(70)}┐`);
  console.log(`│ Provider Connectivity Status`.padEnd(71) + '│');
  console.log(`├${'─'.repeat(70)}┤`);

  for (const provider of providers) {
    const statusIcon =
      provider.status === 'connected'
        ? '✓'
        : provider.status === 'error'
        ? '✗'
        : provider.status === 'disconnected'
        ? '○'
        : '?';
    const latency = provider.latency ? `${provider.latency}ms` : '-';
    console.log(
      `│  ${statusIcon} ${provider.name.padEnd(15)} ${provider.type.padEnd(12)} ${latency.padEnd(8)}│`
    );
    if (provider.error) {
      console.log(`│    ${provider.error.slice(0, 60)}`.padEnd(71) + '│');
    }
  }

  console.log(`└${'─'.repeat(70)}┘`);
  console.log('');

  const connected = providers.filter(p => p.status === 'connected').length;
  console.log(`Connected: ${connected}/${providers.length}\n`);
}
