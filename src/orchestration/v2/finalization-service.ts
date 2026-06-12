// v2.0 ファイナライズ（投票によるファイナライザ選出・単独/協調 finalize）。
// dynamic-router から抽出（Phase 3 残課題）。ロジックは抽出前と同一だが、
// config/v2-settings.json の finalization セクション（従来未配線）をここで接続する。
import { createLogger } from '../../utils/logger.js';
import { createVotingStartMessage, createVotingResultMessage } from '../../utils/convergence-messages.js';
import {
  createCollaborationIntroMessage,
  createCollaborationProgressMessage,
  createCollaborationSummaryMessage
} from '../../utils/collaboration-messages.js';
import { getV2FinalizationConfig } from '../../config/v2-config-loader.js';
import type { DialogueAgent, FacilitatorPort } from '../../dialogue/contracts.js';
import type { Agent, Language, Message } from '../../types/index.js';

export interface VoteResult {
  agentId: string;
  voteFor: string | undefined;
  voteReasoning?: string;
}

/** 実際の投票呼び出しはルーター経由で注入される（テストがルーター上でスタブできるようにするため） */
export type VoteAsker = (
  agent: DialogueAgent,
  messages: Message[],
  language: Language,
  allAgents: DialogueAgent[]
) => Promise<VoteResult>;

/** ルーターが提供する実行時依存 */
export interface FinalizationRuntime {
  getOriginalQuery(): string;
  getFacilitator(): FacilitatorPort;
  emitEvent(event: string, data: unknown): void;
  generateMessageId(): string;
  countLlmCall(): void;
}

const log = createLogger('DynamicRouter');

export class FinalizationService {
  constructor(private runtime: FinalizationRuntime) {}

  /** 最終統合を生成する。協調ファイナライズの場合は messages へ直接 push し null を返す */
  async generateFinalOutput(
    messages: Message[],
    agents: DialogueAgent[],
    language: Language,
    sessionId: string,
    round: number,
    askVote: VoteAsker
  ): Promise<Message | null> {
    const originalQuery = this.runtime.getOriginalQuery();
    const finalizationConfig = getV2FinalizationConfig();
    try {
      // v1の投票システムを踏襲してFinalize担当を決定
      let finalizers = await this.selectFinalizerByVoting(messages, agents, language, sessionId, round, askVote);

      // finalization config の適用（従来 json に存在したが未配線だった設定）
      if (finalizationConfig.enableCollaborativeFinalization === false && finalizers.length > 1) {
        log.info('Collaborative finalization disabled by config — using primary finalizer only');
        finalizers = [finalizers[0]];
      }
      const maxFinalizers = finalizationConfig.maxCollaborativeFinalizers ?? 3;
      if (finalizers.length > maxFinalizers) {
        log.info(`Capping finalizers to maxCollaborativeFinalizers=${maxFinalizers}`);
        finalizers = finalizers.slice(0, maxFinalizers);
      }

      const recentMessages = messages.slice(-10);
      const contextText = recentMessages.map(m => `${m.agentId}: ${m.content}`).join('\n\n');

      const prompt = `
We have been exploring: "${originalQuery}"

As the selected finalizer, you have been chosen through democratic voting to provide the concluding synthesis of our rich dialogue. This is a significant responsibility - please provide a comprehensive and thoughtful conclusion that:

1. **Deep Synthesis**: Weave together the key insights about "${originalQuery}" that emerged throughout our entire conversation, not just recent exchanges
2. **Multi-Perspective Integration**: Acknowledge and integrate the diverse viewpoints, approaches, and wisdom that different participants brought to this exploration
3. **Nuanced Understanding**: Capture both areas where we found convergence and the beautiful complexities or tensions that remain unresolved about this topic
4. **Philosophical Depth**: Reflect on what this exploration revealed not just about "${originalQuery}" but about the nature of inquiry, understanding, and collaborative thinking itself
5. **Future Directions**: Suggest what new questions or avenues of exploration this dialogue has opened up
6. **Essence Distillation**: Articulate the core essence of what was discovered about "${originalQuery}" through this collective thinking process
7. **Inquiry Spirit**: Honor the spirit of genuine inquiry rather than forcing premature closure or oversimplified answers

RECENT DISCUSSION CONTEXT (for reference):
${contextText}

Please take your time to craft a substantial, nuanced, and insightful final reflection on our exploration of "${originalQuery}". This synthesis should be worthy of the depth of thinking that preceded it and serve as a meaningful conclusion to our collaborative inquiry.

Remember: You are not just summarizing - you are synthesizing, integrating, and elevating the collective wisdom that emerged from our dialogue into a coherent and profound final statement.
`;

      // 複数のファイナライザーが選出された場合
      if (finalizers.length > 1) {
        log.info(`Multiple finalizers selected: ${finalizers.map(f => f.getAgent().name).join(', ')}`);

        return await this.handleMultipleFinalizers(finalizers, messages, contextText, language, sessionId, round);

      } else {
        // 単一のファイナライザーの場合（従来通り）
        const finalizer = finalizers[0];

        const response = await finalizer.executeWithPersonality(
          prompt,
          'finalize',
          'final synthesis',
          language,
          'dynamic-session'
        );
        this.runtime.countLlmCall();

        return {
          id: this.runtime.generateMessageId(),
          agentId: finalizer.getAgent().id,
          content: response,
          timestamp: new Date(),
          role: 'agent',
          stage: 'finalize',
          metadata: {
            reasoning: 'Dynamic dialogue final synthesis'
          }
        };
      }
    } catch (error) {
      log.error('Error generating final output:', error);
      return null;
    }
  }

  // 複数ファイナライザーの協力システム
  private async handleMultipleFinalizers(
    finalizers: DialogueAgent[],
    messages: Message[],
    contextText: string,
    language: Language,
    sessionId: string,
    round: number
  ): Promise<null> {
    const originalQuery = this.runtime.getOriginalQuery();
    const finalizationConfig = getV2FinalizationConfig();
    const stepDelay = finalizationConfig.collaborationStepDelay ?? 1500;
    const showProgress = finalizationConfig.showProgressMessages !== false;
    log.info(`Starting collaborative finalization with ${finalizers.length} finalizers`);

    // Step 1: 協力紹介メッセージを作成・送信
    const collaborationInfo = {
      sessionId,
      finalizers: finalizers.map((f, index) => ({
        id: f.getAgent().id,
        name: f.getAgent().name,
        role: index === 0 ? 'foundation' : (index === finalizers.length - 1 ? 'integrator' : 'enricher')
      })),
      totalSteps: finalizers.length,
      topic: originalQuery
    };

    const introMessage = createCollaborationIntroMessage(collaborationInfo, language);
    messages.push(introMessage);

    this.runtime.emitEvent('v2-message', {
      sessionId,
      message: introMessage,
      round,
      collaborationPhase: 'introduction'
    });

    this.runtime.emitEvent('v2-collaboration-start', {
      sessionId,
      type: 'multiple-finalizers',
      finalizers: collaborationInfo.finalizers,
      round
    });

    const collaborationMessages: Message[] = [];

    // Step 2: 各ファイナライザーが順番に発言
    for (const [index, finalizer] of finalizers.entries()) {
      const isFirst = index === 0;
      const isLast = index === finalizers.length - 1;

      // 前のファイナライザーの発言を参考に含める
      const previousAnalyses = collaborationMessages.length > 0
        ? `\n\nPREVIOUS FINALIZER ANALYSES:\n${collaborationMessages.map((msg, i) => `${i + 1}. **${msg.agentId}**: ${msg.content.slice(0, 300)}...`).join('\n\n')}`
        : '';

      const collaborativePrompt = `
We have been exploring: "${originalQuery}"

🎆 **COLLABORATIVE FINALIZATION - ${index + 1}/${finalizers.length}**

You are ${finalizer.getAgent().name}, working with ${finalizers.filter(f => f !== finalizer).map(f => f.getAgent().name).join(' and ')} to create a comprehensive final synthesis.

${isFirst ? `🌱 **YOUR ROLE AS THE FOUNDATION BUILDER**:
- Begin our collaborative synthesis with your ${finalizer.getAgent().style} perspective
- Establish key analytical frameworks and foundational insights
- Set the stage for others to build upon your analysis
- Focus on ${this.getFinalizerFocus(finalizer.getAgent())}` :
        (isLast ? `🎆 **YOUR ROLE AS THE SYNTHESIS INTEGRATOR**:
- Weave together all previous analyses into a unified conclusion
- Build upon insights from ${finalizers.slice(0, -1).map(f => f.getAgent().name).join(' and ')}
- Provide the culminating understanding that honors all perspectives
- Create the definitive conclusion about "${originalQuery}"` :
          `🌿 **YOUR ROLE AS THE PERSPECTIVE ENRICHER**:
- Build meaningfully on what ${finalizers.slice(0, index).map(f => f.getAgent().name).join(' and ')} established
- Add your unique ${finalizer.getAgent().style} insights to deepen understanding
- Bridge different analytical approaches and fill important gaps
- Prepare the foundation for the final integrative analysis`)}

**DISCUSSION CONTEXT:**
${contextText}${previousAnalyses}

**YOUR SPECIFIC CONTRIBUTION:**
${this.getCollaborativeInstructions(isFirst, isLast, index + 1, finalizers.length)}

**Remember**: This is a collaborative effort. Your contribution should clearly build on others while bringing your unique perspective to create something greater than the sum of its parts.
`;

      // 進行状況メッセージを送信（finalization.showProgressMessages で制御）
      const role = isFirst ? 'foundation' : (isLast ? 'integrator' : 'enricher');
      if (showProgress) {
        const progressMessage = createCollaborationProgressMessage(
          finalizer.getAgent().name,
          index + 1,
          finalizers.length,
          role,
          sessionId,
          language
        );

        messages.push(progressMessage);
        this.runtime.emitEvent('v2-message', {
          sessionId,
          message: progressMessage,
          round,
          collaborationPhase: 'progress',
          stepInfo: { current: index + 1, total: finalizers.length, role }
        });
      }

      log.info(`Finalizer ${index + 1}/${finalizers.length} (${finalizer.getAgent().name}) starting...`);

      // ファイナライザー専用の高コストLLMを使用するため、agent idに'-finalizer'を追加
      const finalizerAgentId = `${finalizer.getAgent().id}-finalizer`;
      const response = await finalizer.executeWithFinalizerModel(
        collaborativePrompt,
        finalizerAgentId,
        'finalize',
        `collaborative synthesis ${index + 1}/${finalizers.length}`,
        language,
        'dynamic-session'
      );
      this.runtime.countLlmCall();

      const finalizerMessage: Message = {
        id: this.runtime.generateMessageId(),
        agentId: finalizer.getAgent().id,
        content: response,
        timestamp: new Date(),
        role: 'agent',
        stage: 'finalize',
        metadata: {
          collaborativeFinalize: true,
          finalizerIndex: index + 1,
          totalFinalizers: finalizers.length,
          finalizerRole: isFirst ? 'foundation' : (isLast ? 'integrator' : 'enricher'),
          coFinalizers: finalizers.filter(f => f !== finalizer).map(f => f.getAgent().name),
          reasoning: `Collaborative finalizer ${index + 1}/${finalizers.length}: ${isFirst ? 'Foundation Builder' : (isLast ? 'Synthesis Integrator' : 'Perspective Enricher')}`
        }
      };

      collaborationMessages.push(finalizerMessage);
      messages.push(finalizerMessage);

      // 各ファイナライザーのメッセージをWebSocketで送信
      this.runtime.emitEvent('v2-message', {
        sessionId,
        message: finalizerMessage,
        round,
        collaborationStep: {
          current: index + 1,
          total: finalizers.length,
          role: finalizerMessage.metadata?.finalizerRole,
          agentName: finalizer.getAgent().name
        }
      });

      log.info(`Finalizer ${index + 1}/${finalizers.length} (${finalizer.getAgent().name}) completed`);

      // 間に少し間をあける（最後以外）。間隔は finalization.collaborationStepDelay
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }
    }

    // Step 3: 協力完了メッセージを作成・送信
    const summaryMessage = createCollaborationSummaryMessage(
      finalizers.map(f => f.getAgent().name),
      collaborationMessages.length,
      sessionId,
      originalQuery,
      language
    );

    messages.push(summaryMessage);

    this.runtime.emitEvent('v2-message', {
      sessionId,
      message: summaryMessage,
      round,
      collaborationPhase: 'summary'
    });

    this.runtime.emitEvent('v2-collaboration-complete', {
      sessionId,
      type: 'multiple-finalizers',
      totalMessages: collaborationMessages.length,
      finalizers: finalizers.map(f => f.getAgent().name),
      round
    });

    log.info(`Collaborative finalization completed with ${collaborationMessages.length} contributions`);

    // messages への push は内部で完了済みのため null を返す（呼び出し側の二重 push を防ぐ）
    return null;
  }

  // ファイナライザーのフォーカスエリアを取得（エージェント設定が単一情報源）
  private getFinalizerFocus(agent: Agent): string {
    return agent.finalizerFocus || 'comprehensive analysis';
  }

  // 協力的インストラクションを取得
  private getCollaborativeInstructions(isFirst: boolean, isLast: boolean, position: number, total: number): string {
    if (isFirst) {
      return `As the foundation builder, provide:
1. **Core Framework**: Establish the main analytical structure
2. **Key Insights**: Identify the most important discoveries from our dialogue
3. **Thematic Organization**: Create clear thematic threads for others to develop`;
    } else if (isLast) {
      return `As the synthesis integrator, provide:
1. **Comprehensive Weaving**: Unite all previous analyses into a coherent whole
2. **Elevated Understanding**: Transform individual insights into collective wisdom
3. **Future Vision**: Articulate what this exploration opens up for continued inquiry`;
    } else {
      return `As perspective enricher ${position}/${total}, provide:
1. **Complementary Analysis**: Add dimensions not fully explored by previous finalizers
2. **Connective Insights**: Link different aspects of the previous analyses
3. **Depth Enhancement**: Deepen understanding through your unique analytical lens`;
    }
  }

  // v1の投票システムを踏襲してFinalize担当を選出
  async selectFinalizerByVoting(
    messages: Message[],
    agents: DialogueAgent[],
    language: Language,
    sessionId: string,
    round: number,
    askVote: VoteAsker
  ): Promise<DialogueAgent[]> {
    log.info('Starting voting process for finalizer selection');

    // 投票開始メッセージを追加
    const votingStartMessage = createVotingStartMessage(sessionId, round);
    messages.push(votingStartMessage);

    try {
      // 全エージェントから投票を収集
      const votes: VoteResult[] = [];

      for (const agent of agents) {
        try {
          const vote = await askVote(agent, messages, language, agents);
          if (vote.voteFor) {
            votes.push(vote);
            log.info(`Vote from ${vote.agentId}: ${vote.voteFor} (${vote.voteReasoning})`);
          }
        } catch (error) {
          log.error(`Error getting vote from ${agent.getAgent().id}:`, error);
        }
      }

      // ファシリテーターに投票結果の分析と最終判断を委ねる
      if (votes.length > 0) {
        const selectedAgentIds = await this.runtime.getFacilitator().analyzeFinalizeVotes(votes, agents.map(a => a.getAgent().id));
        const selectedAgents = agents.filter(a => selectedAgentIds.includes(a.getAgent().id));

        if (selectedAgents.length > 0) {
          log.info(`Finalizers selected by facilitator analysis: ${selectedAgentIds.join(', ')}`);

          // 投票結果メッセージを作成（複数選出の場合は最初のエージェントをプライマリとして表示）
          const votingResults = votes.map(vote => ({
            voter: vote.agentId,
            voterName: agents.find(a => a.getAgent().id === vote.agentId)?.getAgent().name || vote.agentId,
            votedFor: vote.voteFor!,
            votedForName: agents.find(a => a.getAgent().id === vote.voteFor)?.getAgent().name || vote.voteFor!,
            reasoning: vote.voteReasoning || 'No reasoning provided'
          }));

          // 複数選出の場合はすべてのファイナライザーを表示用文字列として処理
          const finalizerNames = selectedAgents.map(a => a.getAgent().name).join(' & ');
          const finalizerIds = selectedAgentIds.join(' & ');

          const votingResultMessage = createVotingResultMessage(
            votingResults,
            finalizerIds,
            finalizerNames,
            sessionId,
            round
          );
          messages.push(votingResultMessage);

          return selectedAgents;
        }
      }

      log.info('No votes or voting failed, falling back to style-based selection');
    } catch (error) {
      log.error('Error in voting process:', error);
    }

    // フォールバック: 従来のstyle-based選択
    const fallbackAgent = agents.find(a =>
      a.getAgent().style === 'logical' || a.getAgent().style === 'meta'
    ) || agents[0];
    return [fallbackAgent];
  }

  /** 投票依頼プロンプトを構築する */
  buildVotePrompt(agent: DialogueAgent, messages: Message[], language: Language, allAgents: DialogueAgent[]): string {
    const agentList = allAgents
      .filter(a => a.getAgent().id !== agent.getAgent().id)
      .map(a => a.getAgent().id);
    const recentMessages = messages.slice(-5);
    const contextText = recentMessages.map(m => `${m.agentId}: ${m.content.slice(0, 100)}...`).join('\n\n');

    return language === 'ja'
      ? `議論の総括を担当するエージェントを選んでください。

最近の議論の流れ:
${contextText}

選択肢: ${agentList.join(', ')}

以下の形式で回答してください：
投票: [エージェントID]
理由: [選択理由]

注意: 自分自身には投票できません。最も議論を的確に総括できると思うエージェントに投票してください。`
      : `Please select an agent to provide the final synthesis of our discussion.

Recent discussion flow:
${contextText}

Available agents: ${agentList.join(', ')}

Please respond in this format:
Vote: [agent-id]
Reason: [reason for selection]

Note: You cannot vote for yourself. Vote for the agent you think can best synthesize our discussion.`;
  }

  // 投票レスポンスを解析
  parseVoteResponse(
    response: string,
    voterId: string,
    validAgents: string[],
    allAgents?: DialogueAgent[]
  ): VoteResult {
    let voteFor: string | undefined;
    let voteReasoning: string | undefined;

    // 日本語パターン
    const jaVoteMatch = response.match(/投票:\s*([^\n]+)/);
    const jaReasonMatch = response.match(/理由:\s*([^\n]+)/);

    // 英語パターン
    const enVoteMatch = response.match(/Vote:\s*([^\n]+)/);
    const enReasonMatch = response.match(/Reason:\s*([^\n]+)/);

    const voteText = (jaVoteMatch?.[1] || enVoteMatch?.[1] || '').trim();
    voteReasoning = (jaReasonMatch?.[1] || enReasonMatch?.[1] || '').trim();

    // まず有効なエージェントIDかチェック
    if (voteText && validAgents.includes(voteText)) {
      voteFor = voteText;
    } else if (voteText && allAgents) {
      // IDで見つからない場合、名前で検索
      const agentByName = allAgents.find(a =>
        a.getAgent().name === voteText &&
        validAgents.includes(a.getAgent().id)
      );
      if (agentByName) {
        voteFor = agentByName.getAgent().id;
        log.info(`Vote converted from name "${voteText}" to ID "${voteFor}"`);
      }
    }

    return {
      agentId: voterId,
      voteFor,
      voteReasoning
    };
  }
}
