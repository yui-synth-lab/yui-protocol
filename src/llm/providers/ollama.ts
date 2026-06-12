import { AIExecutor, AIExecutorOptions, AIExecutionResult } from '../../kernel/ai-executor.js';
import { Ollama } from 'ollama';
import { noTimeoutFetch } from './shared.js';

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

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
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
          system: personality,
          stream: true,
          think: false,
          keep_alive: '1h',
          options: {
            temperature: this.temperature,
            top_p: this.topP,
            repeat_penalty: this.repetitionPenalty,
            presence_penalty: this.presencePenalty,
            frequency_penalty: this.frequencyPenalty,
            top_k: this.topK,
            num_predict: this.maxTokens || 2048,  // Set max output tokens
          }
        });

        const duration = Date.now() - startTime;
        let responseString = '';
        for await (const part of response) {
          responseString += part.response;
        }
        return {
          content: this.sanitizeContent(responseString || ''),
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
