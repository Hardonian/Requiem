/**
 * @fileoverview A minimal, policy-aware MCP (Model Context Protocol) server.
 *
 * This module provides Next.js route handlers to expose the AI tool registry
 * to external clients in a secure and structured way.
 */

import { z } from 'zod';
import { listTools } from '../tools/registry';
import { invokeToolWithPolicy, InvocationContext } from '../policy/gate';
import { TenantRole, getGlobalTenantResolver } from '@requiem/cli'; // Assumed path

// A mock function to get the invocation context.
// In a real app, this would be derived from the authenticated session.
async function getInvocationContext(req: Request): Promise<InvocationContext> {
    const tenantResolver = getGlobalTenantResolver();
    const tenantContext = await tenantResolver.resolve({ req });

    if (!tenantContext) {
        throw new Error("Tenant context is required.");
    }
    
    return {
        tenant: tenantContext,
        actorId: tenantContext.userId || 'anonymous',
        traceId: newId('trace'), // Assuming newId is available
    };
}


// #region: Route Handlers

/**
 * **GET /api/mcp/health**
 *
 * A simple health check endpoint.
 */
export async function healthCheckHandler(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}


/**
 * **GET /api/mcp/tools**
 *
 * Lists all available tools in the registry.
 */
export async function listToolsHandler(req: Request): Promise<Response> {
    try {
        await getInvocationContext(req); // Auth check
        const tools = listTools();
        return new Response(JSON.stringify({ tools }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}


const CallToolInputSchema = z.object({
  toolName: z.string(),
  input: z.any(),
});

/**
 * **POST /api/mcp/tool/call**
 *
 * Invokes a tool with the given input, subject to policy gating.
 */
export async function callToolHandler(req: Request): Promise<Response> {
  try {
    const ctx = await getInvocationContext(req);
    const body = await req.json();

    const { toolName, input } = CallToolInputSchema.parse(body);

    const result = await invokeToolWithPolicy(ctx, toolName, input);

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // Distinguish between validation, policy, and execution errors
    const isZodError = error instanceof z.ZodError;
    const statusCode = isZodError ? 400 : error.message.includes('Policy denied') ? 403 : 500;

    return new Response(JSON.stringify({ error: error.message }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// #endregion: Route Handlers
