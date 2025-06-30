export interface AIExecutorOptions {
  agentName: string;
  maxTokens?: number;
  model?: string;
  provider?: 'gemini' | 'openai' | 'anthropic' | 'custom';
  customConfig?: Record<string, any>;
}

export interface AIExecutionResult {
  content: string;
  tokensUsed?: number;
  model?: string;
  duration: number;
  success: boolean;
  error?: string;
}

export abstract class AIExecutor {
  protected agentName: string;
  protected maxTokens: number;
  protected model: string;
  protected provider: string;
  protected customConfig: Record<string, any>;

  constructor(options: AIExecutorOptions) {
    this.agentName = options.agentName;
    this.maxTokens = options.maxTokens || 4000;
    this.model = options.model || 'default';
    this.provider = options.provider || 'custom';
    this.customConfig = options.customConfig || {};
  }

  abstract execute(prompt: string): Promise<AIExecutionResult>;
  
  abstract executeWithTruncation(prompt: string): Promise<AIExecutionResult>;

  protected truncatePrompt(prompt: string, maxTokens: number): string {
    const estimatedTokens = Math.ceil(prompt.length / 4);
    
    if (estimatedTokens <= maxTokens) {
      return prompt;
    }
    
    // Simple truncation - keep the beginning and end
    const maxChars = maxTokens * 4;
    const halfChars = Math.floor(maxChars / 2);
    
    if (prompt.length <= maxChars) {
      return prompt;
    }
    
    return prompt.substring(0, halfChars) + 
           '\n\n[Content truncated for token limit]\n\n' + 
           prompt.substring(prompt.length - halfChars);
  }

  protected generateFallbackResponse(prompt: string): string {
    return `[${this.agentName}] Fallback response: I understand your query about "${prompt.substring(0, 50)}...". However, I'm currently experiencing technical difficulties with my primary AI service. Please try again later or contact support if the issue persists.`;
  }

  protected sanitizeContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return this.generateFallbackResponse('');
    }
    
    // 基本的なサニタイゼーション
    let sanitized = content.trim();
    
    // 非常に長いコンテンツを切り詰める
    if (sanitized.length > 50000) {
      sanitized = sanitized.substring(0, 50000) + '\n\n[Content truncated due to length]';
    }
    
    // 不正な文字を除去
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
  }
}

// Shared utility function for generating fallback responses
export function generateSharedFallbackResponse(agentName: string, prompt: string): string {
  const responses = [
    `I apologize, but I'm unable to process this request at the moment. For ${prompt}, I would typically approach this systematically...`,
    `Due to technical limitations, I cannot provide a full response. Regarding ${prompt}, the key considerations would be...`,
    `I'm experiencing connectivity issues. For ${prompt}, the standard approach would involve...`,
    `Unable to reach the processing service. With ${prompt}, the recommended methodology is...`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// Factory function to create AI executor instances
export async function createAIExecutor(agentName: string, options?: Partial<AIExecutorOptions>): Promise<AIExecutor> {
  // Try to load the implementation dynamically
  try {
    // Dynamic import to avoid circular dependencies and allow for git exclusion
    const { createAIExecutor: createImpl } = await import('./ai-executor-impl.js');
    return createImpl(agentName, options);
  } catch (error) {
    // Fallback to mock implementation if the real implementation is not available
    console.warn(`[AIExecutor] Implementation not available, using mock executor: ${error}`);
    
    // Create a simple mock executor
    return new (class MockExecutor extends AIExecutor {
      async execute(prompt: string): Promise<AIExecutionResult> {
        const startTime = Date.now();
        // 100〜1000msのランダムな待機
        const wait = Math.floor(Math.random() * 900) + 100;
        await new Promise(resolve => setTimeout(resolve, wait));
        const duration = Date.now() - startTime;
        
        return {
          content: `[${this.agentName}] Mock response: This is a simulated response to your query about "${prompt.substring(0, 50)}...". Please configure your AI implementation.`,
          model: this.model,
          duration,
          success: true
        };
      }

      async executeWithTruncation(prompt: string): Promise<AIExecutionResult> {
        return this.execute(prompt);
      }
    })({ agentName, ...options });
  }
} 