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

// Policy enforcement at MCP entry point
export { McpPolicyEnforcer, getPolicyEnforcer, getPolicyEnforcerAsync, resetPolicyEnforcer, type PolicyCheckResult } from './policyEnforcer.js';

// Correlation ID management
export {
  CorrelationManager,
  attachCorrelationToContext,
  formatCorrelationForLog,
  extractCorrelationAuditData,
  CORRELATION_ID_HEADER,
  TRACEPARENT_HEADER,
  type RequestContext,
} from './correlation.js';
