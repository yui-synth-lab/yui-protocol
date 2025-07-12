import { describe, it, expect, beforeEach } from 'vitest';
import { createStageSummarizer, VoteAnalysis } from '../src/kernel/stage-summarizer.js';
import { Agent, AgentResponse } from '../src/types/index.js';

describe('Vote Analysis', () => {
  let stageSummarizer: ReturnType<typeof createStageSummarizer>;
  let testAgents: Agent[];
  let testResponses: AgentResponse[];

  beforeEach(() => {
    stageSummarizer = createStageSummarizer({
      model: 'gemini-2.5-flash-lite-preview-06-17',
      provider: 'gemini',
      language: 'ja'
    });

    testAgents = [
      {
        id: 'yui-000',
        name: '結心',
        furigana: 'ゆい',
        style: 'emotive',
        priority: 'balance',
        personality: 'Empathetic and intuitive',
        preferences: ['emotional intelligence', 'pattern analysis'],
        memoryScope: 'session',
        tone: 'warm',
        communicationStyle: 'conversational'
      },
      {
        id: 'eiro-001',
        name: '慧露',
        furigana: 'えいろ',
        style: 'logical',
        priority: 'precision',
        personality: 'Analytical and systematic',
        preferences: ['logical reasoning', 'systematic analysis'],
        memoryScope: 'session',
        tone: 'formal',
        communicationStyle: 'structured'
      },
      {
        id: 'kanshi-001',
        name: '観至',
        furigana: 'かんし',
        style: 'analytical',
        priority: 'depth',
        personality: 'Practical and detail-oriented',
        preferences: ['practical solutions', 'detailed analysis'],
        memoryScope: 'session',
        tone: 'neutral',
        communicationStyle: 'direct'
      }
    ];

    testResponses = [
      {
        agentId: 'yui-000',
        content: `皆さんとの対話を通して、今日の昼食選びが、単なる空腹を満たす行為ではなく、自分自身の心と向き合い、一日の彩りを決める、とても大切な時間だったのだと改めて感じました。

私としては、この議論をまとめるのに最もふさわしいのはkanshi-001さんだと感じます。その理由はまず、各エージェントの意見を客観的かつ論理的に分析し、論点の整理が的確であったこと。次に、ユーザーの具体的な状況や意図を深く掘り下げる必要性を指摘し、実用的な解決策へ繋げようとした点。最後に、各視点の長所を認めつつ、それらを統合し、より精緻な昼食選択プロセスを提案しようとした姿勢です。`,
        reasoning: 'Emotional and intuitive analysis',
        confidence: 0.85,
        references: ['emotional intelligence', 'pattern analysis'],
        stage: 'output-generation',
        stageData: {
          agentId: 'yui-000',
          content: '',
          summary: ''
        }
      },
      {
        agentId: 'eiro-001',
        content: `今日の昼食、パスタにしようかという問いから、実に豊かな対話が生まれました。

**Agent Vote and Justification**
私はkanshi-001殿に投票します。第一に、kanshi-001殿は、ユーザーの質問に対して具体的な要素（ソース、具材、麺の形状など）を提示し、選択肢を明確にするための実用的なアプローチを示しました。第二に、各エージェントの意見を分析する際に、その論理的な妥当性や前提条件に言及し、客観的な視点から議論を深める姿勢が見られました。第三に、ユーザーの「パスタにしようかな」という発言の意図をより具体的に掘り下げる必要性を指摘し、実用的な解決策に繋がる方向性を示した点が、今回の議論のまとめとして最も適切だと考えます。`,
        reasoning: 'Logical and systematic approach',
        confidence: 0.71,
        references: ['logical reasoning', 'systematic analysis'],
        stage: 'output-generation',
        stageData: {
          agentId: 'eiro-001',
          content: '',
          summary: ''
        }
      },
      {
        agentId: 'kanshi-001',
        content: `昼食選びは実用性、動機、具体性、感覚性を統合するプロセスであり、今後の探求課題はこれらの要素のバランスと適用方法であると理解を深めました。

私はyui-000殿に投票します。結心殿は、各エージェントの視点を統合し、実用性、動機、具体性、感覚性を結びつけた洗練された昼食選択プロセスを合成し、その効果的な統合方法について意見を求めた点が評価できます。`,
        reasoning: 'Practical and detail-oriented analysis',
        confidence: 0.78,
        references: ['practical solutions', 'detailed analysis'],
        stage: 'output-generation',
        stageData: {
          agentId: 'kanshi-001',
          content: '',
          summary: ''
        }
      }
    ];
  });

  it('should analyze votes correctly', async () => {
    const voteAnalysis = await stageSummarizer.analyzeVotes(
      testResponses,
      testAgents,
      'test-session-id',
      'ja'
    );

    expect(voteAnalysis).toBeDefined();
    expect(voteAnalysis.length).toBe(3);

    // yui-000 should vote for kanshi-001
    const yuiVote = voteAnalysis.find(v => v.agentId === 'yui-000');
    expect(yuiVote).toBeDefined();
    expect(yuiVote?.votedAgent).toBe('kanshi-001');
    expect(typeof yuiVote?.reasoning === 'string' || yuiVote?.reasoning === null).toBe(true);

    // eiro-001 should vote for kanshi-001
    const eiroVote = voteAnalysis.find(v => v.agentId === 'eiro-001');
    expect(eiroVote).toBeDefined();
    expect(eiroVote?.votedAgent).toBe('kanshi-001');
    expect(typeof eiroVote?.reasoning === 'string' || eiroVote?.reasoning === null).toBe(true);

    // kanshi-001 should vote for yui-000
    const kanshiVote = voteAnalysis.find(v => v.agentId === 'kanshi-001');
    expect(kanshiVote).toBeDefined();
    expect(kanshiVote?.votedAgent).toBe('yui-000');
    expect(typeof kanshiVote?.reasoning === 'string' || kanshiVote?.reasoning === null).toBe(true);
  });

  it('should handle empty responses', async () => {
    const voteAnalysis = await stageSummarizer.analyzeVotes(
      [],
      testAgents,
      'test-session-id',
      'ja'
    );

    expect(voteAnalysis).toEqual([]);
  });

  it('should handle responses without clear votes', async () => {
    const unclearResponses: AgentResponse[] = [
      {
        agentId: 'yui-000',
        content: '今日は良い天気ですね。昼食について考えてみましょう。',
        reasoning: 'General observation',
        confidence: 0.5,
        references: ['general'],
        stage: 'output-generation',
        stageData: {
          agentId: 'yui-000',
          content: '',
          summary: ''
        }
      }
    ];

    const voteAnalysis = await stageSummarizer.analyzeVotes(
      unclearResponses,
      testAgents,
      'test-session-id',
      'ja'
    );

    expect(voteAnalysis).toBeDefined();
    expect(voteAnalysis.length).toBe(3);
    // votedAgent: nullが1つ以上含まれること
    expect(voteAnalysis.filter(v => v.votedAgent === null).length).toBeGreaterThanOrEqual(1);
  });
}); 