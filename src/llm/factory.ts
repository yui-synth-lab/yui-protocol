import { AIExecutor, AIExecutorOptions } from '../kernel/ai-executor.js';
import { GeminiCliExecutor } from './providers/gemini-cli.js';
import { GeminiExecutor } from './providers/gemini.js';
import { OpenAIExecutor } from './providers/openai.js';
import { AnthropicExecutor } from './providers/anthropic.js';
import { LlamaCppExecutor, LlamaCppLocalExecutor } from './providers/llama-cpp.js';
import { OllamaExecutor } from './providers/ollama.js';
import { MockExecutor } from './providers/mock.js';

// Factory function implementation
export function createAIExecutor(agentId: string, options?: Partial<AIExecutorOptions>): AIExecutor {
  // During tests, always throw an error to trigger mock executor usage
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || typeof (globalThis as any).it !== 'undefined') {
    throw new Error('AIExecutor implementation not available, using mock executor');
  }

  const config = {
    agentId,
    provider: 'openai' as const,
    ...options
  };

  // If model config is not provided in options, use default
  if (!config.provider || !config.model) {
    config.provider = 'openai';
    config.model = 'gpt-4.1-mini-2025-04-14';
  }

  console.log(JSON.stringify(config));

  // Configure API keys from environment variables
  switch (config.provider) {
    case 'gemini':
      if (!config.model) {
        config.model = 'gemini-2.5-flash-lite';
      }
      config.customConfig = {
        apiKey: process.env.GEMINI_API_KEY,
        ...config.customConfig
      };
      return new GeminiExecutor(config);
    case 'openai':
      if (!config.model) {
        config.model = 'gpt-4.1-mini';
      }
      config.customConfig = {
        apiKey: process.env.OPENAI_API_KEY,
        ...config.customConfig
      }
      return new OpenAIExecutor(config);
    case 'anthropic':
      config.customConfig = {
        apiKey: process.env.ANTHROPIC_API_KEY,
        ...config.customConfig
      }
      return new AnthropicExecutor(config);
    case 'ollama':
      if (!config.customConfig) {
        config.customConfig = {};
      }
      if (process.env.OLLAMA_BASE_URL) {
        config.customConfig.baseUrl = process.env.OLLAMA_BASE_URL;
      }
      return new OllamaExecutor(config);
    case 'llamacpp':
      if (!config.customConfig) {
        config.customConfig = {};
      }
      if (process.env.LLAMACPP_BASE_URL) {
        config.customConfig.baseUrl = process.env.LLAMACPP_BASE_URL;
      }
      return new LlamaCppExecutor(config);
    case 'llamacpp-local':
      if (!config.customConfig) {
        config.customConfig = {};
      }
      if (process.env.LLAMACPP_MODEL_PATH) {
        config.customConfig.modelPath = process.env.LLAMACPP_MODEL_PATH;
      }
      if (process.env.LLAMACPP_CONTEXT_SIZE) {
        config.customConfig.contextSize = parseInt(process.env.LLAMACPP_CONTEXT_SIZE, 10);
      }
      if (process.env.LLAMACPP_GPU_LAYERS) {
        config.customConfig.gpuLayers = parseInt(process.env.LLAMACPP_GPU_LAYERS, 10);
      }
      return new LlamaCppLocalExecutor(config);
    case 'gemini-cli':
      return new GeminiCliExecutor(config);
    case 'custom':
    default:
      return new MockExecutor(config);
  }
}
