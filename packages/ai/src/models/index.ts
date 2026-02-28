/**
 * @fileoverview Models module public exports.
 */

export { registerProvider, getProvider, listProviders, getModel, listModels, getDefaultModel, registerModel, type ModelDefinition } from './registry';
export { generateText, type ArbitratorRequest } from './arbitrator';
export { checkCircuit, recordSuccess, recordFailure, getCircuitState, resetCircuit, type CircuitState, type CircuitBreakerConfig } from './circuitBreaker';
export { AnthropicProvider } from './providers/anthropic';
export { OpenAIProvider } from './providers/openai';
export type { ModelProvider, GenerateTextRequest, GenerateTextResponse, Message } from './providers/types';
