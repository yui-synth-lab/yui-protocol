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