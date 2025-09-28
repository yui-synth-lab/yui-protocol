import { Message } from './index.js';

// 記憶の階層化インターフェース
export interface LayeredMemory {
  shortTerm: Message[];           // 直近3-5発言（完全保持）
  mediumTerm: SessionSummary;     // セッション要約（圧縮保持）
  longTerm: AgentPersonalHistory; // エージェント個人史（キーワード保持）
}

export interface SelfSummary {
  agentId: string;
  originalMessage: string;
  essence: string;        // 50文字以内の核心
  emotion: string;        // 感情的トーン
  keyTerms: string[];     // 重要キーワード
  relationTo: string[];   // 他エージェントとの関連
  timestamp: Date;
}

export interface SessionSummary {
  sessionId: string;
  mainTopics: string[];
  keyExchanges: SelfSummary[];
  unresolvedPoints: string[];
  convergenceLevel: number; // 0-10の合意度
}

export interface AgentPersonalHistory {
  agentId: string;
  coreBeliefs: string[];
  frequentTopics: string[];
  relationshipMap: Record<string, string>; // 他エージェントとの関係性
  memorableQuotes: string[];
}

export interface ConversationContext {
  recentFull: Message[];
  summarizedMid: string;
  essenceCore: string[];
  totalTokenEstimate: number;
}

// v2.0用の改善されたメモリ構造
export interface MemoryLayer {
  agentId: string;
  recent: Message[];           // 直近5メッセージ
  compressed: CompressedMemory[]; // 圧縮済み記憶
  totalTokensEstimate: number;
}

export interface CompressedMemory {
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: string;              // 圧縮された要約
  keypoints: string[];          // 重要なポイント
  ownContributions: string[];   // 自分の発言要点
  originalTokenCount: number;   // 元のトークン数
  compressedTokenCount: number; // 圧縮後のトークン数
  compressionRatio: number;     // 圧縮率
}

export interface AgentMemoryContext {
  agentId: string;
  ownRecentMessages: Message[];     // 自分の直近発言
  othersRecentMessages: Message[];  // 他者の直近発言
  compressedHistory: CompressedMemory[]; // 圧縮された長期記憶
  totalContextTokens: number;
}

export interface MemoryCompressionConfig {
  maxRecentMessages: number;    // 直近メッセージ保持数
  tokenThreshold: number;       // 圧縮開始閾値
  compressionRatio: number;     // 目標圧縮率
  personalityAware: boolean;    // 個性反映圧縮
}