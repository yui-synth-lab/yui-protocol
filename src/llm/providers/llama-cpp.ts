import { AIExecutor, AIExecutorOptions, AIExecutionResult } from '../../kernel/ai-executor.js';
import { getLlama, Llama, LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import { noTimeoutFetch } from './shared.js';

// llama.cpp Server Implementation (OpenAI-compatible API)
// Uses llama-server with OpenAI-compatible endpoint
export class LlamaCppExecutor extends AIExecutor {
  private baseUrl: string;
  private modelName: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    // llama.cpp server URL (デフォルト: http://localhost:8080)
    this.baseUrl = this.customConfig.baseUrl || process.env.LLAMACPP_BASE_URL || 'http://localhost:8080';
    // モデル名 (llama-serverでは任意の文字列でOK)
    this.modelName = this.model || process.env.LLAMACPP_MODEL_NAME || 'local-model';
  }

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();

    try {
      const response = await noTimeoutFetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            ...(personality ? [{ role: 'system', content: personality }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: this.temperature,
          top_p: this.topP,
          top_k: this.topK,
          repeat_penalty: this.repetitionPenalty,
          presence_penalty: this.presencePenalty,
          frequency_penalty: this.frequencyPenalty,
          max_tokens: this.maxTokens || 4000,
          stream: false
        })
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${errorText}`;

        // 接続エラーの特別処理
        if (response.status === 0 || errorText.includes('ECONNREFUSED')) {
          errorMessage = `Connection failed to llama.cpp server at ${this.baseUrl}. Please ensure llama-server is running with: llama-server -m <model_path> --port 8080`;
        }

        return {
          content: this.generateFallbackResponse(prompt),
          model: this.modelName,
          duration,
          success: false,
          error: errorMessage,
          errorDetails: {
            type: 'HTTP_ERROR',
            message: errorMessage,
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
        model: this.modelName,
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

        // 接続エラーの特別処理
        if (errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('ENOTFOUND')) {
          errorMessage = `Connection failed to llama.cpp server at ${this.baseUrl}. Please ensure llama-server is running with: llama-server -m <model_path> --port 8080`;
        }

        // タイムアウトエラー
        if (errorMessage.includes('timeout') ||
            errorMessage.includes('ETIMEDOUT')) {
          errorMessage = `Request timeout. The llama.cpp server may be taking too long to respond or is still loading the model.`;
        }
      }

      return {
        content: this.generateFallbackResponse(prompt),
        model: this.modelName,
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

// llama.cpp Local Implementation using node-llama-cpp
// Loads and runs GGUF models directly in Node.js without external server
export class LlamaCppLocalExecutor extends AIExecutor {
  private modelPath: string;
  private contextSize: number;
  private gpuLayers: number;

  // 静的フィールドでモデルインスタンスを共有（シングルトンパターン）
  // モデルは共有するが、コンテキストは各インスタンスごとに保持
  private static sharedLlama: Llama | null = null;
  private static sharedLlamaModel: LlamaModel | null = null;
  private static sharedModelPath: string | null = null;
  private static sharedGpuLayers: number | null = null;

  // コンテキストは各インスタンスごとに保持
  private llamaContext: LlamaContext | null = null;

  constructor(options: AIExecutorOptions) {
    super(options);
    // モデルファイルのパス (.ggufファイル)
    this.modelPath = this.customConfig.modelPath || process.env.LLAMACPP_MODEL_PATH || '';
    // コンテキストサイズ (デフォルト: 4096)
    this.contextSize = this.customConfig.contextSize || 4096;
    // GPU レイヤー数 (デフォルト: 0 = CPU only)
    this.gpuLayers = this.customConfig.gpuLayers !== undefined ? this.customConfig.gpuLayers : 0;

    if (!this.modelPath) {
      console.warn(`[LlamaCppLocalExecutor] No model path provided. Set LLAMACPP_MODEL_PATH in .env or provide modelPath in customConfig.`);
    }
  }

  private async initializeModel(): Promise<void> {
    if (!this.modelPath) {
      throw new Error('Model path not configured. Set LLAMACPP_MODEL_PATH in .env or provide modelPath in customConfig.');
    }

    // モデルが既にロード済みで、設定が同じかチェック
    const modelChanged = LlamaCppLocalExecutor.sharedLlamaModel &&
      (LlamaCppLocalExecutor.sharedModelPath !== this.modelPath ||
       LlamaCppLocalExecutor.sharedGpuLayers !== this.gpuLayers);

    // 設定が変わった場合は古いモデルを破棄
    if (modelChanged) {
      console.log(`[LlamaCppLocalExecutor] Model configuration changed, disposing old model...`);
      await this.disposeSharedModel();
    }

    // モデルをロード（まだロードされていない場合）
    if (!LlamaCppLocalExecutor.sharedLlamaModel) {
      try {
        console.log(`[LlamaCppLocalExecutor] Initializing llama.cpp with model: ${this.modelPath}`);
        console.log(`[LlamaCppLocalExecutor] GPU layers: ${this.gpuLayers}`);

        // Llama インスタンスを取得
        LlamaCppLocalExecutor.sharedLlama = await getLlama();

        // モデルをロード
        LlamaCppLocalExecutor.sharedLlamaModel = await LlamaCppLocalExecutor.sharedLlama.loadModel({
          modelPath: this.modelPath,
          gpuLayers: this.gpuLayers,
        });

        // 設定を保存
        LlamaCppLocalExecutor.sharedModelPath = this.modelPath;
        LlamaCppLocalExecutor.sharedGpuLayers = this.gpuLayers;

        console.log(`[LlamaCppLocalExecutor] Model loaded successfully (shared across all instances)`);
      } catch (error) {
        console.error(`[LlamaCppLocalExecutor] Failed to load model:`, error);
        throw error;
      }
    } else {
      console.log(`[LlamaCppLocalExecutor] Reusing already loaded model`);
    }

    // このインスタンス用のコンテキストとシーケンスを作成（まだ作成されていない場合）
    if (!this.llamaContext) {
      await this.createContextWithRetry();
    }
  }

  /**
   * Create context with exponential backoff retry for VRAM issues
   */
  private async createContextWithRetry(retryCount: number = 0): Promise<void> {
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 2000; // 2 seconds base delay

    try {
      console.log(`[LlamaCppLocalExecutor] Creating context for this instance (context size: ${this.contextSize})`);
      this.llamaContext = await LlamaCppLocalExecutor.sharedLlamaModel!.createContext({
        contextSize: this.contextSize,
      });

      console.log(`[LlamaCppLocalExecutor] ✅ Context created successfully`);

    } catch (error: any) {
      const isVramError = error?.name === 'InsufficientMemoryError' ||
                         error?.message?.includes('too large for the available VRAM');

      if (isVramError && retryCount < MAX_RETRIES) {
        // 指数バックオフ: 2s, 4s, 8s, 16s, 32s
        const delayMs = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.warn(`[LlamaCppLocalExecutor] ⚠️ VRAM insufficient (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        console.log(`[LlamaCppLocalExecutor] Waiting ${delayMs}ms before retry (exponential backoff)...`);

        await this.sleep(delayMs);

        console.log(`[LlamaCppLocalExecutor] Retrying context creation...`);
        return await this.createContextWithRetry(retryCount + 1);
      } else if (isVramError) {
        // リトライ上限到達
        console.error(`[LlamaCppLocalExecutor] ❌ VRAM insufficient after ${MAX_RETRIES} retries. Please close other applications or reduce context size.`);
        throw new Error(`VRAM insufficient after ${MAX_RETRIES} retries with exponential backoff (up to ${BASE_DELAY_MS * Math.pow(2, MAX_RETRIES - 1)}ms delay)`);
      } else {
        // VRAM以外のエラーは即座に投げる
        console.error(`[LlamaCppLocalExecutor] Failed to create context:`, error);
        throw error;
      }
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async disposeSharedModel(): Promise<void> {
    try {
      if (LlamaCppLocalExecutor.sharedLlamaModel) {
        await LlamaCppLocalExecutor.sharedLlamaModel.dispose();
        LlamaCppLocalExecutor.sharedLlamaModel = null;
      }
      LlamaCppLocalExecutor.sharedLlama = null;
      LlamaCppLocalExecutor.sharedModelPath = null;
      LlamaCppLocalExecutor.sharedGpuLayers = null;
      console.log(`[LlamaCppLocalExecutor] Shared model disposed successfully`);
    } catch (error) {
      console.error(`[LlamaCppLocalExecutor] Error during shared model disposal:`, error);
    }
  }

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    let session: LlamaChatSession | null = null;
    let contextSequence: any = null; // LlamaContextSequence (毎回新規取得)

    try {
      // モデルを初期化（初回のみ、または設定変更時）
      await this.initializeModel();

      if (!this.llamaContext) {
        throw new Error('Context not initialized');
      }

      console.log(`[LlamaCppLocalExecutor] Generating response...`);

      // 新しいシーケンスを取得（VRAM解放のため毎回新規取得）
      contextSequence = this.llamaContext.getSequence();

      // 新しいセッションを作成
      session = new LlamaChatSession({
        contextSequence: contextSequence,
        systemPrompt: personality || undefined,
      });

      // プロンプトを実行
      const response = await session.prompt(prompt, {
        temperature: this.temperature,
        topP: this.topP,
        topK: this.topK,
        repeatPenalty: {
          penalty: this.repetitionPenalty,
        },
        maxTokens: this.maxTokens || 4000,
      });

      const duration = Date.now() - startTime;

      console.log(`[LlamaCppLocalExecutor] Response generated in ${duration}ms`);

      // セッションを破棄
      await session.dispose();

      // コンテキストを破棄して再作成（VRAMリーク防止）
      // 独立した推論を繰り返す場合、コンテキストごとリセットが最も確実
      console.log(`[LlamaCppLocalExecutor] Disposing context to prevent VRAM leak...`);
      await this.llamaContext.dispose();
      this.llamaContext = null;
      // 次回実行時に initializeModel() で再作成される

      return {
        content: this.sanitizeContent(response),
        model: this.modelPath,
        duration,
        success: true
      };
    } catch (error) {
      // エラー時もセッションを破棄
      if (session) {
        try {
          await session.dispose();
        } catch (disposeError) {
          console.error(`[LlamaCppLocalExecutor] Error disposing session:`, disposeError);
        }
      }

      // エラー時もコンテキストをクリーンアップ
      if (this.llamaContext) {
        try {
          await this.llamaContext.dispose();
          this.llamaContext = null;
          console.log(`[LlamaCppLocalExecutor] Context disposed after error`);
        } catch (e) {
          console.warn(`[LlamaCppLocalExecutor] Error disposing context (ignoring):`, e);
        }
      }
      const duration = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      let errorStack: string | undefined = undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;

        // モデルファイルが見つからないエラー
        if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
          errorMessage = `Model file not found at ${this.modelPath}. Please check the path in LLAMACPP_MODEL_PATH.`;
        }

        // メモリ不足エラー
        if (errorMessage.includes('out of memory') || errorMessage.includes('ENOMEM')) {
          errorMessage = `Out of memory. The model may be too large for available RAM. Try reducing context size or GPU layers.`;
        }

        // GGUF フォーマットエラー
        if (errorMessage.includes('gguf') || errorMessage.includes('invalid format')) {
          errorMessage = `Invalid GGUF file format. Please ensure ${this.modelPath} is a valid GGUF model file.`;
        }
      }

      console.error(`[LlamaCppLocalExecutor] Error:`, errorMessage);

      return {
        content: this.generateFallbackResponse(prompt),
        model: this.modelPath,
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

  // クリーンアップメソッド（必要に応じて呼び出す）
  async dispose(): Promise<void> {
    try {
      // このインスタンスのコンテキストを破棄
      if (this.llamaContext) {
        await this.llamaContext.dispose();
        this.llamaContext = null;
        console.log(`[LlamaCppLocalExecutor] Instance context disposed successfully`);
      }
    } catch (error) {
      console.error(`[LlamaCppLocalExecutor] Error during instance disposal:`, error);
    }
  }

  // 共有モデルを完全に破棄（通常は使用しない）
  static async disposeAllSharedResources(): Promise<void> {
    try {
      if (LlamaCppLocalExecutor.sharedLlamaModel) {
        await LlamaCppLocalExecutor.sharedLlamaModel.dispose();
        LlamaCppLocalExecutor.sharedLlamaModel = null;
      }
      LlamaCppLocalExecutor.sharedLlama = null;
      LlamaCppLocalExecutor.sharedModelPath = null;
      LlamaCppLocalExecutor.sharedGpuLayers = null;
      console.log(`[LlamaCppLocalExecutor] All shared resources disposed successfully`);
    } catch (error) {
      console.error(`[LlamaCppLocalExecutor] Error during shared resources disposal:`, error);
    }
  }
}
