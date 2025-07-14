import { spawn } from 'child_process';
import { AIExecutor, AIExecutorOptions, AIExecutionResult } from './ai-executor.js';
import {
  GoogleGenAI,
} from '@google/genai';
import { Ollama } from 'ollama';
import { Agent } from 'undici'

const noTimeoutFetch = (input: string | URL | globalThis.Request, init?: RequestInit) => {
  const someInit = init || {}
   
  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000 }) } as any)
}

// Gemini CLI Implementation
export class GeminiCliExecutor extends AIExecutor {
  private path: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.path = this.customConfig.path || 'gemini.cmd';
  }

  async execute(prompt: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    console.log(`[${this.agentName}] Calling Gemini CLI with prompt: ${prompt.substring(0, 100)}...`);

    return new Promise((resolve, reject) => {
      const gemini = spawn(this.path, ['-m', this.model], { shell: true });

      let output = '';
      let error = '';

      gemini.stdout.on('data', (data) => {
        console.log(`[${this.agentName}] Gemini stdout: ${data.toString().substring(0, 100)}...`);
        output += data.toString();
      });

      gemini.stderr.on('data', (data) => {
        console.log(`[${this.agentName}] Gemini stderr: ${data.toString().substring(0, 100)}...`);
        error += data.toString();
      });

      gemini.on('close', (code) => {
        const duration = Date.now() - startTime;
        console.log(`[${this.agentName}] Gemini process closed with code: ${code}`);

        if (code === 0) {
          console.log(`[${this.agentName}] Gemini CLI executed successfully!`);
          resolve({
            content: this.sanitizeContent(output.trim()),
            model: this.model,
            duration,
            success: true
          });
        } else {
          console.warn(`[${this.agentName}] Gemini CLI failed with code ${code}: ${error}`);
          resolve({
            content: this.generateFallbackResponse(prompt),
            model: this.model,
            duration,
            success: false,
            error: `Process exited with code ${code}: ${error}`
          });
        }
      });

      gemini.on('error', (err) => {
        const duration = Date.now() - startTime;
        console.warn(`[${this.agentName}] Gemini CLI error: ${err.message}`);
        resolve({
          content: this.generateFallbackResponse(prompt),
          model: this.model,
          duration,
          success: false,
          error: err.message
        });
      });

      // Send the actual prompt via stdin
      console.log(`[${this.agentName}] Writing prompt to stdin...`);
      gemini.stdin.write(prompt);
      gemini.stdin.end();
    });
  }
}


export class GeminiExecutor extends AIExecutor {
  private genai: GoogleGenAI;
  private modelInstance: any;
  private apiKey: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.apiKey = this.customConfig.apiKey || process.env.GEMINI_API_KEY || '';
    this.genai = new GoogleGenAI({
      apiKey: this.apiKey
    });
  }

  async execute(prompt: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    const contents = [
      {
        role: 'user',
        parts: [
          { text: prompt },
        ],
      },
    ];
    const config = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      responseMimeType: 'text/plain',
      temperature: this.temperature,
      topP: this.topP,
      topK: this.topK,
    };
    const response = await this.genai.models.generateContentStream({
      model: this.model, config,
      contents
    });
    let content = '';
    for await (const chunk of response) {
      content += chunk?.text || '';
    }
    return {
      content: this.sanitizeContent(content),
      model: this.model,
      duration: Date.now() - startTime,
      success: true
    };
  }
}

// OpenAI API Implementation
export class OpenAIExecutor extends AIExecutor {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.apiKey = this.customConfig.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = this.customConfig.baseUrl || 'https://api.openai.com/v1';
  }

  async execute(prompt: string): Promise<AIExecutionResult> {
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
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.temperature
        })
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
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

// Anthropic Claude Implementation
export class AnthropicExecutor extends AIExecutor {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.apiKey = this.customConfig.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = this.customConfig.baseUrl || 'https://api.anthropic.com/v1';
  }

  async execute(prompt: string): Promise<AIExecutionResult> {
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
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.temperature
        })
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
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

// Mock/Simulation Implementation for testing
export class MockExecutor extends AIExecutor {
  async execute(prompt: string): Promise<AIExecutionResult> {
    const startTime = Date.now();

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const duration = Date.now() - startTime;

    // ステージサマリー用の特別な処理
    if (prompt.includes('CRITICAL OUTPUT FORMAT REQUIREMENT') || prompt.includes('You are one of the intelligent agents of the Yui Protocol')) {
      // エージェント名を抽出
      const agentNamesMatch = prompt.match(/Participating Agents: ([^\n]+)/);
      if (agentNamesMatch) {
        const agentNames = agentNamesMatch[1].split(',').map(name => name.trim());
        const mockSummaries = agentNames.map(name =>
          `- ${name}: ${name}が議論に参加し、独自の視点を提供しました。`
        ).join('\n');

        return {
          content: mockSummaries,
          model: this.model,
          duration,
          success: true
        };
      }
    }

    // output-generationステージの場合は必ずAgent Voteを含める
    if (prompt.includes('STAGE 5 - OUTPUT GENERATION')) {
      // エージェントID候補を抽出（自分以外）
      const agentIdPattern = /Agent\s+ID\s*[:：]\s*([a-zA-Z0-9\-_]+)/g;
      const allIds = Array.from(prompt.matchAll(agentIdPattern)).map(m => m[1]);
      const candidates = allIds.filter(id => id !== this.agentName);
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

      const content = `[${this.agentName}] Mock response: This is a simulated response to your query is "${prompt.substring(0, 100)}...".\n\n${randomVoteFormat}\n理由: このエージェントが最も適切だと思います。`;

      return {
        content,
        model: this.model,
        duration,
        success: true
      };
    }

    return {
      content: `[${this.agentName}] Mock response: This is a simulated response to your query about "${prompt.substring(0, 50)}...". In a real implementation, this would be processed by ${this.provider} using model ${this.model}.`,
      model: this.model,
      duration,
      success: true
    };
  }
}

// Ollama API Implementation using npm package
export class OllamaExecutor extends AIExecutor {
  private baseUrl: string;
  private ollamaClient: Ollama;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.baseUrl = this.customConfig.baseUrl || 'http://localhost:11434';

    // npmのollamaパッケージを使用してクライアントを初期化
    this.ollamaClient = new Ollama({
      host: this.baseUrl,
      fetch: noTimeoutFetch
    });
  }

  // 接続テストメソッド
  private async testConnection(): Promise<boolean> {
    try {
      await this.ollamaClient.list();
      return true;
    } catch (error) {
      console.warn(`[OllamaExecutor] Connection test failed: ${error}`);
      return false;
    }
  }

  // モデル存在確認メソッド
  private async checkModelExists(): Promise<boolean> {
    try {
      const models = await this.ollamaClient.list();
      return models.models.some(model => model.name === this.model);
    } catch (error) {
      console.warn(`[OllamaExecutor] Model check failed: ${error}`);
      return false;
    }
  }

  async execute(prompt: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 接続テストを実行
        const isConnected = await this.testConnection();
        if (!isConnected) {
          throw new Error(`Connection failed to Ollama server at ${this.baseUrl}. Please ensure Ollama is running and accessible.`);
        }

        // モデル存在確認を実行
        const modelExists = await this.checkModelExists();
        if (!modelExists) {
          throw new Error(`Model '${this.model}' not found. Please install it using: ollama pull ${this.model}`);
        }

        // npmのollamaパッケージを使用してリクエストを実行
        // このパッケージは内部的にタイムアウト制御を持っている
        const response = await this.ollamaClient.generate({
          model: this.model,
          prompt: prompt,
          stream: false,
          think: false,
          options: {
            temperature: this.temperature,
            top_p: this.topP,
            repeat_penalty: this.repetitionPenalty,
            presence_penalty: this.presencePenalty,
            frequency_penalty: this.frequencyPenalty,
            top_k: this.topK,
          }
        });

        const duration = Date.now() - startTime;

        return {
          content: this.sanitizeContent(response.response || ''),
          model: this.model,
          duration,
          success: true
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // リトライ可能なエラーかチェック
        const isRetryable = this.isRetryableError(lastError);

        if (attempt === maxRetries || !isRetryable) {
          // 最後の試行またはリトライ不可能なエラーの場合
          const duration = Date.now() - startTime;
          let errorMessage = 'Unknown error';
          let errorStack: string | undefined = undefined;

          if (lastError instanceof Error) {
            errorMessage = lastError.message;
            errorStack = lastError.stack;

            // 接続エラーの特別処理
            if (lastError.message.includes('ECONNREFUSED') ||
              lastError.message.includes('fetch failed') ||
              lastError.message.includes('ENOTFOUND')) {
              errorMessage = `Connection failed to Ollama server at ${this.baseUrl}. Please ensure Ollama is running and accessible.`;
            }

            // モデルが見つからないエラー
            if (lastError.message.includes('model not found') ||
              lastError.message.includes('404')) {
              errorMessage = `Model '${this.model}' not found. Please install it using: ollama pull ${this.model}`;
            }

            // タイムアウトエラー
            if (lastError.message.includes('timeout') ||
              lastError.message.includes('ETIMEDOUT')) {
              errorMessage = `Request timeout. The model may be taking too long to respond.`;
            }
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

        // リトライ可能なエラーの場合、指数バックオフで待機
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1秒、2秒、4秒、最大10秒
        console.warn(`[OllamaExecutor] Attempt ${attempt} failed: ${lastError.message}. Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    // この部分には到達しないはずだが、型安全性のため
    throw lastError || new Error('Unexpected error in retry logic');
  }

  // リトライ可能なエラーかどうかを判定するメソッド
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'ECONNREFUSED',
      'fetch failed',
      'ENOTFOUND',
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'network error',
      'connection error'
    ];

    const nonRetryablePatterns = [
      'model not found',
      '404',
      '401',
      '403',
      'invalid model',
      'authentication failed'
    ];

    const errorMessage = error.message.toLowerCase();

    // 非リトライ可能なエラーを先にチェック
    for (const pattern of nonRetryablePatterns) {
      if (errorMessage.includes(pattern.toLowerCase())) {
        return false;
      }
    }

    // リトライ可能なエラーをチェック
    for (const pattern of retryablePatterns) {
      if (errorMessage.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // デフォルトはリトライ可能とする（ネットワークエラーの可能性が高いため）
    return true;
  }
}

// Factory function implementation
export function createAIExecutor(agentName: string, options?: Partial<AIExecutorOptions>): AIExecutor {
  //throw new Error('createAIExecutor is not implemented');

  const config = {
    agentName,
    provider: 'gemini-cli' as const,
    ...options
  };


  switch (config.provider) {
    case 'gemini':
      return new GeminiExecutor(config);
    case 'openai':
      return new OpenAIExecutor(config);
    case 'anthropic':
      return new AnthropicExecutor(config);
    case 'ollama':
      return new OllamaExecutor(config);
    case 'gemini-cli':
      return new GeminiCliExecutor(config);
    case 'custom':
    default:
      return new MockExecutor(config);
  }
} 