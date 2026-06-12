// v2.0 コンセンサス収集（dynamic-router から抽出: Phase 3 残課題）。
// 早期終了最適化・応答パースのロジックは抽出前と同一。
// 実際のエージェント呼び出しは ConsensusAsker コールバックで注入される
// （ルーター上の askForConsensus をテストがスタブできるようにするため）。
import { createLogger } from '../../utils/logger.js';
import type { ConsensusIndicator } from '../../types/consensus.js';
import type { DialogueAgent } from '../../dialogue/contracts.js';
import type { Language, Message } from '../../types/index.js';
import { getRoundGuidanceText, v2PromptTemplates } from '../../templates/v2-prompts.js';

export type ConsensusAsker = (
  agent: DialogueAgent,
  messages: Message[],
  language: Language,
  currentRound: number
) => Promise<ConsensusIndicator>;

const log = createLogger('DynamicRouter');

export class ConsensusCollector {
  private activeChecks = new Set<string>(); // 重複実行防止

  /**
   * 全エージェントからコンセンサスを収集する。
   * 継続票が過半数に達した時点で早期終了し、残りは実測平均からの推定値で埋める。
   */
  async gather(
    agents: DialogueAgent[],
    messages: Message[],
    language: Language,
    currentRound: number,
    ask: ConsensusAsker,
    onLlmCall?: () => void
  ): Promise<ConsensusIndicator[]> {
    const consensusData: ConsensusIndicator[] = [];

    // エージェントの順番をランダムにシャッフル
    const shuffledAgents = [...agents].sort(() => Math.random() - 0.5);
    const totalAgents = shuffledAgents.length;
    const majorityThreshold = Math.ceil(totalAgents / 2); // 過半数

    log.info(`Starting optimized consensus gathering - checking up to ${totalAgents} agents, early exit at ${majorityThreshold} continuing votes`);

    let continuingVotes = 0;
    let checkedAgents = 0;

    for (const agent of shuffledAgents) {
      const agentKey = `${agent.getAgent().id}-consensus`;

      // 重複実行チェック
      if (this.activeChecks.has(agentKey)) {
        log.warn(`Skipping duplicate consensus check for ${agent.getAgent().name}`);
        continue;
      }

      this.activeChecks.add(agentKey);

      try {
        const consensus = await ask(agent, messages, language, currentRound);
        onLlmCall?.();
        consensusData.push(consensus);
        checkedAgents++;

        // 継続したいエージェントをカウント (readyToMove が false または hasAdditionalPoints が true)
        if (!consensus.readyToMove || consensus.hasAdditionalPoints) {
          continuingVotes++;
          log.info(`${agent.getAgent().name} wants to continue (ready:${consensus.readyToMove}, critical:${consensus.hasAdditionalPoints}) (${continuingVotes}/${checkedAgents})`);
        } else {
          log.info(`${agent.getAgent().name} ready to conclude (ready:${consensus.readyToMove}, critical:${consensus.hasAdditionalPoints}) (${continuingVotes}/${checkedAgents})`);
        }

        // 早期終了条件: 継続票が過半数を超えた時点で次ラウンドへ
        if (continuingVotes >= majorityThreshold) {
          log.info(`Early exit: ${continuingVotes}/${checkedAgents} agents want to continue (majority reached)`);

          // 既に回答したエージェントの平均満足度を計算
          const actualResponses = consensusData.filter(c => !c.reasoning?.includes('Error occurred'));
          const avgSatisfaction = actualResponses.length > 0
            ? actualResponses.reduce((sum, c) => sum + c.satisfactionLevel, 0) / actualResponses.length
            : 6; // フォールバック値

          const avgHasAdditionalPoints = actualResponses.length > 0
            ? actualResponses.filter(c => c.hasAdditionalPoints).length / actualResponses.length
            : 0.5;

          log.info(`Early exit estimation: avgSatisfaction=${avgSatisfaction.toFixed(1)}, avgHasAdditionalPoints=${(avgHasAdditionalPoints * 100).toFixed(0)}%`);

          // 残りのエージェントには推定値を追加（既存の平均値に基づく）
          for (let i = checkedAgents; i < totalAgents; i++) {
            const remainingAgent = shuffledAgents[i];
            consensusData.push({
              agentId: remainingAgent.getAgent().id,
              satisfactionLevel: Math.round(avgSatisfaction * 10) / 10, // 既存の平均値を使用
              hasAdditionalPoints: avgHasAdditionalPoints > 0.5, // 過半数が追加ポイントありなら true
              questionsForOthers: [],
              readyToMove: false, // 継続を仮定（過半数が継続票のため）
              reasoning: `Early exit - estimated based on ${actualResponses.length} actual responses (avg satisfaction: ${avgSatisfaction.toFixed(1)})`
            });
          }
          break;
        }

      } catch (error) {
        log.error(`Error gathering consensus from ${agent.getAgent().name}:`, error);
        // フォールバック値
        consensusData.push({
          agentId: agent.getAgent().id,
          satisfactionLevel: 5,
          hasAdditionalPoints: false,
          questionsForOthers: [],
          readyToMove: true,
          reasoning: 'Error occurred during consensus gathering'
        });
        checkedAgents++;
      } finally {
        this.activeChecks.delete(agentKey);
      }
    }

    log.info(`Consensus gathering completed: checked ${checkedAgents}/${totalAgents} agents, ${continuingVotes} want to continue`);
    return consensusData;
  }

  /** コンセンサス確認プロンプトを構築する */
  buildConsensusPrompt(originalQuery: string, messages: Message[], language: Language, currentRound: number): string {
    const recentMessages = messages.slice(-5);
    const contextText = recentMessages.map(m => `${m.agentId}: ${m.content}`).join('\n\n');

    // Detect if topic is philosophical based on query content
    const philosophicalKeywords = ['時間', 'time', '存在', 'existence', '意識', 'consciousness', '本質', 'essence', '哲学', 'philosophy', '真理', 'truth', '永遠', 'eternity'];
    const isPhilosophical = philosophicalKeywords.some(keyword =>
      originalQuery.toLowerCase().includes(keyword.toLowerCase())
    );

    const roundGuidance = getRoundGuidanceText(currentRound, isPhilosophical);
    const additionalGuidance = currentRound <= 2 ?
      'NOTE: In early rounds, consider whether the discussion could benefit from more exploration and different perspectives before concluding.' :
      'Consider: A satisfaction level of 6+ with meaningful insights often indicates readiness for conclusion.';

    const promptTemplate = v2PromptTemplates.dynamic_consensus[language];
    return promptTemplate
      .replace('{originalQuery}', originalQuery)
      .replace('{currentRound}', currentRound.toString())
      .replace('{roundGuidance}', roundGuidance)
      .replace('{contextText}', contextText)
      .replace('{additionalGuidance}', additionalGuidance);
  }

  /** コンセンサス応答（JSON またはテキスト形式）を ConsensusIndicator に解析する */
  parseConsensusResponse(response: string, agentId: string): ConsensusIndicator {
    // デフォルト値
    let satisfactionLevel = 5;
    let hasAdditionalPoints = false;
    let questionsForOthers: string[] = [];
    let readyToMove = false; // デフォルトをfalseに変更（慎重な判断）
    let reasoning = '';

    try {
      // 1. Try JSON parsing first
      const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]|\{\s*"[\s\S]*"\s*:\s*[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const json = JSON.parse(jsonMatch[0]);
          // Map JSON fields to ConsensusIndicator fields
          if (json.satisfaction) satisfactionLevel = Math.min(10, Math.max(1, parseInt(json.satisfaction)));

          // Map boolean fields
          if (json.readyToConclude !== undefined) readyToMove = json.readyToConclude;
          else if (json.readyToMove !== undefined) readyToMove = json.readyToMove; // Fallback

          if (json.additionalPoints !== undefined) hasAdditionalPoints = json.additionalPoints;
          else if (json.anotherRoundValuable !== undefined) hasAdditionalPoints = json.anotherRoundValuable;
          else if (json.hasAdditionalPoints !== undefined) hasAdditionalPoints = json.hasAdditionalPoints;

          if (json.questions && Array.isArray(json.questions)) questionsForOthers = json.questions;

          if (json.reasoning) reasoning = json.reasoning;

          // If successful, return immediately
          return {
            agentId,
            satisfactionLevel,
            hasAdditionalPoints,
            questionsForOthers,
            readyToMove,
            reasoning
          };
        } catch (e) {
          log.warn(`JSON parsing failed for ${agentId}, falling back to text parsing`, e);
        }
      }

      // 2. Fallback to Text Parsing
      const lines = response.split('\n');
      let capturingReasoning = false;
      const reasoningLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (trimmed.startsWith('Satisfaction:')) {
          const match = trimmed.match(/(\d+)/);
          if (match) satisfactionLevel = Math.min(10, Math.max(1, parseInt(match[1])));
          capturingReasoning = false;
        } else if (trimmed.startsWith('Meaningful insights:')) {
          // 新しいフォーマットでは meaningful insights を評価
          // 意味ある洞察は満足度の指標であり、追加議論の必要性とは別
          // hasAdditionalPointsは別途Critical pointsで判定する
          capturingReasoning = false;
        } else if (trimmed.startsWith('Ready to conclude:')) {
          readyToMove = trimmed.toLowerCase().includes('yes');
          capturingReasoning = false;
        } else if (trimmed.startsWith('Critical points remaining:')) {
          // 重要な未討論ポイントがある場合、継続が必要
          const hasCriticalPoints = trimmed.toLowerCase().includes('yes');
          if (hasCriticalPoints) {
            readyToMove = false; // 重要ポイントがあれば継続
            hasAdditionalPoints = true;
          }
          capturingReasoning = false;
        } else if (trimmed.startsWith('Reasoning:')) {
          // Reasoning の開始
          const firstLine = trimmed.replace('Reasoning:', '').trim();
          if (firstLine) {
            reasoningLines.push(firstLine);
          }
          capturingReasoning = true;
        } else if (capturingReasoning && trimmed) {
          // Reasoning の続き（空行でない場合）
          // 次のフィールドの開始をチェック
          const isNextField = trimmed.match(/^(Satisfaction|Meaningful insights|Ready to conclude|Critical points remaining|New insights|Another round):/i);
          if (isNextField) {
            capturingReasoning = false;
            // このラインは次のイテレーションで処理される
            i--; // ループカウンタを戻す
          } else {
            reasoningLines.push(trimmed);
          }
        }
      }

      // Reasoning を結合
      const textReasoning = reasoningLines.join(' ').trim();
      if (textReasoning) {
        reasoning = textReasoning;
      }

      // 満足度ベースの自動判定ロジック強化
      if (satisfactionLevel >= 7 && hasAdditionalPoints && !readyToMove) {
        // 高満足度でも継続希望の場合、満足度を基準に判断を調整
        log.info(`${agentId}: High satisfaction (${satisfactionLevel}) detected, considering readiness adjustment`);
      }

    } catch (error) {
      log.warn(`Error parsing consensus response from ${agentId}:`, error);
    }

    return {
      agentId,
      satisfactionLevel,
      hasAdditionalPoints,
      questionsForOthers,
      readyToMove,
      reasoning
    };
  }
}
