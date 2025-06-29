import { describe, it, expect } from 'vitest';
import {
  Agent,
  Session,
  Message,
  DialogueStage,
  AgentResponse,
  CollaborationResult,
  StageHistory,
  StageResult,
  Conflict,
  SynthesisAttempt,
  IndividualThought,
  MutualReflection,
  ConflictResolution,
  DialogueLog,
  AgentStyle
} from '../src/types/index.js';

describe('Type Definitions', () => {
  describe('Agent', () => {
    it('should have required properties', () => {
      const agent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        style: 'logical',
        priority: 'precision',
        memoryScope: 'session',
        personality: 'Test personality',
        preferences: ['test']
      };

      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.style).toBe('logical');
      expect(agent.priority).toBe('precision');
      expect(agent.memoryScope).toBe('session');
      expect(agent.personality).toBe('Test personality');
      expect(agent.preferences).toEqual(['test']);
    });

    it('should accept valid style values', () => {
      const validStyles = ['logical', 'critical', 'intuitive', 'meta', 'emotive', 'analytical'] as const;
      validStyles.forEach(style => {
        const agent: Agent = {
          id: 'test-agent',
          name: 'Test Agent',
          style,
          priority: 'precision',
          memoryScope: 'session',
          personality: 'Test personality',
          preferences: ['test']
        };
        expect(agent.style).toBe(style);
      });
    });

    it('should accept valid priority values', () => {
      const validPriorities = ['precision', 'breadth', 'depth', 'balance'] as const;
      validPriorities.forEach(priority => {
        const agent: Agent = {
          id: 'test-agent',
          name: 'Test Agent',
          style: 'logical',
          priority,
          memoryScope: 'session',
          personality: 'Test personality',
          preferences: ['test']
        };
        expect(agent.priority).toBe(priority);
      });
    });

    it('should accept valid memory scope values', () => {
      const validMemoryScopes = ['local', 'session', 'cross-session'] as const;
      validMemoryScopes.forEach(memoryScope => {
        const agent: Agent = {
          id: 'test-agent',
          name: 'Test Agent',
          style: 'logical',
          priority: 'precision',
          memoryScope,
          personality: 'Test personality',
          preferences: ['test']
        };
        expect(agent.memoryScope).toBe(memoryScope);
      });
    });
  });

  describe('Message', () => {
    it('should have required properties', () => {
      const message: Message = {
        id: 'test-message',
        agentId: 'test-agent',
        content: 'Test message content',
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
        role: 'user'
      };

      expect(message.id).toBe('test-message');
      expect(message.agentId).toBe('test-agent');
      expect(message.content).toBe('Test message content');
      expect(message.timestamp).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(message.role).toBe('user');
    });

    it('should accept valid role values', () => {
      const validRoles = ['user', 'agent', 'system'] as const;
      validRoles.forEach(role => {
        const message: Message = {
          id: 'test-message',
          agentId: 'test-agent',
          content: 'Test message content',
          timestamp: new Date('2023-01-01T00:00:00.000Z'),
          role
        };
        expect(message.role).toBe(role);
      });
    });

    it('should have optional properties', () => {
      const message: Message = {
        id: 'test-message',
        agentId: 'test-agent',
        content: 'Test message content',
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
        role: 'user',
        stage: 'individual-thought',
        metadata: {
          reasoning: 'Test reasoning',
          confidence: 0.8,
          references: ['ref1', 'ref2'],
          stageData: { test: 'data' }
        }
      };

      expect(message.stage).toBe('individual-thought');
      expect(message.metadata?.reasoning).toBe('Test reasoning');
      expect(message.metadata?.confidence).toBe(0.8);
      expect(message.metadata?.references).toEqual(['ref1', 'ref2']);
      expect(message.metadata?.stageData).toEqual({ test: 'data' });
    });
  });

  describe('Session', () => {
    it('should have required properties', () => {
      const session: Session = {
        id: 'test-session',
        title: 'Test Session',
        agents: [],
        messages: [],
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        status: 'active',
        stageHistory: []
      };

      expect(session.id).toBe('test-session');
      expect(session.title).toBe('Test Session');
      expect(session.agents).toEqual([]);
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(session.updatedAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(session.status).toBe('active');
      expect(session.stageHistory).toEqual([]);
    });

    it('should accept valid status values', () => {
      const validStatuses = ['active', 'completed', 'paused'] as const;
      validStatuses.forEach(status => {
        const session: Session = {
          id: 'test-session',
          title: 'Test Session',
          agents: [],
          messages: [],
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          updatedAt: new Date('2023-01-01T00:00:00.000Z'),
          status,
          stageHistory: []
        };
        expect(session.status).toBe(status);
      });
    });
  });

  describe('DialogueStage', () => {
    it('should have valid stage values', () => {
      const stages: DialogueStage[] = [
        'individual-thought',
        'mutual-reflection',
        'conflict-resolution',
        'synthesis-attempt',
        'output-generation'
      ];

      expect(stages).toHaveLength(5);
      expect(stages).toContain('individual-thought');
      expect(stages).toContain('mutual-reflection');
      expect(stages).toContain('conflict-resolution');
      expect(stages).toContain('synthesis-attempt');
      expect(stages).toContain('output-generation');
    });
  });

  describe('AgentResponse', () => {
    it('should have required properties', () => {
      const response: AgentResponse = {
        agentId: 'test-agent',
        content: 'Test response content',
        reasoning: 'Test reasoning',
        confidence: 0.8,
        references: ['ref1', 'ref2'],
        stage: 'individual-thought',
        stageData: { test: 'data' }
      };

      expect(response.agentId).toBe('test-agent');
      expect(response.content).toBe('Test response content');
      expect(response.reasoning).toBe('Test reasoning');
      expect(response.confidence).toBe(0.8);
      expect(response.references).toEqual(['ref1', 'ref2']);
      expect(response.stage).toBe('individual-thought');
      expect(response.stageData).toEqual({ test: 'data' });
    });
  });

  describe('Conflict', () => {
    it('should have required properties', () => {
      const conflict: Conflict = {
        id: 'test-conflict',
        agents: ['agent-1', 'agent-2'],
        description: 'Test conflict description',
        severity: 'medium',
        resolution: 'Test resolution'
      };

      expect(conflict.id).toBe('test-conflict');
      expect(conflict.agents).toEqual(['agent-1', 'agent-2']);
      expect(conflict.description).toBe('Test conflict description');
      expect(conflict.severity).toBe('medium');
      expect(conflict.resolution).toBe('Test resolution');
    });

    it('should accept valid severity values', () => {
      const validSeverities = ['low', 'medium', 'high'] as const;
      validSeverities.forEach(severity => {
        const conflict: Conflict = {
          id: 'test-conflict',
          agents: ['agent-1'],
          description: 'Test conflict',
          severity
        };
        expect(conflict.severity).toBe(severity);
      });
    });
  });

  describe('SynthesisAttempt', () => {
    it('should have required properties', () => {
      const synthesis: SynthesisAttempt = {
        consensus: 0.8,
        unifiedPerspective: 'Test unified perspective',
        remainingDisagreements: ['disagreement1', 'disagreement2'],
        confidence: 0.9
      };

      expect(synthesis.consensus).toBe(0.8);
      expect(synthesis.unifiedPerspective).toBe('Test unified perspective');
      expect(synthesis.remainingDisagreements).toEqual(['disagreement1', 'disagreement2']);
      expect(synthesis.confidence).toBe(0.9);
    });
  });

  describe('AgentStyle', () => {
    it('should have valid style values', () => {
      const styles: AgentStyle[] = [
        'gentle-philosopher',
        'pragmatic-engineer',
        'creative-artist',
        'analytical-scientist',
        'strategic-planner',
        'critical-thinker'
      ];

      expect(styles).toHaveLength(6);
      expect(styles).toContain('gentle-philosopher');
      expect(styles).toContain('pragmatic-engineer');
      expect(styles).toContain('creative-artist');
      expect(styles).toContain('analytical-scientist');
      expect(styles).toContain('strategic-planner');
      expect(styles).toContain('critical-thinker');
    });
  });
}); 