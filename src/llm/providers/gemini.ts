import { AIExecutor, AIExecutorOptions, AIExecutionResult } from '../../kernel/ai-executor.js';
import {
  GoogleGenAI,
} from '@google/genai';

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
    let tokensUsed: number | undefined;
    for await (const chunk of response) {
      content += chunk?.text || '';
      // usageMetadata はストリーム終端のチャンクに載るため、見つかる度に上書きする
      if (chunk?.usageMetadata?.totalTokenCount) {
        tokensUsed = chunk.usageMetadata.totalTokenCount;
      }
    }
    return {
      content: this.sanitizeContent(content),
      tokensUsed,
      model: this.model,
      duration: Date.now() - startTime,
      success: true
    };
  }
}
