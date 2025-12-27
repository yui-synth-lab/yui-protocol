import { spawn } from 'child_process';
import { AIExecutor, AIExecutorOptions, AIExecutionResult } from './ai-executor.js';
import {
  GoogleGenAI,
} from '@google/genai';
import { Ollama } from 'ollama';
import { Agent } from 'undici';
import { getLlama, Llama, LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';

const noTimeoutFetch = (input: string | URL | globalThis.Request, init?: RequestInit) => {
  const someInit = init || {}

  return fetch(input, { ...someInit, dispatcher: new Agent({ headersTimeout: 2700000 }) } as any)
}

// Gemini CLI Implementation
export class GeminiCliExecutor extends AIExecutor {
  private path: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.path = this.customConfig.path || 'C:\\Users\\yuyay\\AppData\\Roaming\\npm\\gemini.cmd';
  }

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    // system message非対応APIなので、personalityがあればpromptの先頭に付与
    const effectivePrompt = personality ? `${personality}\n\n${prompt}` : prompt;
    console.log(`[${this.agentId}] Calling Gemini CLI with prompt: ${prompt.substring(0, 100)}...`);

    return new Promise((resolve, reject) => {
      const gemini = spawn(this.path, ['-m', this.model], { shell: true });

      let output = '';
      let error = '';

      gemini.stdout.on('data', (data) => {
        console.log(`[${this.agentId}] Gemini stdout: ${data.toString().substring(0, 100)}...`);
        output += data.toString();
      });

      gemini.stderr.on('data', (data) => {
        console.log(`[${this.agentId}] Gemini stderr: ${data.toString().substring(0, 100)}...`);
        error += data.toString();
      });

      gemini.on('close', (code) => {
        const duration = Date.now() - startTime;
        console.log(`[${this.agentId}] Gemini process closed with code: ${code}`);

        if (code === 0) {
          console.log(`[${this.agentId}] Gemini CLI executed successfully!`);
          resolve({
            content: this.sanitizeContent(output.trim()),
            model: this.model,
            duration,
            success: true
          });
        } else {
          console.warn(`[${this.agentId}] Gemini CLI failed with code ${code}: ${error}`);
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
        console.warn(`[${this.agentId}] Gemini CLI error: ${err.message}`);
        resolve({
          content: this.generateFallbackResponse(prompt),
          model: this.model,
          duration,
          success: false,
          error: err.message
        });
      });

      // Send the actual prompt via stdin
      console.log(`[${this.agentId}] Writing prompt to stdin...`);
      gemini.stdin.write(effectivePrompt);
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

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    const contents = [
      ...(personality ? [{ role: 'model', parts: [{ text: personality }] }] : []),
      {
        role: 'user',
        parts: [
          { text: prompt },
        ],
      },
    ];

    // Gemini 3 models strongly recommend temperature=1.0 to avoid loops and performance degradation
    const isGemini3 = this.model.startsWith('gemini-3');
    const temperature = isGemini3 ? 1.0 : this.temperature;

    // Enable thinking for Pro models
    const isProModel = this.model.includes('-pro');
    const thinkingBudget = isProModel ? -1 : 0;

    const config = {
      thinkingConfig: {
        thinkingBudget,
      },
      responseMimeType: 'text/plain',
      temperature,
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
      const isGPT5Mini = this.model.includes('gpt-5-mini');

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
        // - GPT-5 mini only supports temperature=1 (omit for default)
        // - GPT-5.2+ supports temperature normally
        // - Does not support top_p, frequency_penalty, presence_penalty
        // - May include reasoning_tokens in completion_tokens
        requestBody.max_completion_tokens = this.maxTokens || 4000;

        // Only add temperature for GPT-5.2 and above (not mini/nano)
        if (!isGPT5Mini) {
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
      const response = await noTimeoutFetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          system: personality,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.temperature,
          top_k: this.topK//,
          // top_p: this.topP
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
  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    // system message非対応APIなので、personalityがあればpromptの先頭に付与
    const effectivePrompt = personality ? `${personality}\n\n${prompt}` : prompt;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const duration = Date.now() - startTime;

    // ステージサマリー用の特別な処理
    if (effectivePrompt.includes('CRITICAL OUTPUT FORMAT REQUIREMENT') || effectivePrompt.includes('You are one of the intelligent agents of the Yui Protocol')) {
      // エージェント名を抽出
      const agentNamesMatch = effectivePrompt.match(/Participating Agents: ([^\n]+)/);
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
    if (effectivePrompt.includes('STAGE 5 - OUTPUT GENERATION')) {
      // エージェントID候補を抽出（自分以外）
      const agentIdPattern = /Agent\s+ID\s*[:：]\s*([a-zA-Z0-9\-_]+)/g;
      const allIds = Array.from(effectivePrompt.matchAll(agentIdPattern)).map(m => m[1]);
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

      const content = `[${this.agentId}] Mock response: This is a simulated response to your query is "${effectivePrompt.substring(0, 100)}...".\n\n${randomVoteFormat}\n理由: このエージェントが最も適切だと思います。`;

      return {
        content,
        model: this.model,
        duration,
        success: true
      };
    }

    return {
      content: `[${this.agentId}] Mock response: This is a simulated response to your query about "${effectivePrompt.substring(0, 50)}...". In a real implementation, this would be processed by ${this.provider} using model ${this.model}.`,
      model: this.model,
      duration,
      success: true
    };
  }
}

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

  // コンテキストは各インスタンスごとに保持（シーケンス枯渇を防ぐ）
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

    // このインスタンス用のコンテキストを作成（まだ作成されていない場合）
    if (!this.llamaContext) {
      try {
        console.log(`[LlamaCppLocalExecutor] Creating context for this instance (context size: ${this.contextSize})`);
        this.llamaContext = await LlamaCppLocalExecutor.sharedLlamaModel!.createContext({
          contextSize: this.contextSize,
        });
        console.log(`[LlamaCppLocalExecutor] Context created successfully`);
      } catch (error) {
        console.error(`[LlamaCppLocalExecutor] Failed to create context:`, error);
        throw error;
      }
    }
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

    try {
      // モデルを初期化（初回のみ、または設定変更時）
      await this.initializeModel();

      if (!this.llamaContext) {
        throw new Error('Context not initialized');
      }

      console.log(`[LlamaCppLocalExecutor] Generating response...`);

      // personalityが変わるたびに新しいセッションを作成
      // これによりsystemPromptを適切に設定できる
      session = new LlamaChatSession({
        contextSequence: this.llamaContext.getSequence(),
        systemPrompt: personality || undefined, // personalityをsystemPromptとして設定
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