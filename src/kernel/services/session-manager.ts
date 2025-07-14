import { Session, Agent } from '../../types/index.js';
import { SessionStorage } from '../session-storage.js';
import { IAgentManager } from '../interfaces.js';
import { Message } from '../../types/index.js';

export class SessionManager {
  private sessionStorage: SessionStorage;
  private agentManager: IAgentManager;
  private sessions: Map<string, Session> = new Map();
  private nextSessionId: number = 1;

  constructor(sessionStorage: SessionStorage, agentManager: IAgentManager) {
    this.sessionStorage = sessionStorage;
    this.agentManager = agentManager;
    this.initializeNextSessionId();
  }

  private async initializeNextSessionId(): Promise<void> {
    try {
      const allSessions = await this.sessionStorage.getAllSessions();
      if (allSessions.length > 0) {
        // 既存のセッションから最大のIDを取得
        const maxId = Math.max(...allSessions.map(s => {
          const id = parseInt(s.id, 10);
          return isNaN(id) ? 0 : id;
        }));
        this.nextSessionId = maxId + 1;
      }
    } catch (error) {
      console.warn('[SessionManager] Could not initialize next session ID, starting from 1:', error);
      this.nextSessionId = 1;
    }
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    // メモリ内のセッションを先にチェック
    let session = this.sessions.get(sessionId);
    
    // メモリ内にない場合は永続化されたセッションから読み込み
    if (!session) {
      const loadedSession = await this.sessionStorage.loadSession(sessionId);
      if (loadedSession) {
        this.sessions.set(sessionId, loadedSession);
        session = loadedSession;
      }
    }
    
    return session;
  }

  async getAllSessions(): Promise<Session[]> {
    // 永続化されたセッションも読み込む
    const storedSessions = await this.sessionStorage.getAllSessions();
    
    // メモリ内のセッションと永続化されたセッションをマージ
    const allSessions = new Map<string, Session>();
    
    // 永続化されたセッションを先に読み込み
    for (const session of storedSessions) {
      allSessions.set(session.id, session);
      this.sessions.set(session.id, session);
    }
    
    // メモリ内のセッションを追加（永続化されたセッションを上書き）
    for (const [id, session] of this.sessions) {
      allSessions.set(id, session);
    }
    
    return Array.from(allSessions.values());
  }

  async createSession(title: string, agentIds: string[], language: string): Promise<Session> {
    // 次のセッションIDを取得
    const sessionId = this.nextSessionId.toString();
    this.nextSessionId++;

    // エージェントの取得と検証
    const agents: Agent[] = [];
    for (const id of agentIds) {
      const agentInstance = this.agentManager.getAgent(id);
      if (!agentInstance) {
        console.warn(`[SessionManager] Agent not found: ${id}`);
        continue;
      }
      const agent = agentInstance.getAgent();
      if (!agent) {
        console.warn(`[SessionManager] Agent data not available: ${id}`);
        continue;
      }
      agents.push(agent);
      
      // 新しいセッション作成時にサマライザー設定をリセット
      agentInstance.setIsSummarizer(false);
    }

    if (agents.length === 0) {
      throw new Error('No valid agents found for session creation');
    }

    const session: Session = {
      id: sessionId,
      title,
      agents,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      stageHistory: [],
      language: language as any,
      sequenceNumber: 1  // 新規セッションは1から始まる
    };
    this.sessions.set(session.id, session);
    await this.saveSession(session);
    return session;
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
    await this.sessionStorage.saveSession(session);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    this.sessions.delete(sessionId);
    return this.sessionStorage.deleteSession(sessionId);
  }

  async resetSession(sessionId: string): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    // セッションリセット時にすべてのエージェントのサマライザー設定をリセット
    for (const agent of session.agents) {
      const agentInstance = this.agentManager.getAgent(agent.id);
      if (agentInstance) {
        agentInstance.setIsSummarizer(false);
      }
    }
    
    session.messages = [];
    session.stageHistory = [];
    session.sequenceNumber = 1;  // リセット時も1から始める
    session.updatedAt = new Date();
    await this.saveSession(session);
    return session;
  }

  async startNewSequence(sessionId: string, userPrompt?: string): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    // 新しいシーケンス開始時にすべてのエージェントのサマライザー設定をリセット
    for (const agent of session.agents) {
      const agentInstance = this.agentManager.getAgent(agent.id);
      if (agentInstance) {
        agentInstance.setIsSummarizer(false);
      }
    }
    
    session.sequenceNumber = (session.sequenceNumber || 1) + 1;
    session.currentStage = undefined; // 新しいシーケンスの最初のステージをリセット
    session.status = 'active';
    session.stageHistory = []; // 新しいシーケンス開始時に履歴をリセット
    
    // ユーザーメッセージをセッションに保存
    if (userPrompt) {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        agentId: 'user',
        content: userPrompt,
        timestamp: new Date(),
        role: 'user',
        sequenceNumber: session.sequenceNumber
      };
      session.messages.push(userMessage);
    }
    
    session.updatedAt = new Date();
    await this.saveSession(session);
    return session;
  }

  /**
   * 前回シーケンスのユーザー入力とエージェント結論を抽出
   */
  getPreviousSequenceInfo(session: Session): {
    previousUserInput: string;
    previousAgentConclusions: { [agentId: string]: string };
  } {
    const previousSequenceNumber = (session.sequenceNumber || 2) - 1;
    // 前回シーケンスのユーザーメッセージを取得
    const previousUserMessage = session.messages.find(
      m => m.role === 'user' && m.sequenceNumber === previousSequenceNumber
    );
    const previousUserInput = previousUserMessage?.content || '';

    // 前回シーケンスのエージェント結論を取得
    const previousAgentConclusions: { [agentId: string]: string } = {};
    // 優先順位: finalize → output-generation → synthesis-attempt → 最後のagentメッセージ
    const stagesPriority = ['finalize', 'output-generation', 'synthesis-attempt'];
    for (const agent of session.agents) {
      let conclusionMsg: Message | undefined = undefined;
      for (const stage of stagesPriority) {
        conclusionMsg = session.messages.find(
          (m: Message) => m.role === 'agent' &&
               m.sequenceNumber === previousSequenceNumber &&
               m.stage === stage &&
               m.agentId === agent.id
        );
        if (conclusionMsg) break;
      }
      // fallback: そのシーケンスの最後のagentメッセージ
      if (!conclusionMsg) {
        const agentMsgs: Message[] = session.messages.filter(
          (m: Message) => m.role === 'agent' &&
               m.sequenceNumber === previousSequenceNumber &&
               m.agentId === agent.id
        );
        if (agentMsgs.length > 0) {
          // timestamp降順で一番新しいもの
          agentMsgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          conclusionMsg = agentMsgs[0];
        }
      }
      if (conclusionMsg && typeof conclusionMsg.content === 'string') {
        previousAgentConclusions[agent.id] = conclusionMsg.content.slice(0, 200);
      }
    }
    return {
      previousUserInput,
      previousAgentConclusions
    };
  }
} 