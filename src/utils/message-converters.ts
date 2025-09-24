import { Message, SessionConsensusSnapshot, Agent } from '../types/index.js';
import { FacilitatorLog } from '../types/consensus.js';

export function createFacilitatorMessage(
  facilitatorLog: FacilitatorLog,
  sessionId: string,
  language: 'ja' | 'en' = 'ja'
): Message {
  const { decision, roundNumber, timestamp } = facilitatorLog;

  let content: string;
  if (language === 'en') {
    content = `## 🧭 Facilitator Analysis (Round ${roundNumber})\n\n`;
    content += `**Current Situation Analysis:**\n`;
    content += `- Overall Consensus: ${decision.dataAnalyzed.overallConsensus.toFixed(1)}/10\n`;
    content += `- Continue Discussion: ${decision.dataAnalyzed.shouldContinue ? 'Recommended' : 'Convergence Recommended'}\n\n`;

    if (decision.dataAnalyzed.topicDrift) {
      content += `⚠️ **Topic Drift Detected**\n\n`;
    }

    content += `**Agent Satisfaction Levels:**\n`;
    Object.entries(decision.dataAnalyzed.consensusLevels).forEach(([agentId, level]) => {
      const bar = '█'.repeat(Math.floor(level)) + '░'.repeat(10 - Math.floor(level));
      content += `• ${agentId}: ${bar} ${level.toFixed(1)}/10\n`;
    });

    content += `\n**Recommended Action:** ${decision.reasoning}\n`;

    if (decision.selectedAction) {
      content += `\n**Action Taken:** ${decision.selectedAction.type}\n`;
      content += `**Target:** ${decision.selectedAction.target || 'All'}\n`;
      content += `**Reason:** ${decision.selectedAction.reason}`;
    }
  } else {
    content = `## 🧭 ファシリテーター分析 (Round ${roundNumber})\n\n`;
    content += `**現在の状況分析:**\n`;
    content += `- 全体コンセンサス: ${decision.dataAnalyzed.overallConsensus.toFixed(1)}/10\n`;
    content += `- 議論継続判断: ${decision.dataAnalyzed.shouldContinue ? '継続推奨' : '収束推奨'}\n\n`;

    if (decision.dataAnalyzed.topicDrift) {
      content += `⚠️ **トピックの逸脱を検出**\n\n`;
    }

    content += `**エージェント別満足度:**\n`;
    Object.entries(decision.dataAnalyzed.consensusLevels).forEach(([agentId, level]) => {
      const bar = '█'.repeat(Math.floor(level)) + '░'.repeat(10 - Math.floor(level));
      content += `• ${agentId}: ${bar} ${level.toFixed(1)}/10\n`;
    });

    content += `\n**推奨アクション:** ${decision.reasoning}\n`;

    if (decision.selectedAction) {
      content += `\n**実行アクション:** ${decision.selectedAction.type}\n`;
      content += `**対象:** ${decision.selectedAction.target || 'すべて'}\n`;
      content += `**理由:** ${decision.selectedAction.reason}`;
    }
  }

  return {
    id: `facilitator-${sessionId}-${roundNumber}-${timestamp.getTime()}`,
    agentId: 'facilitator',
    content,
    timestamp,
    role: 'facilitator',
    metadata: {
      roundNumber,
      facilitatorAction: decision.selectedAction?.type,
      facilitatorReasoning: decision.reasoning,
      consensusLevel: decision.dataAnalyzed.overallConsensus
    }
  };
}

export function createConsensusMessage(
  consensusSnapshot: SessionConsensusSnapshot,
  sessionId: string,
  agents: Agent[],
  language: 'ja' | 'en' = 'ja'
): Message {
  const { round, timestamp, overallConsensus, agentConsensus } = consensusSnapshot;

  let content: string;
  if (language === 'en') {
    content = `## 📊 Consensus Status (Round ${round})\n\n`;

    // Overall consensus progress bar
    const overallBar = '█'.repeat(Math.floor(overallConsensus)) + '░'.repeat(10 - Math.floor(overallConsensus));
    content += `**Overall Consensus:** \`${overallBar}\` ${overallConsensus.toFixed(1)}/10\n\n`;

    // Agent-specific details
    content += `**Agent Satisfaction Levels:**\n\n`;
    agentConsensus.forEach(agent => {
      const agentInfo = agents.find(a => a.id === agent.agentId);
      const styleLabel = agentInfo ? `(${agentInfo.style})` : '';
      const bar = '█'.repeat(Math.floor(agent.satisfaction)) + '░'.repeat(10 - Math.floor(agent.satisfaction));

      content += `• **${agent.agentName}** ${styleLabel}: \`${bar}\` ${agent.satisfaction.toFixed(1)}/10\n\n`;
      if (agent.reasoning) {
        content += `  └ ${agent.reasoning}\n\n`;
      }
      if (agent.questions.length > 0) {
        content += `  └ Questions: ${agent.questions.join(', ')}\n\n`;
      }
    });

    // Discussion progress judgment
    const readyToMoveCount = agentConsensus.filter(a => a.readyToMove).length;
    const totalAgents = agentConsensus.length;

    content += `\n**Discussion Progress:**\n`;
    content += `- Ready to proceed: ${readyToMoveCount}/${totalAgents} agents\n`;
    content += `- Additional discussion requested: ${agentConsensus.filter(a => a.additionalPoints).length} agents\n`;

    if (overallConsensus >= 8.0) {
      content += `\n✅ **High Consensus Achieved** - Ready for convergence`;
    } else if (overallConsensus >= 6.0) {
      content += `\n⚖️ **Moderate Consensus** - May need more discussion`;
    } else {
      content += `\n🔄 **Consensus Building** - Continued discussion recommended`;
    }
  } else {
    content = `## 📊 コンセンサス状況 (Round ${round})\n\n`;

    // 全体合意度のプログレスバー
    const overallBar = '█'.repeat(Math.floor(overallConsensus)) + '░'.repeat(10 - Math.floor(overallConsensus));
    content += `**全体合意度:** \`${overallBar}\` ${overallConsensus.toFixed(1)}/10\n\n`;

    // エージェント別詳細
    content += `**エージェント別満足度:**\n\n`;
    agentConsensus.forEach(agent => {
      const agentInfo = agents.find(a => a.id === agent.agentId);
      const styleLabel = agentInfo ? `(${agentInfo.style})` : '';
      const bar = '█'.repeat(Math.floor(agent.satisfaction)) + '░'.repeat(10 - Math.floor(agent.satisfaction));

      content += `• **${agent.agentName}** ${styleLabel}: \`${bar}\` ${agent.satisfaction.toFixed(1)}/10\n\n`;
      if (agent.reasoning) {
        content += `  └ ${agent.reasoning}\n\n`;
      }
      if (agent.questions.length > 0) {
        content += `  └ 質問: ${agent.questions.join(', ')}\n\n`;
      }
    });

    // 議論継続の判断
    const readyToMoveCount = agentConsensus.filter(a => a.readyToMove).length;
    const totalAgents = agentConsensus.length;

    content += `\n**議論の進行状況:**\n`;
    content += `- 次へ進む準備完了: ${readyToMoveCount}/${totalAgents} エージェント\n`;
    content += `- 追加議論希望: ${agentConsensus.filter(a => a.additionalPoints).length} エージェント\n`;

    if (overallConsensus >= 8.0) {
      content += `\n✅ **高い合意達成** - 収束可能な状況です`;
    } else if (overallConsensus >= 6.0) {
      content += `\n⚖️ **中程度の合意** - もう少し議論が必要かもしれません`;
    } else {
      content += `\n🔄 **合意形成中** - 継続的な議論が推奨されます`;
    }
  }

  return {
    id: `consensus-${sessionId}-${round}-${timestamp.getTime()}`,
    agentId: 'consensus',
    content,
    timestamp,
    role: 'consensus',
    metadata: {
      roundNumber: round,
      consensusLevel: overallConsensus,
      participationBalance: agentConsensus.reduce((acc, agent) => {
        acc[agent.agentId] = agent.satisfaction;
        return acc;
      }, {} as Record<string, number>)
    }
  };
}

// エージェント名で置換する関数
export function replaceAgentIdsInMessage(content: string, agents: Agent[]): string {
  let replaced = content;
  agents.forEach(agent => {
    const regex = new RegExp(agent.id, 'g');
    replaced = replaced.replace(regex, agent.name);
  });
  return replaced;
}