/**
 * @fileoverview Models module public exports.
 */

export { registerProvider, getProvider, listProviders, getModel, listModels, getDefaultModel, registerModel, type ModelDefinition } from './registry.js';
export { generateText, type ArbitratorRequest } from './arbitrator.js';
export { checkCircuit, recordSuccess, recordFailure, getCircuitState, resetCircuit, type CircuitState, type CircuitBreakerConfig } from './circuitBreaker.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
export type { ModelProvider, GenerateTextRequest, GenerateTextResponse, Message } from './providers/types.js';
