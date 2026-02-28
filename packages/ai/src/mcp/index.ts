/**
 * @fileoverview MCP module public exports.
 */

export { handleListTools, handleCallTool, handleHealth, type McpHandlerResult } from './server.js';
export { GET_health, GET_tools, POST_callTool } from './transport-next.js';
export type {
  McpListToolsResponse,
  McpCallToolResponse,
  McpHealthResponse,
  McpToolDescriptor,
  McpError,
  McpRequest,
} from './types.js';
