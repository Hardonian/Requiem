/**
 * Agent CLI Module
 *
 * Commands:
 * - requiem agent serve --tenant <id>
 */

import { McpServer, McpRequest } from '../lib/mcp.js';
import { requireTenantContextCli, getGlobalTenantResolver } from '../lib/tenant.js';
import { registerStandardTools } from '../lib/tool-definitions.js';
import { newId } from '../db/helpers.js';

export interface AgentCliArgs {
  command: 'serve';
  tenantId?: string;
  json?: boolean;
}

export function parseAgentArgs(argv: string[]): AgentCliArgs {
  const result: AgentCliArgs = {
    command: 'serve',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === 'serve') {
      result.command = 'serve';
    } else if (arg === '--tenant' && next) {
      result.tenantId = next;
      i++;
    } else if (arg === '--json') {
      result.json = true;
    }
  }

  return result;
}

export async function runAgentCommand(args: AgentCliArgs): Promise<number> {
  try {
    switch (args.command) {
      case 'serve':
        return await handleServe(args);
      default:
        console.error(`Unknown command: ${args.command}`);
        return 1;
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    return 1;
  }
}

async function handleServe(args: AgentCliArgs): Promise<number> {
  // 1. Initialize Registry
  registerStandardTools();

  // 2. Resolve Context
  const context = await requireTenantContextCli(getGlobalTenantResolver(), {
    ...process.env,
    REQUIEM_TENANT_ID: args.tenantId || process.env.REQUIEM_TENANT_ID,
  });

  const server = new McpServer({
    ...context,
    requestId: newId('req'),
  });

  // 3. Stdio Loop
  process.stdin.on('data', async (data) => {
    try {
      const input = data.toString();
      // Handle multiple potential objects in one chunk
      const lines = input.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const request = JSON.parse(line) as McpRequest;
        const response = await server.handleRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      process.stderr.write(`MCP Error: ${err}\n`);
    }
  });

  process.stderr.write(`Requiem MCP Server active (Tenant: ${context.tenantId})\n`);

  // Keep alive
  return new Promise(() => {});
}

