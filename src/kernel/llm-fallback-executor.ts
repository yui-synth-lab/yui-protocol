// 実装(ai-executor-impl)がロードできない開発環境向けのフォールバック。
// v1 投票プロンプトの知識を含むため抽象層から隔離している。
import { AIExecutor, AIExecutionResult } from './ai-executor.js';

export class FallbackMockExecutor extends AIExecutor {
  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    let content: string;
    // output-generationステージの場合は必ずAgent Voteを含める
    if (prompt.includes('STAGE 5 - OUTPUT GENERATION')) {
      // エージェントID候補を抽出（自分以外）
      const agentIdPattern = /Agent\s+ID\s*[:：]\s*([a-zA-Z0-9\-_]+)/g;
      const allIds = Array.from(prompt.matchAll(agentIdPattern)).map(m => m[1]);
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

      content = `[${this.agentId}] Mock response: This is a simulated response to your query is "${prompt.substring(0, 100)}...".\n\n${randomVoteFormat}\n理由: このエージェントが最も適切だと思います。`;
    } else {
      content = `[${this.agentId}] Mock response: This is a simulated response to your query is "${prompt.substring(0, 100)}...". Please configure your AI implementation.`;
    }
    const duration = Date.now() - startTime;
    return {
      content,
      model: this.model,
      duration,
      success: true
    };
  }
}
