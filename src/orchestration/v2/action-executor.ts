// ファシリテーターアクションの実行（deep_dive / clarification / perspective_shift / summarize / redirect）。
// dynamic-router から抽出（Phase 3 残課題）。ロジックは抽出前と同一。
import type { DialogueAgent, FacilitatorPort } from '../../dialogue/contracts.js';
import type { DynamicInstruction, FacilitatorAction } from '../../types/consensus.js';
import type { DialogueStage, Language, Message } from '../../types/index.js';
import type { RAGRetriever } from '../../kernel/rag/rag-retriever.js';

/** ルーターが提供する実行時依存 */
export interface ActionExecutorRuntime {
  getOriginalQuery(): string;
  getFacilitator(): FacilitatorPort;
  getRagRetriever(): RAGRetriever | undefined;
  generateMessageId(): string;
  /** Round 1-2 は Initial Thoughts を含む完全文脈を構築する（ルーター側の状態に依存） */
  buildFullContext(recentMessages: Message[], excludeAgentId?: string): string;
  /** 発言バランスを考慮したエージェント選択（ルーター側の participation 状態に依存） */
  selectBalancedAgent(agents: DialogueAgent[], preferredStyle?: string, excludeRecent?: boolean): DialogueAgent;
  trackAgentParticipation(agentId: string): void;
  getParticipationCount(agentId: string): number | undefined;
  /** 現在のラウンド番号（contextNote の判定に使用） */
  getCurrentRound(): number;
}

export class FacilitatorActionExecutor {
  constructor(private runtime: ActionExecutorRuntime) {}

  async executeActions(
    actions: any[],
    agents: DialogueAgent[],
    messages: Message[],
    language: Language,
    recommendedActionCount?: number
  ): Promise<Message[]> {
    const newMessages: Message[] = [];

    // アクションを優先度順にソート
    const sortedActions = actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // 実行するアクション数を決定（推奨値またはデフォルト2）
    const actionCount = recommendedActionCount || 2;
    const actionsToExecute = sortedActions.slice(0, actionCount);

    console.log(`[DynamicRouter] Executing ${actionsToExecute.length} actions (recommended: ${recommendedActionCount || 'default'})`);

    // アクションを逐次実行し、各アクションの結果を次のアクションのコンテキストに含める
    for (let i = 0; i < actionsToExecute.length; i++) {
      const action = actionsToExecute[i];
      try {
        console.log(`[DynamicRouter] Executing action ${i + 1}/${actionsToExecute.length}: ${action.type} (target: ${action.target || 'auto'})`);

        // 現在までのメッセージ配列（元のmessages + このラウンドで既に生成されたメッセージ）
        const currentContext = [...messages, ...newMessages];

        const actionMessages = await this.executeAction(action, agents, currentContext, language);
        newMessages.push(...actionMessages);

        console.log(`[DynamicRouter] Action ${i + 1} completed, generated ${actionMessages.length} message(s)`);
      } catch (error) {
        console.error(`[DynamicRouter] Error executing action ${action.type}:`, error);
      }
    }

    console.log(`[DynamicRouter] Total messages generated in this round: ${newMessages.length}`);
    return newMessages;
  }

  /**
   * RAGで類似の過去結論を検索し、「不協和音」として注入する指示を生成
   * v2.0: 過去の結論を「正解」ではなく、現在の議論を揺さぶる素材として使用
   */
  async detectRAGDissonance(
    currentTopic: string,
    messages: Message[],
    minSimilarityThreshold: number = 0.75
  ): Promise<DynamicInstruction['ragDissonance'] | null> {
    const ragRetriever = this.runtime.getRagRetriever();
    if (!ragRetriever) {
      return null;
    }

    try {
      const recentContent = messages.slice(-5).map(m => m.content).join(' ');
      const queryText = `${currentTopic} ${recentContent.substring(0, 500)}`;

      const ragContext = await ragRetriever.retrieveEnhancedContext(queryText, {
        sourceType: ['session-history']
      });

      if (!ragContext || ragContext.retrievedKnowledge.length === 0) {
        return null;
      }

      const topResult = ragContext.retrievedKnowledge[0];

      if (topResult.score >= minSimilarityThreshold) {
        const pastConclusion = topResult.chunk.content.substring(0, 200);
        console.log(`[DynamicRouter] RAG dissonance found: similarity=${topResult.score.toFixed(2)}, source=${topResult.chunk.metadata.sessionId || 'unknown'}`);

        return {
          sourceSessionId: topResult.chunk.metadata.sessionId || 'unknown',
          sourceConclusionSummary: pastConclusion,
          similarityScore: topResult.score,
          deconstructionHint: `かつて「${pastConclusion}...」と結論づけられました。
しかし今の文脈で、この結論は不完全だったかもしれません。
何が変わったか？どんな新しい視点がこの理解に挑戦するか？
可能性Bを考慮してください。`
        };
      }

      return null;
    } catch (error) {
      console.error('[DynamicRouter] RAG dissonance detection failed:', error);
      return null;
    }
  }

  private async executeAction(
    action: FacilitatorAction,
    agents: DialogueAgent[],
    messages: Message[],
    language: Language
  ): Promise<Message[]> {
    const newMessages: Message[] = [];
    let success = false;
    let errorMessage: string | undefined;
    const agentResponses: string[] = [];

    // v2.0: RAG不協和音チェック（動的指示がない場合のみ）
    if (!action.dynamicInstruction && this.runtime.getRagRetriever()) {
      const ragDissonance = await this.detectRAGDissonance(this.runtime.getOriginalQuery(), messages);

      if (ragDissonance) {
        action.dynamicInstruction = {
          content: ragDissonance.deconstructionHint,
          tone: 'deconstructive',
          ragDissonance,
          metadata: {
            triggerReason: 'rag_similarity',
            generatedAt: new Date()
          }
        };
        console.log(`[DynamicRouter] RAG dissonance detected (similarity: ${ragDissonance.similarityScore.toFixed(2)}), adding deconstructive instruction`);
      }
    }

    try {
      switch (action.type) {
        case 'deep_dive':
          let targetAgent: DialogueAgent | undefined;
          if (action.target && action.target !== 'all' && action.target !== 'auto') {
            targetAgent = agents.find(a => a.getAgent().id === action.target);
            console.log(`[DynamicRouter] Deep dive target specified: ${action.target}, found: ${targetAgent ? 'yes' : 'no'}`);
          }
          if (!targetAgent) {
            // ターゲットが指定されていない、または見つからない場合はバランス良く選択
            targetAgent = this.runtime.selectBalancedAgent(agents);
            console.log(`[DynamicRouter] Deep dive target auto-selected: ${targetAgent.getAgent().id}`);
          }
          const deepDiveResponse = await this.askForDeepDive(targetAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(deepDiveResponse);
          agentResponses.push(`${targetAgent.getAgent().name}: ${deepDiveResponse.content.slice(0, 100)}...`);
          this.runtime.trackAgentParticipation(targetAgent.getAgent().id);
          console.log(`[DynamicRouter] Deep dive executed by ${targetAgent.getAgent().id}, new participation count: ${this.runtime.getParticipationCount(targetAgent.getAgent().id)}`);
          success = true;
          break;

        case 'clarification':
          let clarifyAgent: DialogueAgent | undefined;
          if (action.target && action.target !== 'all' && action.target !== 'auto') {
            clarifyAgent = agents.find(a => a.getAgent().id === action.target);
          }
          if (!clarifyAgent) {
            // ターゲットが指定されていない、または見つからない場合はバランス良く選択
            clarifyAgent = this.runtime.selectBalancedAgent(agents);
          }
          const clarificationResponse = await this.askForClarification(clarifyAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(clarificationResponse);
          agentResponses.push(`${clarifyAgent.getAgent().name}: ${clarificationResponse.content.slice(0, 100)}...`);
          this.runtime.trackAgentParticipation(clarifyAgent.getAgent().id);
          success = true;
          break;

        case 'perspective_shift':
          let perspectiveAgent: DialogueAgent | undefined;
          if (action.target && action.target !== 'all' && action.target !== 'auto') {
            perspectiveAgent = agents.find(a => a.getAgent().id === action.target);
          }
          if (!perspectiveAgent) {
            // ターゲットが指定されていない、または見つからない場合はバランス良く選択
            perspectiveAgent = this.runtime.selectBalancedAgent(agents, undefined, true);
          }
          const perspectiveResponse = await this.askForPerspectiveShift(perspectiveAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(perspectiveResponse);
          agentResponses.push(`${perspectiveAgent.getAgent().name}: ${perspectiveResponse.content.slice(0, 100)}...`);
          this.runtime.trackAgentParticipation(perspectiveAgent.getAgent().id);
          success = true;
          break;

        case 'summarize':
          // 論理的スタイルを優先するが、発言バランスも考慮
          const summaryAgent = this.runtime.selectBalancedAgent(agents, 'logical', true);
          const summary = await this.askForSummary(summaryAgent, messages, language, action.dynamicInstruction);
          newMessages.push(summary);
          agentResponses.push(`${summaryAgent.getAgent().name}: ${summary.content.slice(0, 100)}...`);
          this.runtime.trackAgentParticipation(summaryAgent.getAgent().id);
          success = true;
          break;

        case 'redirect':
          // 発言バランスを考慮してエージェントを選んで元のトピックに戻す
          const redirectAgent = this.runtime.selectBalancedAgent(agents, undefined, true);
          const redirect = await this.askForRedirect(redirectAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(redirect);
          agentResponses.push(`${redirectAgent.getAgent().name}: ${redirect.content.slice(0, 100)}...`);
          this.runtime.trackAgentParticipation(redirectAgent.getAgent().id);
          success = true;
          break;

        default:
          errorMessage = `Unknown action type: ${action.type}`;
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[DynamicRouter] Error executing action ${action.type}:`, error);
    }

    // Log the intervention
    this.runtime.getFacilitator().logIntervention(action, success, errorMessage, agentResponses);

    return newMessages;
  }

  private async askForDeepDive(
    agent: DialogueAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    const originalQuery = this.runtime.getOriginalQuery();
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.runtime.buildFullContext(recentMessages, agent.getAgent().id);
    const contextNote = this.runtime.getCurrentRound() <= 2
      ? "including all agents' initial thoughts and recent discussion"
      : "from recent discussion";

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

あなた固有の${agent.getAgent().style}スタイルでこのメタ指示を適用してください。
会話は自然に、150-200語で。問いや比喩で締めくくってください。
`;
    } else {
      instructionSection = `
FACILITATOR REQUEST: ${reason}

Based on the above context, please contribute your unique perspective to "${originalQuery}".

IMPORTANT GUIDELINES:
- Build directly on or respond to specific points made by other agents in the discussion
- Avoid generic openings like "皆さま" or "これまでの議論で"
- Reference specific ideas or arguments from the context when relevant
- Bring your unique ${agent.getAgent().style} perspective to advance the discussion
- Keep it conversational and engaging (150-200 words)
- End with a thought-provoking question or meaningful metaphor
`;
    }

    const prompt = `
CURRENT DISCUSSION: "${originalQuery}"

CONTEXT (${contextNote}):
${contextText}

${instructionSection}

Start your response naturally without formal greetings.
`;

    const response = await agent.executeWithPersonality(
      prompt,
      'deep-dive' as DialogueStage,
      'deep dive exploration',
      language,
      'dynamic-session'
    );

    return {
      id: this.runtime.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'deep-dive' as any,
      metadata: {
        facilitatorAction: 'deep_dive',
        reasoning: reason,
        hasDynamicInstruction: !!dynamicInstruction,
        wordCountTarget: '150-200 words',
        endingGuidance: 'End with question or metaphor'
      }
    };
  }

  private async askForClarification(
    agent: DialogueAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    const originalQuery = this.runtime.getOriginalQuery();
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.runtime.buildFullContext(recentMessages, agent.getAgent().id);

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

あなた固有の${agent.getAgent().style}スタイルでこのメタ指示を適用してください。
会話は自然に、150-200語で。問いで締めくくってください。
`;
    } else {
      instructionSection = `
CLARIFICATION NEEDED: ${reason}

Based on the context above, please provide clarification to help advance our understanding of "${originalQuery}".

GUIDELINES:
- Address specific unclear points from the discussion
- Avoid starting with "皆さま" - respond naturally to the conversation
- Use concrete examples or analogies to clarify complex concepts
- Connect your clarification back to the main question
- Keep response focused and engaging (150-200 words)
- End with a question that deepens the inquiry
`;
    }

    const prompt = `
CURRENT DISCUSSION: "${originalQuery}"

CONTEXT:
${contextText}

${instructionSection}

Respond directly to help clarify the discussion.
`;

    const response = await agent.executeWithPersonality(
      prompt,
      'clarification' as DialogueStage,
      'clarification request',
      language,
      'dynamic-session'
    );

    return {
      id: this.runtime.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'clarification' as any,
      metadata: {
        reasoning: `Facilitator clarification: ${reason}`,
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }

  private async askForPerspectiveShift(
    agent: DialogueAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    const originalQuery = this.runtime.getOriginalQuery();
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.runtime.buildFullContext(recentMessages, agent.getAgent().id);

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

あなた固有の${agent.getAgent().style}スタイルで、既存の前提に挑戦するか、
まだ探求されていない視点を導入してください。
`;
    } else {
      instructionSection = `
The facilitator suggests introducing a different perspective to enrich the discussion about this topic.

Reason: ${reason}

Based on the context above, please consider "${originalQuery}" from an alternative angle, challenge existing assumptions about this topic, or introduce a viewpoint that hasn't been fully explored yet.
`;
    }

    const prompt = `
We are discussing: "${originalQuery}"

CONTEXT:
${contextText}

${instructionSection}
`;

    const response = await agent.executeWithPersonality(
      prompt,
      'perspective-shift' as DialogueStage,
      'perspective shift',
      language,
      'dynamic-session'
    );

    return {
      id: this.runtime.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'perspective-shift' as any,
      metadata: {
        reasoning: `Facilitator perspective shift: ${reason}`,
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }

  private async askForSummary(
    agent: DialogueAgent,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    const originalQuery = this.runtime.getOriginalQuery();
    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

要約しつつも、このメタ指示に沿って未解決の緊張や開かれた問いを強調してください。
`;
    } else {
      instructionSection = `
Please provide a summary of our discussion about this topic, highlighting:
1. Key insights about "${originalQuery}" that have been established
2. Areas of agreement among participants regarding this topic
3. Remaining questions or disagreements about "${originalQuery}"
4. The overall direction of our exploration of this topic

Keep the summary focused on "${originalQuery}" and be both concise and comprehensive.
`;
    }

    const prompt = `
We are discussing: "${originalQuery}"

${instructionSection}
`;

    const response = await agent.executeWithPersonality(
      prompt,
      'summary' as DialogueStage,
      'discussion summary',
      language,
      'dynamic-session'
    );

    return {
      id: this.runtime.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'summary' as any,
      metadata: {
        reasoning: 'Facilitator-requested summary',
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }

  private async askForRedirect(
    agent: DialogueAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    const originalQuery = this.runtime.getOriginalQuery();
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.runtime.buildFullContext(recentMessages, agent.getAgent().id);

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

議論を元の問いに戻しつつ、このメタ指示に沿った新しい角度を提供してください。
150-200語で、焦点を絞った問いで締めくくってください。
`;
    } else {
      instructionSection = `
REDIRECTION NEEDED: ${reason}

Looking at the context above, please help refocus on "${originalQuery}" by providing a specific new angle or insight.

GUIDELINES:
- Don't start with generic acknowledgments like "皆さま" or "これまでの議論で"
- Reference specific points from the conversation
- Identify what specific aspect of the drift needs addressing
- Bring a fresh perspective that connects back to the core question
- Be direct and engaging (150-200 words)
- End with a focused question that brings us back on track
`;
    }

    const prompt = `
ORIGINAL DISCUSSION: "${originalQuery}"

CONTEXT:
${contextText}

${instructionSection}

Jump directly into your perspective on the original question.
`;

    const response = await agent.executeWithPersonality(
      prompt,
      'redirect' as DialogueStage,
      'topic redirection',
      language,
      'dynamic-session'
    );

    return {
      id: this.runtime.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'redirect' as any,
      metadata: {
        reasoning: `Facilitator redirect: ${reason}`,
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }
}
