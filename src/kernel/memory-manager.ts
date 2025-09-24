import { Message } from '../types/index.js';
import { ConversationContext, SelfSummary, AgentPersonalHistory } from '../types/memory.js';
import { AIExecutor, createAIExecutor } from './ai-executor.js';
import { getV2MemoryConfig } from '../config/v2-config-loader.js';

export class ConversationMemoryManager {
  private aiExecutor?: AIExecutor;

  constructor() {
    // AI Executor for summarization
    this.aiExecutor = undefined; // Will be initialized lazily
  }

  private async getAIExecutor(): Promise<AIExecutor> {
    if (!this.aiExecutor) {
      this.aiExecutor = await createAIExecutor('memory-manager', {
        temperature: 0.3,
        topP: 0.9
      });
    }
    return this.aiExecutor;
  }

  async compressIfNeeded(messages: Message[], agentId: string): Promise<ConversationContext> {
    const estimatedTokens = this.estimateTokens(messages);

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

  private estimateTokens(messages: Message[]): number {
    const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalLength / 4); // Rough estimation: 1 token H 4 characters
  }

  private estimateCompressedTokens(recent: Message[], summary: string, essence: string[]): number {
    const recentTokens = this.estimateTokens(recent);
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