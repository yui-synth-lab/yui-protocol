import { AIExecutor, AIExecutorOptions, AIExecutionResult } from '../../kernel/ai-executor.js';
import { noTimeoutFetch } from './shared.js';

// OpenAI API Implementation
export class OpenAIExecutor extends AIExecutor {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.apiKey = this.customConfig.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = this.customConfig.baseUrl || 'https://api.openai.com/v1';
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
        error: 'OpenAI API key not configured'
      };
    }

    try {
      // GPT-5 models have different parameter support than GPT-4
      const isGPT5Model = this.model.startsWith('gpt-5');
      const isGPT5Mini = this.model.includes('gpt-5.4-mini') || this.model.includes('gpt-5-mini');
      const isGPT5Nano = this.model.includes('gpt-5.4-nano') || this.model.includes('gpt-5-nano');

      const requestBody: any = {
        model: this.model,
        messages: [
          ...(personality ? [{ role: 'system', content: personality }] : []),
          { role: 'user', content: prompt }
        ],
      };

      if (isGPT5Model) {
        // GPT-5 specific parameters:
        // - Uses max_completion_tokens instead of max_tokens
        // - GPT-5 mini/nano only support temperature=1 (omit for default)
        // - GPT-5.2+ supports temperature normally
        // - Does not support top_p, frequency_penalty, presence_penalty
        // - May include reasoning_tokens in completion_tokens
        // - gpt-5.4 uses extended thinking; reasoning tokens count toward max_completion_tokens
        //   so we need a larger budget (16000) to avoid empty output (finish_reason: length)
        const isGPT54 = this.model.startsWith('gpt-5.4') && !isGPT5Mini && !isGPT5Nano;
        requestBody.max_completion_tokens = isGPT54 ? 16000 : (this.maxTokens || 4000);

        // Only add temperature for GPT-5.2 and above (not mini/nano)
        if (!isGPT5Mini && !isGPT5Nano) {
          requestBody.temperature = this.temperature;
        }
      } else {
        // GPT-4 and older models use traditional sampling parameters
        requestBody.temperature = this.temperature;
        requestBody.top_p = this.topP;
        requestBody.frequency_penalty = this.frequencyPenalty;
        requestBody.presence_penalty = this.presencePenalty;
        requestBody.max_tokens = this.maxTokens || 4000;
      }

      const response = await noTimeoutFetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${this.agentId}] OpenAI API Error:`, {
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
      const content = data.choices[0]?.message?.content || '';

      return {
        content: this.sanitizeContent(content),
        tokensUsed: data.usage?.total_tokens,
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
