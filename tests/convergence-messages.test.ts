import { describe, it, expect } from 'vitest';
import { createConvergenceMessage, createVotingStartMessage, createVotingResultMessage } from '../src/utils/convergence-messages.js';

describe('Convergence Messages', () => {
  describe('createConvergenceMessage', () => {
    it('should create a natural consensus message in Japanese (default)', () => {
      const message = createConvergenceMessage(
        'natural_consensus',
        5,
        8.5,
        3,
        3,
        'test-session'
      );

      expect(message.id).toContain('convergence-test-session-5-');
      expect(message.agentId).toBe('system');
      expect(message.role).toBe('system');
      expect(message.content).toContain('🎯 自然な合意形成による対話収束');
      expect(message.content).toContain('全体合意度 8.5/10 に達し');
      expect(message.content).toContain('3/3 のエージェントが次のステップへの準備を完了');
      expect(message.content).toContain('**継続ラウンド数**: 5 ラウンド');
      expect(message.content).toContain('**最終合意度**: 8.5/10');
      expect(message.content).toContain('**準備完了エージェント**: 3/3');
      expect(message.metadata?.convergenceReason).toBe('natural_consensus');
      expect(message.metadata?.round).toBe(5);
      expect(message.metadata?.consensusLevel).toBe(8.5);
    });

    it('should create a natural consensus message in English', () => {
      const message = createConvergenceMessage(
        'natural_consensus',
        5,
        8.5,
        3,
        3,
        'test-session',
        'en'
      );

      expect(message.content).toContain('🎯 Natural Consensus Formation - Dialogue Convergence');
      expect(message.content).toContain('Overall consensus reached 8.5/10');
      expect(message.content).toContain('3/3 agents are ready for the next step');
      expect(message.content).toContain('**Rounds Continued**: 5 rounds');
      expect(message.content).toContain('**Final Consensus**: 8.5/10');
      expect(message.content).toContain('**Agents Ready**: 3/3');
    });

    it('should create a high satisfaction message in Japanese', () => {
      const message = createConvergenceMessage(
        'high_satisfaction',
        3,
        9.2,
        2,
        3,
        'test-session',
        'ja'
      );

      expect(message.content).toContain('✨ 高い満足度による対話完了');
      expect(message.content).toContain('高い満足度（9.2/10）が達成され');
      expect(message.content).toContain('議論が十分に深まったと判断');
    });

    it('should create a high satisfaction message in English', () => {
      const message = createConvergenceMessage(
        'high_satisfaction',
        3,
        9.2,
        2,
        3,
        'test-session',
        'en'
      );

      expect(message.content).toContain('✨ High Satisfaction - Dialogue Completion');
      expect(message.content).toContain('High satisfaction (9.2/10) was achieved');
      expect(message.content).toContain('discussion is considered sufficiently deep');
    });

    it('should create a max rounds message in Japanese', () => {
      const message = createConvergenceMessage(
        'max_rounds',
        20,
        6.8,
        1,
        3,
        'test-session',
        'ja'
      );

      expect(message.content).toContain('⏰ 最大ラウンド数到達による対話終了');
      expect(message.content).toContain('最大ラウンド数に達しました');
      expect(message.content).toContain('現在の合意度は 6.8/10');
      expect(message.content).toContain('トークン効率とコスト管理のため');
    });

    it('should create a max rounds message in English', () => {
      const message = createConvergenceMessage(
        'max_rounds',
        20,
        6.8,
        1,
        3,
        'test-session',
        'en'
      );

      expect(message.content).toContain('⏰ Maximum Rounds Reached - Dialogue Termination');
      expect(message.content).toContain('Maximum rounds reached');
      expect(message.content).toContain('Current consensus: 6.8/10');
      expect(message.content).toContain('token efficiency and cost management');
    });

    it('should create a facilitator decision message in Japanese', () => {
      const message = createConvergenceMessage(
        'facilitator_decision',
        7,
        7.5,
        2,
        3,
        'test-session',
        'ja'
      );

      expect(message.content).toContain('🎭 ファシリテーター判断による対話収束');
      expect(message.content).toContain('ファシリテーターが対話の成熟度を分析');
      expect(message.content).toContain('統合・結論化が適切と判断');
      expect(message.content).toContain('合意度: 7.5/10');
    });

    it('should create a facilitator decision message in English', () => {
      const message = createConvergenceMessage(
        'facilitator_decision',
        7,
        7.5,
        2,
        3,
        'test-session',
        'en'
      );

      expect(message.content).toContain('🎭 Facilitator Decision - Dialogue Convergence');
      expect(message.content).toContain('facilitator analyzed dialogue maturity');
      expect(message.content).toContain('integration and conclusion are more appropriate');
      expect(message.content).toContain('Consensus: 7.5/10');
    });

    it('should include additional info when provided', () => {
      const message = createConvergenceMessage(
        'natural_consensus',
        5,
        8.5,
        3,
        3,
        'test-session',
        'ja',
        'Additional context information'
      );

      expect(message.content).toContain('**追加情報**: Additional context information');
      expect(message.metadata?.additionalInfo).toBe('Additional context information');

      const englishMessage = createConvergenceMessage(
        'natural_consensus',
        5,
        8.5,
        3,
        3,
        'test-session',
        'en',
        'Additional context information'
      );

      expect(englishMessage.content).toContain('**Additional Information**: Additional context information');
    });
  });

  describe('createVotingStartMessage', () => {
    it('should create a voting start message in Japanese (default)', () => {
      const message = createVotingStartMessage('test-session', 5);

      expect(message.id).toContain('voting-start-test-session-5-');
      expect(message.agentId).toBe('system');
      expect(message.role).toBe('system');
      expect(message.content).toContain('🗳️ ファイナライザー選出投票開始');
      expect(message.content).toContain('対話が収束に達したため');
      expect(message.content).toContain('最終統合を担当するエージェントを選出');
      expect(message.content).toContain('投票プロセス');
      expect(message.content).toContain('評価基準');
      expect(message.content).toContain('各エージェントの投票をお待ちください');
      expect(message.metadata?.votingType).toBe('finalizer_selection');
      expect(message.metadata?.round).toBe(5);
    });

    it('should create a voting start message in English', () => {
      const message = createVotingStartMessage('test-session', 5, 'en');

      expect(message.content).toContain('🗳️ Finalizer Selection Voting Started');
      expect(message.content).toContain('dialogue has reached convergence');
      expect(message.content).toContain('select the agent responsible for final integration');
      expect(message.content).toContain('Voting Process');
      expect(message.content).toContain('Evaluation Criteria');
      expect(message.content).toContain('Waiting for each agent\'s vote');
    });
  });

  describe('createVotingResultMessage', () => {
    const mockVotingResults = [
      {
        voter: 'agent-1',
        voterName: 'Agent One',
        votedFor: 'agent-2',
        votedForName: 'Agent Two',
        reasoning: 'Has excellent integration skills'
      },
      {
        voter: 'agent-2',
        voterName: 'Agent Two',
        votedFor: 'agent-2',
        votedForName: 'Agent Two',
        reasoning: 'I have good synthesis capabilities'
      },
      {
        voter: 'agent-3',
        voterName: 'Agent Three',
        votedFor: 'agent-1',
        votedForName: 'Agent One',
        reasoning: 'Strong analytical thinking'
      }
    ];

    it('should create a voting result message in Japanese (default)', () => {
      const message = createVotingResultMessage(
        mockVotingResults,
        'agent-2',
        'Agent Two',
        'test-session',
        5
      );

      expect(message.id).toContain('voting-result-test-session-5-');
      expect(message.agentId).toBe('system');
      expect(message.role).toBe('system');
      expect(message.content).toContain('🏆 ファイナライザー選出結果');
      expect(message.content).toContain('投票が完了しました');
      expect(message.content).toContain('投票結果');
      expect(message.content).toContain('🏆 **Agent Two**: 2票');
      expect(message.content).toContain('**Agent One**: 1票');
      expect(message.content).toContain('選出結果');
      expect(message.content).toContain('**Agent Two** (agent-2) がファイナライザーとして選出');
      expect(message.content).toContain('Has excellent integration skills');
      expect(message.content).toContain('I have good synthesis capabilities');
      expect(message.content).toContain('Strong analytical thinking');
      expect(message.metadata?.selectedFinalizer).toBe('agent-2');
      expect(message.metadata?.selectedFinalizerName).toBe('Agent Two');
      expect(message.metadata?.votingType).toBe('finalizer_selection');
    });

    it('should create a voting result message in English', () => {
      const message = createVotingResultMessage(
        mockVotingResults,
        'agent-2',
        'Agent Two',
        'test-session',
        5,
        'en'
      );

      expect(message.content).toContain('🏆 Finalizer Selection Results');
      expect(message.content).toContain('Voting has been completed');
      expect(message.content).toContain('Voting Results');
      expect(message.content).toContain('🏆 **Agent Two**: 2 votes');
      expect(message.content).toContain('**Agent One**: 1 votes');
      expect(message.content).toContain('Selection Result');
      expect(message.content).toContain('**Agent Two** (agent-2) has been selected as the finalizer');
      expect(message.content).toContain('Has excellent integration skills');
      expect(message.content).toContain('I have good synthesis capabilities');
      expect(message.content).toContain('Strong analytical thinking');
    });

    it('should handle voting results with metadata', () => {
      const message = createVotingResultMessage(
        mockVotingResults,
        'agent-2',
        'Agent Two',
        'test-session',
        5,
        'ja'
      );

      expect(message.metadata?.votingResults).toEqual(mockVotingResults);
      expect(message.metadata?.round).toBe(5);
    });
  });
});