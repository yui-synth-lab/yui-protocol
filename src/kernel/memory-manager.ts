import { Message } from '../types/index.js';
import { ConversationContext, SelfSummary, AgentPersonalHistory, MemoryLayer, CompressedMemory, AgentMemoryContext, MemoryCompressionConfig } from '../types/memory.js';
import { AIExecutor, createAIExecutor } from './ai-executor.js';
import { getV2MemoryConfig } from '../config/v2-config-loader.js';

export class ConversationMemoryManager {
  private aiExecutor?: AIExecutor;

  constructor() {
    // AI Executor for summarization
    this.aiExecutor = undefined; // Will be initialized lazily
  }
}

// v2.0 記憶階層化システム
export class MemoryManager {
  private layers: Map<string, MemoryLayer> = new Map();
  private aiExecutor?: AIExecutor;
  private config: MemoryCompressionConfig;

  constructor() {
    this.config = getV2MemoryConfig();
    this.initializeAIExecutor();
  }

  private async initializeAIExecutor() {
    this.aiExecutor = await createAIExecutor('memory-compressor', {
      model: process.env.MEMORY_COMPRESSOR_MODEL,
      temperature: 0.3,
      topP: 0.8,
      topK: 20
    });
  }

  async updateAgentMemory(agentId: string, newMessages: Message[]): Promise<void> {
    let layer = this.layers.get(agentId);

    if (!layer) {
      layer = {
        agentId,
        recent: [],
        compressed: [],
        totalTokensEstimate: 0
      };
      this.layers.set(agentId, layer);
    }

    // 新しいメッセージを追加
    layer.recent.push(...newMessages);

    // 直近メッセージ数制限を適用
    if (layer.recent.length > this.config.maxRecentMessages) {
      const excess = layer.recent.length - this.config.maxRecentMessages;
      const toCompress = layer.recent.splice(0, excess);

      // 圧縮が必要な場合
      if (toCompress.length > 0) {
        await this.compressMessages(agentId, toCompress);
      }
    }

    // トークン数推定更新
    layer.totalTokensEstimate = this.estimateTokens(layer);
  }

  private async compressMessages(agentId: string, messages: Message[]): Promise<void> {
    if (!this.aiExecutor) {
      await this.initializeAIExecutor();
    }

    const layer = this.layers.get(agentId)!;

    // 自分の発言と他者の発言を分離
    const ownMessages = messages.filter(m => m.agentId === agentId);
    const othersMessages = messages.filter(m => m.agentId !== agentId);

    const compressionPrompt = `
議論の記憶を圧縮してください。以下の情報を抽出してください：

## 圧縮対象の会話:
${messages.map(m => `${m.agentId}: ${m.content}`).join('\n\n')}

## 抽出すべき情報（JSON形式で返答）:
{
  "summary": "議論の要約（200文字以内）",
  "keypoints": ["重要なポイント1", "重要なポイント2"],
  "ownContributions": ["自分（${agentId}）の主要な発言要点"],
  "originalTokenCount": ${this.estimateMessageTokens(messages)},
  "compressedTokenCount": "圧縮後の推定トークン数"
}

IMPORTANT: エージェントの個性を反映し、自分の発言履歴を正確に記録してください。
`;

    try {
      const result = await this.aiExecutor!.execute(compressionPrompt, '');
      const compressionData = JSON.parse(result.content);

      const compressed: CompressedMemory = {
        timeRange: {
          start: messages[0].timestamp,
          end: messages[messages.length - 1].timestamp
        },
        summary: compressionData.summary,
        keypoints: compressionData.keypoints || [],
        ownContributions: compressionData.ownContributions || [],
        originalTokenCount: compressionData.originalTokenCount,
        compressedTokenCount: parseInt(compressionData.compressedTokenCount) ||
                             Math.floor(compressionData.originalTokenCount * this.config.compressionRatio),
        compressionRatio: this.config.compressionRatio
      };

      layer.compressed.push(compressed);

      console.log(`[MemoryManager] Compressed ${messages.length} messages for ${agentId}. ` +
                  `Ratio: ${(compressed.compressedTokenCount / compressed.originalTokenCount * 100).toFixed(1)}%`);

    } catch (error) {
      console.error(`[MemoryManager] Compression failed for ${agentId}:`, error);

      // フォールバック: 簡単な要約
      const fallbackCompressed: CompressedMemory = {
        timeRange: {
          start: messages[0].timestamp,
          end: messages[messages.length - 1].timestamp
        },
        summary: `議論：${messages.length}件のメッセージ`,
        keypoints: [],
        ownContributions: ownMessages.map(m => m.content.slice(0, 50) + '...'),
        originalTokenCount: this.estimateMessageTokens(messages),
        compressedTokenCount: Math.floor(this.estimateMessageTokens(messages) * this.config.compressionRatio),
        compressionRatio: this.config.compressionRatio
      };

      layer.compressed.push(fallbackCompressed);
    }
  }

  getAgentMemoryContext(agentId: string, allMessages: Message[]): AgentMemoryContext {
    const layer = this.layers.get(agentId) || {
      agentId,
      recent: [],
      compressed: [],
      totalTokensEstimate: 0
    };

    // 自分と他者の直近メッセージを分離
    const recentMessages = allMessages.slice(-10); // 直近10メッセージから分析
    const ownRecentMessages = recentMessages.filter(m => m.agentId === agentId);
    const othersRecentMessages = recentMessages.filter(m => m.agentId !== agentId && m.agentId !== 'user');

    return {
      agentId,
      ownRecentMessages,
      othersRecentMessages,
      compressedHistory: layer.compressed,
      totalContextTokens: this.estimateContextTokens(ownRecentMessages, othersRecentMessages, layer.compressed)
    };
  }

  // プロンプト生成時に使用：自分の発言履歴を含む改善されたコンテキスト
  generateEnhancedContext(agentId: string, allMessages: Message[]): string {
    const memoryContext = this.getAgentMemoryContext(agentId, allMessages);

    let context = '';

    // 圧縮された過去の記憶
    if (memoryContext.compressedHistory.length > 0) {
      context += 'COMPRESSED MEMORY:\n';
      memoryContext.compressedHistory.forEach((comp, index) => {
        context += `Past Discussion ${index + 1}: ${comp.summary}\n`;
        if (comp.ownContributions.length > 0) {
          context += `Your previous contributions: ${comp.ownContributions.join('; ')}\n`;
        }
      });
      context += '\n';
    }

    // 自分の最近の発言
    if (memoryContext.ownRecentMessages.length > 0) {
      context += 'YOUR RECENT CONTRIBUTIONS:\n';
      memoryContext.ownRecentMessages.forEach(msg => {
        context += `You (${agentId}): "${msg.content.slice(0, 150)}..."\n`;
      });
      context += '\n';
    }

    // 他者の最近の発言
    if (memoryContext.othersRecentMessages.length > 0) {
      context += 'RECENT CONTEXT FROM OTHER AGENTS:\n';
      memoryContext.othersRecentMessages.forEach(msg => {
        context += `${msg.agentId}: "${msg.content.slice(0, 150)}..."\n`;
      });
    }

    return context;
  }

  private estimateTokens(layer: MemoryLayer): number {
    const recentTokens = this.estimateMessageTokens(layer.recent);
    const compressedTokens = layer.compressed.reduce((sum, comp) => sum + comp.compressedTokenCount, 0);
    return recentTokens + compressedTokens;
  }

  private estimateMessageTokens(messages: Message[]): number {
    // 簡易的なトークン数推定（英語: 単語数/0.75, 日本語: 文字数/2）
    return messages.reduce((sum, msg) => {
      const content = msg.content;
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(content);

      if (hasJapanese) {
        return sum + Math.ceil(content.length / 2);
      } else {
        return sum + Math.ceil(content.split(/\s+/).length / 0.75);
      }
    }, 0);
  }

  private estimateContextTokens(
    ownMessages: Message[],
    othersMessages: Message[],
    compressed: CompressedMemory[]
  ): number {
    return this.estimateMessageTokens(ownMessages) +
           this.estimateMessageTokens(othersMessages) +
           compressed.reduce((sum, comp) => sum + comp.compressedTokenCount, 0);
  }

  // 統計情報取得
  getMemoryStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.layers.forEach((layer, agentId) => {
      stats[agentId] = {
        recentMessages: layer.recent.length,
        compressedChunks: layer.compressed.length,
        totalTokens: layer.totalTokensEstimate,
        compressionSavings: layer.compressed.reduce(
          (sum, comp) => sum + (comp.originalTokenCount - comp.compressedTokenCount),
          0
        )
      };
    });

    return stats;
  }

  // メモリクリア（セッション終了時）
  clearSession(): void {
    this.layers.clear();
    console.log('[MemoryManager] Session memory cleared');
  }

  private async getAIExecutor(): Promise<AIExecutor> {
    if (!this.aiExecutor) {
      this.aiExecutor = await createAIExecutor('memory-manager', {
        model: process.env.MEMORY_MANAGER_MODEL,
        temperature: 0.3,
        topP: 0.9
      });
    }
    return this.aiExecutor;
  }

  async compressIfNeeded(messages: Message[], agentId: string): Promise<ConversationContext> {
    const estimatedTokens = this.estimateTokensFromMessages(messages);

    const memoryConfig = getV2MemoryConfig();
    if (estimatedTokens > memoryConfig.tokenThreshold) {
      return await this.compressContext(messages, agentId);
    }

    return {
      recentFull: messages,
      summarizedMid: '',
      essenceCore: [],
      totalTokenEstimate: estimatedTokens
    };
  }

  private async compressContext(messages: Message[], agentId: string): Promise<ConversationContext> {
    const memoryConfig = getV2MemoryConfig();
    const recent = messages.slice(-memoryConfig.maxRecentMessages);
    const mid = messages.slice(-15, -memoryConfig.maxRecentMessages);
    const old = messages.slice(0, -15);

    const summarizedMid = await this.summarizeMessages(mid, agentId);
    const essenceCore = await this.extractEssence(old, agentId);

    return {
      recentFull: recent,
      summarizedMid,
      essenceCore,
      totalTokenEstimate: this.estimateCompressedTokens(recent, summarizedMid, essenceCore)
    };
  }

  private async summarizeMessages(messages: Message[], agentId: string): Promise<string> {
    if (messages.length === 0) return '';

    const executor = await this.getAIExecutor();
    const messagesText = messages.map(m => `${m.agentId}: ${m.content}`).join('\n\n');

    const prompt = `
Summarize the following conversation segment from the perspective of agent ${agentId}.
Focus on key points, main arguments, and important insights.
Keep it concise but capture the essence of the discussion.

Conversation:
${messagesText}

Summary (max 200 words):`;

    const result = await executor.execute(prompt, '');
    return result.content;
  }

  private async extractEssence(messages: Message[], agentId: string): Promise<string[]> {
    if (messages.length === 0) return [];

    const executor = await this.getAIExecutor();
    const messagesText = messages.map(m => `${m.agentId}: ${m.content}`).join('\n\n');

    const prompt = `
Extract 3-5 key themes, concepts, or memorable quotes from this conversation.
Return them as a simple list, one per line.

Conversation:
${messagesText}

Key themes/concepts:`;

    const result = await executor.execute(prompt, '');
    return result.content.split('\n').filter(line => line.trim()).slice(0, 5);
  }

  private estimateTokensFromMessages(messages: Message[]): number {
    const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalLength / 4); // Rough estimation: 1 token per 4 characters
  }

  private estimateCompressedTokens(recent: Message[], summary: string, essence: string[]): number {
    const recentTokens = this.estimateTokensFromMessages(recent);
    const summaryTokens = Math.ceil(summary.length / 4);
    const essenceTokens = Math.ceil(essence.join(' ').length / 4);
    return recentTokens + summaryTokens + essenceTokens;
  }

  // Agent-specific memory patterns
  getMemoryPattern(agentId: string): 'logical' | 'emotional' | 'analytical' | 'poetic' | 'critical' {
    const patterns: Record<string, 'logical' | 'emotional' | 'analytical' | 'poetic' | 'critical'> = {
      'eiro-001': 'logical',
      'yui-000': 'emotional',
      'hekito-001': 'analytical',
      'yoga-001': 'poetic',
      'kanshi-001': 'critical'
    };
    return patterns[agentId] || 'logical';
  }
}