import { AIExecutor, AIExecutorOptions, AIExecutionResult } from '../../kernel/ai-executor.js';
import { noTimeoutFetch } from './shared.js';

// Anthropic Claude Implementation
export class AnthropicExecutor extends AIExecutor {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.apiKey = this.customConfig.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = this.customConfig.baseUrl || 'https://api.anthropic.com/v1';
  }

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      const duration = Date.now() - startTime;
      return {
        content: this.generateFallbackResponse(prompt),
        model: this.model,
        duration,
        success: false,
        error: 'Anthropic API key not configured'
      };
    }

    try {
      // Claude 4.x models with extended thinking need larger max_tokens
      // (thinking tokens count toward max_tokens budget)
      const isClaude4Extended = this.model.startsWith('claude-') &&
        (this.model.includes('-opus-4') || this.model.includes('-sonnet-4'));
      const effectiveMaxTokens = isClaude4Extended
        ? Math.max(this.maxTokens || 4000, 16000)
        : (this.maxTokens || 4000);

      // Opus 4.7 does not support temperature/top_k
      const isOpus47 = this.model.includes('claude-opus-4-7') || this.model === 'claude-opus-4-7';

      // Wrap personality in array format with cache_control so Anthropic caches the
      // system prompt across turns. Requires >=1024 tokens to actually cache; shorter
      // personalities silently skip caching with no error.
      const systemParam = personality
        ? [{ type: 'text', text: personality, cache_control: { type: 'ephemeral' } }]
        : undefined;

      const requestBody: Record<string, unknown> = {
        model: this.model,
        max_tokens: effectiveMaxTokens,
        messages: [{ role: 'user', content: prompt }],
        ...(systemParam && { system: systemParam }),
        ...(!isOpus47 && { temperature: this.temperature, top_k: this.topK }),
      };

      const response = await noTimeoutFetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${this.agentId}] Anthropic API Error:`, {
          status: response.status,
          statusText: response.statusText,
          model: this.model,
          errorText: errorText
        });
        return {
          content: this.generateFallbackResponse(prompt),
          model: this.model,
          duration,
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          errorDetails: {
            type: 'HTTP_ERROR',
            message: `HTTP ${response.status}: ${errorText}`,
            httpStatus: response.status,
            responseText: errorText
          }
        };
      }

      const data = await response.json() as any;
      const content = data.content[0]?.text || '';

      const cacheRead: number = data.usage?.cache_read_input_tokens ?? 0;
      const cacheWrite: number = data.usage?.cache_creation_input_tokens ?? 0;
      if (cacheRead > 0 || cacheWrite > 0) {
        console.log(`[${this.agentId}] Anthropic cache: read=${cacheRead} write=${cacheWrite} tokens`);
      }

      return {
        content: this.sanitizeContent(content),
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
        model: this.model,
        duration,
        success: true
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      let errorStack: string | undefined = undefined;
      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      }
      return {
        content: this.generateFallbackResponse(prompt),
        model: this.model,
        duration,
        success: false,
        error: errorMessage,
        errorDetails: {
          type: 'EXECUTION_ERROR',
          message: errorMessage,
          stack: errorStack
        }
      };
    }
  }

}
