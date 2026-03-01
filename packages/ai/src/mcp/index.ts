/**
 * @fileoverview MCP module public exports.
 */

export { handleListTools, handleCallTool, handleHealth, type McpHandlerResult } from './server';
export { GET_health, GET_tools, POST_callTool } from './transport-next';
export type {
  McpListToolsResponse,
  McpCallToolResponse,
  McpHealthResponse,
  McpToolDescriptor,
  McpError,
  McpRequest,
} from './types';

// Policy enforcement at MCP entry point
export { McpPolicyEnforcer, getPolicyEnforcer, type PolicyCheckResult } from './policyEnforcer';

// Correlation ID management
export {
  CorrelationManager,
  attachCorrelationToContext,
  formatCorrelationForLog,
  extractCorrelationAuditData,
  CORRELATION_ID_HEADER,
  TRACEPARENT_HEADER,
  type RequestContext,
} from './correlation';
