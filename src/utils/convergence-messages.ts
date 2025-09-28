import { Message, Agent } from '../types/index.js';
import { ConsensusIndicator } from '../types/consensus.js';

// 収束判定理由を説明するメッセージを生成
export function createConvergenceMessage(
  reason: 'natural_consensus' | 'max_rounds' | 'facilitator_decision' | 'high_satisfaction',
  round: number,
  consensusLevel: number,
  agentsReady: number,
  totalAgents: number,
  sessionId: string,
  language: 'ja' | 'en' = 'ja',
  additionalInfo?: string
): Message {
  let title: string;
  let explanation: string;
  let icon: string;
  let content: string;

  if (language === 'en') {
    switch (reason) {
      case 'natural_consensus':
        title = '🎯 Natural Consensus Formation - Dialogue Convergence';
        explanation = `Overall consensus reached ${consensusLevel.toFixed(1)}/10, and ${agentsReady}/${totalAgents} agents are ready for the next step. The dialogue will converge.`;
        icon = '🎯';
        break;

      case 'high_satisfaction':
        title = '✨ High Satisfaction - Dialogue Completion';
        explanation = `High satisfaction (${consensusLevel.toFixed(1)}/10) was achieved in Round ${round}, and the discussion is considered sufficiently deep. The dialogue will be completed.`;
        icon = '✨';
        break;

      case 'max_rounds':
        title = '⏰ Maximum Rounds Reached - Dialogue Termination';
        explanation = `Maximum rounds reached in Round ${round}. Current consensus: ${consensusLevel.toFixed(1)}/10. Ending dialogue for token efficiency and cost management, proceeding to final integration.`;
        icon = '⏰';
        break;

      case 'facilitator_decision':
        title = '🎭 Facilitator Decision - Dialogue Convergence';
        explanation = `In Round ${round}, the facilitator analyzed dialogue maturity and determined that integration and conclusion are more appropriate than continued discussion. Consensus: ${consensusLevel.toFixed(1)}/10`;
        icon = '🎭';
        break;

      default:
        title = '🔄 Dialogue Convergence';
        explanation = `Dialogue convergence conditions were met in Round ${round}.`;
        icon = '🔄';
    }

    content = `## ${title}

**Convergence Reason**: ${explanation}

${additionalInfo ? `**Additional Information**: ${additionalInfo}\n\n` : ''}**Dialogue Results**:
- **Rounds Continued**: ${round} rounds
- **Final Consensus**: ${consensusLevel.toFixed(1)}/10
- **Agents Ready**: ${agentsReady}/${totalAgents}

---

Proceeding to final integration and output generation by selected agents.`;
  } else {
    switch (reason) {
      case 'natural_consensus':
        title = '🎯 自然な合意形成による対話収束';
        explanation = `全体合意度 ${consensusLevel.toFixed(1)}/10 に達し、${agentsReady}/${totalAgents} のエージェントが次のステップへの準備を完了したため、対話を収束させることになりました。`;
        icon = '🎯';
        break;

      case 'high_satisfaction':
        title = '✨ 高い満足度による対話完了';
        explanation = `Round ${round} で高い満足度（${consensusLevel.toFixed(1)}/10）が達成され、議論が十分に深まったと判断されたため、対話を完了します。`;
        icon = '✨';
        break;

      case 'max_rounds':
        title = '⏰ 最大ラウンド数到達による対話終了';
        explanation = `Round ${round} で設定された最大ラウンド数に達しました。現在の合意度は ${consensusLevel.toFixed(1)}/10 です。トークン効率とコスト管理のため、対話を終了し最終統合に移ります。`;
        icon = '⏰';
        break;

      case 'facilitator_decision':
        title = '🎭 ファシリテーター判断による対話収束';
        explanation = `Round ${round} でファシリテーターが対話の成熟度を分析した結果、これ以上の議論継続よりも統合・結論化が適切と判断されました。合意度: ${consensusLevel.toFixed(1)}/10`;
        icon = '🎭';
        break;

      default:
        title = '🔄 対話収束';
        explanation = `Round ${round} で対話の収束条件が満たされました。`;
        icon = '🔄';
    }

    content = `## ${title}

**収束理由**: ${explanation}

${additionalInfo ? `**追加情報**: ${additionalInfo}\n\n` : ''}**対話の成果**:
- **継続ラウンド数**: ${round} ラウンド
- **最終合意度**: ${consensusLevel.toFixed(1)}/10
- **準備完了エージェント**: ${agentsReady}/${totalAgents}

---

これより、選出されたエージェントによる最終統合と出力生成に移ります。`;
  }

  return {
    id: `convergence-${sessionId}-${round}-${Date.now()}`,
    agentId: 'system',
    content,
    timestamp: new Date(),
    role: 'system',
    metadata: {
      convergenceReason: reason,
      round,
      consensusLevel,
      agentsReady,
      totalAgents,
      additionalInfo
    }
  };
}

// 投票開始メッセージを生成
export function createVotingStartMessage(
  sessionId: string,
  round: number,
  language: 'ja' | 'en' = 'ja'
): Message {
  const content = language === 'en' ?
    `## 🗳️ Finalizer Selection Voting Started

The dialogue has reached convergence, so we will select the agent responsible for final integration.

**Voting Process**:
1. Each agent votes for the optimal finalizer based on the discussion content
2. Explain the rationale for selection along with voting reasons
3. Determine the finalizer based on voting results

**Evaluation Criteria**:
- Contribution to discussion
- Integration capability
- Depth of understanding
- Expressiveness

Waiting for each agent's vote...` :
    `## 🗳️ ファイナライザー選出投票開始

対話が収束に達したため、最終統合を担当するエージェントを選出します。

**投票プロセス**:
1. 各エージェントが議論の内容を踏まえて最適なファイナライザーを投票
2. 投票理由と共に選択根拠を説明
3. 投票結果に基づいてファイナライザーを決定

**評価基準**:
- 議論への貢献度
- 統合能力
- 理解の深さ
- 表現力

各エージェントの投票をお待ちください...`;

  return {
    id: `voting-start-${sessionId}-${round}-${Date.now()}`,
    agentId: 'system',
    content,
    timestamp: new Date(),
    role: 'system',
    metadata: {
      votingType: 'finalizer_selection',
      round
    }
  };
}

// 投票結果メッセージを生成
export function createVotingResultMessage(
  votingResults: Array<{
    voter: string;
    voterName: string;
    votedFor: string;
    votedForName: string;
    reasoning: string;
  }>,
  selectedFinalizer: string,
  selectedFinalizerName: string,
  sessionId: string,
  round: number,
  language: 'ja' | 'en' = 'ja'
): Message {
  const votesByCandidate = votingResults
    .filter(v => v.votedFor)
    .reduce((acc, vote) => {
      if (!acc[vote.votedFor]) {
        acc[vote.votedFor] = { votes: 0, name: vote.votedForName, reasons: [] };
      }
      acc[vote.votedFor].votes++;
      acc[vote.votedFor].reasons.push(`**${vote.voterName}**: ${vote.reasoning}`);
      return acc;
    }, {} as Record<string, { votes: number; name: string; reasons: string[] }>);

  const sortedCandidates = Object.entries(votesByCandidate)
    .sort(([,a], [,b]) => b.votes - a.votes);

  let votingResultsText: string;
  let content: string;

  if (language === 'en') {
    votingResultsText = sortedCandidates
      .map(([agentId, data]) => {
        const isWinner = agentId === selectedFinalizer;
        const winnerMark = isWinner ? '🏆 ' : '';
        return `${winnerMark}**${data.name}**: ${data.votes} votes\n\n${data.reasons.map(r => ` └ ${r}`).join('\n\n')}`;
      })
      .join('\n\n');

    content = `## 🏆 Finalizer Selection Results

Voting has been completed. Here are the voting results for each agent:

### 📊 Voting Results

${votingResultsText}

### ✅ Selection Result

**${selectedFinalizerName}** (${selectedFinalizer}) has been selected as the finalizer.

---

The selected finalizer will now integrate all previous discussions and present the final insights and conclusions.`;
  } else {
    votingResultsText = sortedCandidates
      .map(([agentId, data]) => {
        const isWinner = agentId === selectedFinalizer;
        const winnerMark = isWinner ? '🏆 ' : '';
        return `${winnerMark}**${data.name}**: ${data.votes}票\n\n${data.reasons.map(r => ` └ ${r}`).join('\n\n')}`;
      })
      .join('\n\n');

    content = `## 🏆 ファイナライザー選出結果

投票が完了しました。以下が各エージェントの投票結果です：

### 📊 投票結果

${votingResultsText}

### ✅ 選出結果

**${selectedFinalizerName}** (${selectedFinalizer}) がファイナライザーとして選出されました。

---

これより選出されたファイナライザーが、これまでの議論を統合し、最終的な洞察と結論を提示いたします。`;
  }

  return {
    id: `voting-result-${sessionId}-${round}-${Date.now()}`,
    agentId: 'system',
    content,
    timestamp: new Date(),
    role: 'system',
    metadata: {
      votingResults,
      selectedFinalizer,
      selectedFinalizerName,
      round,
      votingType: 'finalizer_selection'
    }
  };
}