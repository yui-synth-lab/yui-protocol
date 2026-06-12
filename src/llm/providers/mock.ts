import { AIExecutor, AIExecutionResult } from '../../kernel/ai-executor.js';

// Mock/Simulation Implementation for testing
export class MockExecutor extends AIExecutor {
  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    // system message非対応APIなので、personalityがあればpromptの先頭に付与
    const effectivePrompt = personality ? `${personality}\n\n${prompt}` : prompt;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const duration = Date.now() - startTime;

    // ステージサマリー用の特別な処理
    if (effectivePrompt.includes('CRITICAL OUTPUT FORMAT REQUIREMENT') || effectivePrompt.includes('You are one of the intelligent agents of the Yui Protocol')) {
      // エージェント名を抽出
      const agentNamesMatch = effectivePrompt.match(/Participating Agents: ([^\n]+)/);
      if (agentNamesMatch) {
        const agentNames = agentNamesMatch[1].split(',').map(name => name.trim());
        const mockSummaries = agentNames.map(name =>
          `- ${name}: ${name}が議論に参加し、独自の視点を提供しました。`
        ).join('\n');

        return {
          content: mockSummaries,
          model: this.model,
          duration,
          success: true
        };
      }
    }

    // output-generationステージの場合は必ずAgent Voteを含める
    if (effectivePrompt.includes('STAGE 5 - OUTPUT GENERATION')) {
      // エージェントID候補を抽出（自分以外）
      const agentIdPattern = /Agent\s+ID\s*[:：]\s*([a-zA-Z0-9\-_]+)/g;
      const allIds = Array.from(effectivePrompt.matchAll(agentIdPattern)).map(m => m[1]);
      const candidates = allIds.filter(id => id !== this.agentId);
      const voteFor = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : 'yui-000';

      // 複数の投票表記形式で出力（表記ゆれに対応）
      const voteFormats = [
        `Agent Vote: ${voteFor}`,
        `投票: ${voteFor}`,
        `推薦: ${voteFor}`,
        `選択: ${voteFor}`,
        `まとめ役: ${voteFor}`,
        `**${voteFor}**`,
        `\`${voteFor}\``
      ];
      const randomVoteFormat = voteFormats[Math.floor(Math.random() * voteFormats.length)];

      const content = `[${this.agentId}] Mock response: This is a simulated response to your query is "${effectivePrompt.substring(0, 100)}...".\n\n${randomVoteFormat}\n理由: このエージェントが最も適切だと思います。`;

      return {
        content,
        model: this.model,
        duration,
        success: true
      };
    }

    return {
      content: `[${this.agentId}] Mock response: This is a simulated response to your query about "${effectivePrompt.substring(0, 50)}...". In a real implementation, this would be processed by ${this.provider} using model ${this.model}.`,
      model: this.model,
      duration,
      success: true
    };
  }
}
