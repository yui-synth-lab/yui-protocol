import { describe, it, expect } from 'vitest';
import { createFacilitatorMessage, createConsensusMessage } from '../src/utils/message-converters.js';
import { FacilitatorLog } from '../src/types/consensus.js';
import { Agent } from '../src/types/index.js';

// Define the missing interfaces for testing
interface AgentConsensusData {
  agentId: string;
  agentName: string;
  satisfaction: number;
  additionalPoints: boolean;
  questions: string[];
  readyToMove: boolean;
  reasoning: string;
  timestamp: Date;
}

interface SessionConsensusSnapshot {
  round: number;
  timestamp: Date;
  overallConsensus: number;
  agentConsensus: AgentConsensusData[];
}

describe('Message Converters', () => {
  const mockFacilitatorLog: FacilitatorLog = {
    sessionId: 'test-session',
    roundNumber: 1,
    timestamp: new Date('2025-01-01T00:00:00.000Z'),
    action: 'analysis',
    decision: {
      type: 'state_analysis',
      reasoning: 'Test reasoning',
      dataAnalyzed: {
        consensusLevels: { 'agent-1': 7.5, 'agent-2': 8.0 },
        overallConsensus: 7.8,
        shouldContinue: true,
        topicDrift: false
      },
      suggestedActions: []
    }
  };

  const mockAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Agent One',
      furigana: 'エージェントワン',
      style: 'logical',
      priority: 'precision',
      memoryScope: 'session',
      personality: 'Test personality',
      preferences: [],
      tone: 'neutral',
      communicationStyle: 'direct',
      avatar: '🤖',
      color: '#000000'
    },
    {
      id: 'agent-2',
      name: 'Agent Two',
      furigana: 'エージェントツー',
      style: 'intuitive',
      priority: 'breadth',
      memoryScope: 'session',
      personality: 'Test personality 2',
      preferences: [],
      tone: 'creative',
      communicationStyle: 'metaphorical',
      avatar: '🎨',
      color: '#FFFFFF'
    }
  ];

  const mockConsensusSnapshot: SessionConsensusSnapshot = {
    round: 2,
    timestamp: new Date('2025-01-01T00:00:00.000Z'),
    overallConsensus: 7.5,
    agentConsensus: [
      {
        agentId: 'agent-1',
        agentName: 'Agent One',
        satisfaction: 8.0,
        additionalPoints: false,
        questions: [],
        readyToMove: true,
        reasoning: 'Good progress made',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      },
      {
        agentId: 'agent-2',
        agentName: 'Agent Two',
        satisfaction: 7.0,
        additionalPoints: true,
        questions: ['What about edge cases?'],
        readyToMove: false,
        reasoning: 'Need more discussion',
        timestamp: new Date('2025-01-01T00:00:00.000Z')
      }
    ]
  };

  describe('createFacilitatorMessage', () => {
    it('should create a facilitator message in Japanese (default)', () => {
      const message = createFacilitatorMessage(mockFacilitatorLog, 'test-session');

      expect(message.id).toContain('facilitator-test-session-1-');
      expect(message.agentId).toBe('facilitator');
      expect(message.role).toBe('facilitator');
      expect(message.content).toContain('ファシリテーター分析 (Round 1)');
      expect(message.content).toContain('現在の状況分析:');
      expect(message.content).toContain('全体コンセンサス: 7.8/10');
      expect(message.content).toContain('議論継続判断: 継続推奨');
      expect(message.content).toContain('エージェント別満足度:');
      expect(message.metadata?.roundNumber).toBe(1);
      expect(message.metadata?.consensusLevel).toBe(7.8);
    });

    it('should create a facilitator message in English', () => {
      const message = createFacilitatorMessage(mockFacilitatorLog, 'test-session', 'en');

      expect(message.id).toContain('facilitator-test-session-1-');
      expect(message.agentId).toBe('facilitator');
      expect(message.role).toBe('facilitator');
      expect(message.content).toContain('Facilitator Analysis (Round 1)');
      expect(message.content).toContain('Current Situation Analysis:');
      expect(message.content).toContain('Overall Consensus: 7.8/10');
      expect(message.content).toContain('Continue Discussion: Recommended');
      expect(message.content).toContain('Agent Satisfaction Levels:');
      expect(message.metadata?.roundNumber).toBe(1);
      expect(message.metadata?.consensusLevel).toBe(7.8);
    });

    it('should include topic drift warning when detected', () => {
      const logWithDrift = {
        ...mockFacilitatorLog,
        decision: {
          ...mockFacilitatorLog.decision,
          dataAnalyzed: {
            ...mockFacilitatorLog.decision.dataAnalyzed,
            topicDrift: true
          }
        }
      };

      const message = createFacilitatorMessage(logWithDrift, 'test-session', 'ja');
      expect(message.content).toContain('トピックの逸脱を検出');

      const englishMessage = createFacilitatorMessage(logWithDrift, 'test-session', 'en');
      expect(englishMessage.content).toContain('Topic Drift Detected');
    });

    it('should include selected action details when available', () => {
      const logWithAction = {
        ...mockFacilitatorLog,
        decision: {
          ...mockFacilitatorLog.decision,
          selectedAction: {
            type: 'deep_dive' as const,
            target: 'agent-1',
            reason: 'Need deeper analysis',
            priority: 8
          }
        }
      };

      const message = createFacilitatorMessage(logWithAction, 'test-session', 'ja');
      expect(message.content).toContain('**実行アクション:** deep_dive');
      expect(message.content).toContain('**対象:** agent-1');
      expect(message.content).toContain('**理由:** Need deeper analysis');

      const englishMessage = createFacilitatorMessage(logWithAction, 'test-session', 'en');
      expect(englishMessage.content).toContain('**Action Taken:** deep_dive');
      expect(englishMessage.content).toContain('**Target:** agent-1');
      expect(englishMessage.content).toContain('**Reason:** Need deeper analysis');
    });
  });

  describe('createConsensusMessage', () => {
    it('should create a consensus message in Japanese (default)', () => {
      const message = createConsensusMessage(mockConsensusSnapshot, 'test-session', mockAgents);

      expect(message.id).toContain('consensus-test-session-2-');
      expect(message.agentId).toBe('consensus');
      expect(message.role).toBe('consensus');
      expect(message.content).toContain('コンセンサス状況 (Round 2)');
      expect(message.content).toContain('全体合意度:');
      expect(message.content).toContain('エージェント別満足度:');
      expect(message.content).toContain('議論の進行状況:');
      expect(message.content).toContain('次へ進む準備完了: 1/2 エージェント');
      expect(message.content).toContain('追加議論希望: 1 エージェント');
      expect(message.metadata?.roundNumber).toBe(2);
      expect(message.metadata?.consensusLevel).toBe(7.5);
    });

    it('should create a consensus message in English', () => {
      const message = createConsensusMessage(mockConsensusSnapshot, 'test-session', mockAgents, 'en');

      expect(message.id).toContain('consensus-test-session-2-');
      expect(message.agentId).toBe('consensus');
      expect(message.role).toBe('consensus');
      expect(message.content).toContain('Consensus Status (Round 2)');
      expect(message.content).toContain('Overall Consensus:');
      expect(message.content).toContain('Agent Satisfaction Levels:');
      expect(message.content).toContain('Discussion Progress:');
      expect(message.content).toContain('Ready to proceed: 1/2 agents');
      expect(message.content).toContain('Additional discussion requested: 1 agents');
      expect(message.metadata?.roundNumber).toBe(2);
      expect(message.metadata?.consensusLevel).toBe(7.5);
    });

    it('should show high consensus message when overall consensus >= 8.0', () => {
      const highConsensusSnapshot = {
        ...mockConsensusSnapshot,
        overallConsensus: 8.5
      };

      const message = createConsensusMessage(highConsensusSnapshot, 'test-session', mockAgents, 'ja');
      expect(message.content).toContain('高い合意達成');

      const englishMessage = createConsensusMessage(highConsensusSnapshot, 'test-session', mockAgents, 'en');
      expect(englishMessage.content).toContain('High Consensus Achieved');
    });

    it('should show moderate consensus message when overall consensus >= 6.0', () => {
      const moderateConsensusSnapshot = {
        ...mockConsensusSnapshot,
        overallConsensus: 7.0
      };

      const message = createConsensusMessage(moderateConsensusSnapshot, 'test-session', mockAgents, 'ja');
      expect(message.content).toContain('中程度の合意');

      const englishMessage = createConsensusMessage(moderateConsensusSnapshot, 'test-session', mockAgents, 'en');
      expect(englishMessage.content).toContain('Moderate Consensus');
    });

    it('should show building consensus message when overall consensus < 6.0', () => {
      const lowConsensusSnapshot = {
        ...mockConsensusSnapshot,
        overallConsensus: 5.0
      };

      const message = createConsensusMessage(lowConsensusSnapshot, 'test-session', mockAgents, 'ja');
      expect(message.content).toContain('合意形成中');

      const englishMessage = createConsensusMessage(lowConsensusSnapshot, 'test-session', mockAgents, 'en');
      expect(englishMessage.content).toContain('Consensus Building');
    });

    it('should include agent reasoning and questions', () => {
      const message = createConsensusMessage(mockConsensusSnapshot, 'test-session', mockAgents, 'ja');
      expect(message.content).toContain('Good progress made');
      expect(message.content).toContain('What about edge cases?');

      const englishMessage = createConsensusMessage(mockConsensusSnapshot, 'test-session', mockAgents, 'en');
      expect(englishMessage.content).toContain('Good progress made');
      expect(englishMessage.content).toContain('What about edge cases?');
    });
  });
});