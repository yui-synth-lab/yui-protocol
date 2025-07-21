export interface AIExecutorOptions {
  agentId: string;
  model?: string;
  provider?: string;
  customConfig?: Record<string, any>;
  temperature?: number;
  topP?: number;
  repetitionPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  topK?: number;
  personality?: string; // 追加
}

export interface AIExecutionResult {
  content: string;
  tokensUsed?: number;
  model?: string;
  duration: number;
  success: boolean;
  error?: string;
  errorDetails?: {
    type: string;
    message: string;
    stack?: string;
    httpStatus?: number;
    responseText?: string;
  };
}

export abstract class AIExecutor {
  protected agentId: string;
  protected model: string;
  protected provider: string;
  protected maxTokens: number;
  protected customConfig: Record<string, any>;
  protected temperature: number;
  protected topP: number;
  protected repetitionPenalty: number;
  protected presencePenalty: number;
  protected frequencyPenalty: number;
  protected topK: number;

  constructor(options: AIExecutorOptions) {
    this.agentId = options.agentId;
    this.model = options.model || 'default';
    this.provider = options.provider || 'openai';
    this.maxTokens = options.customConfig?.maxTokens || 4000;
    this.customConfig = options.customConfig || {};
    this.temperature = options.temperature || 0.7;
    this.topP = options.topP || 0.9;
    this.repetitionPenalty = options.repetitionPenalty || 1.1;
    this.presencePenalty = options.presencePenalty || 0.0;
    this.frequencyPenalty = options.frequencyPenalty || 0.0;
    this.topK = options.topK || 40;
  }

  abstract execute(prompt: string, personality: string): Promise<AIExecutionResult>;
  
  protected truncatePrompt(prompt: string, maxTokens: number): string {
    const maxChars = maxTokens * 4; // Rough estimate: 1 token ≈ 4 characters
    
    if (prompt.length <= maxChars) {
      return prompt;
    }
    
    const halfChars = Math.floor(maxChars / 2);
    const beginning = prompt.substring(0, halfChars);
    const end = prompt.substring(prompt.length - halfChars);
    
    return `${beginning}\n\n[Content truncated for token limit]\n\n${end}`;
  }

  protected generateFallbackResponse(prompt: string): string {
    return `[${this.agentId}] Fallback response: I understand your query about "${prompt.substring(0, 50)}...". However, I'm currently experiencing technical difficulties with my primary AI service. Please try again later or contact support if the issue persists.`;
  }

  protected sanitizeContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return this.generateFallbackResponse('');
    }
    
    // 基本的なサニタイゼーション
    let sanitized = content.trim();
    
    // 不正な文字を除去
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // <think>タグとその内容を除去
    sanitized = sanitized.replace(/<think>[\s\S]*?<\/think>/gi, '');
    sanitized = sanitized.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    sanitized = sanitized.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
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
export async function createAIExecutor(agentId: string, options?: Partial<AIExecutorOptions>): Promise<AIExecutor> {
  // Try to load the implementation dynamically
  try {
    // Dynamic import to avoid circular dependencies and allow for git exclusion
    const { createAIExecutor: createImpl } = await import('./ai-executor-impl.js');
    return createImpl(agentId, options);
  } catch (error) {
    // Fallback to mock implementation if the real implementation is not available
    console.warn(`[AIExecutor] Implementation not available, using mock executor: ${error}`);
    
    // Create a simple mock executor
    return new (class MockExecutor extends AIExecutor {
      async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
        const startTime = Date.now();
        let content: string;
        // output-generationステージの場合は必ずAgent Voteを含める
        if (prompt.includes('STAGE 5 - OUTPUT GENERATION')) {
          // エージェントID候補を抽出（自分以外）
          const agentIdPattern = /Agent\s+ID\s*[:：]\s*([a-zA-Z0-9\-_]+)/g;
          const allIds = Array.from(prompt.matchAll(agentIdPattern)).map(m => m[1]);
          const candidates = allIds.filter(id => id !== this.agentId);
          const voteFor = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : 'yui-000';
          
          // 複数の投票表記形式で出力（表記ゆれに対応）
          const voteFormats = [
            `Agent Vote: ${voteFor}`,
            `投票: ${voteFor}`,
            `推薦: ${voteFor}`,
            `選択: ${voteFor}`,
            `まとめ役: ${voteFor}`,
            `**${voteFor}**`,
            `\`${voteFor}\``
          ];
          const randomVoteFormat = voteFormats[Math.floor(Math.random() * voteFormats.length)];
          
          content = `[${this.agentId}] Mock response: This is a simulated response to your query is "${prompt.substring(0, 100)}...".\n\n${randomVoteFormat}\n理由: このエージェントが最も適切だと思います。`;
        } else {
          content = `[${this.agentId}] Mock response: This is a simulated response to your query is "${prompt.substring(0, 100)}...". Please configure your AI implementation.`;
        }
        const duration = Date.now() - startTime;
        return {
          content,
          model: this.model,
          duration,
          success: true
        };
      }
    })({ agentId, ...options });
  }
} 