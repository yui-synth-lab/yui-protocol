import { describe, it, expect } from 'vitest';
import {
  Agent,
  Message,
  Session,
  AgentResponse,
  CollaborationResult,
  DialogueStage,
  StageHistory,
  StageResult,
  Conflict,
  ConflictResolution,
  SynthesisAttempt,
  IndividualThought,
  MutualReflection,
  DialogueLog,
  StageSummary,
  SummaryStage,
  StageData,
  AgentInstance,
  SynthesisData,
  FinalData,
  VotingResults,
  StageSummarizerOptions,
  DelayOptions,
  ProgressCallback,
  StageExecutionResult,
  SummaryExecutionResult,
  FinalizeExecutionResult,
  ConflictDescriptionTemplates,
  ApproachAnalysis,
  PotentialConflict,
  Language
} from '../src/types/index.js';

describe('Type Definitions', () => {
  describe('Agent', () => {
    it('should have correct structure', () => {
      const agent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        memoryScope: 'local',
        personality: 'Test personality',
        preferences: ['test'],
        tone: 'formal',
        communicationStyle: 'direct',
        avatar: 'avatar.png',
        color: '#ff0000',
        isSummarizer: true
      };

      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.style).toBe('logical');
      expect(agent.priority).toBe('precision');
      expect(agent.memoryScope).toBe('local');
      expect(agent.avatar).toBe('avatar.png');
      expect(agent.color).toBe('#ff0000');
      expect(agent.isSummarizer).toBe(true);
    });

    it('should allow optional properties', () => {
      const agent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        memoryScope: 'local',
        personality: 'Test personality',
        preferences: ['test'],
        tone: 'formal',
        communicationStyle: 'direct'
      };

      expect(agent.avatar).toBeUndefined();
      expect(agent.color).toBeUndefined();
      expect(agent.isSummarizer).toBeUndefined();
    });
  });

  describe('Message', () => {
    it('should have correct structure', () => {
      const message: Message = {
        id: 'msg-1',
        agentId: 'agent-1',
        content: 'Test message',
        timestamp: new Date(),
        role: 'agent',
        stage: 'individual-thought',
        sequenceNumber: 1,
        metadata: {
          reasoning: 'Test reasoning',
          confidence: 0.8,
          references: ['ref1', 'ref2'],
          stageData: {
            agentId: 'agent-1',
            content: 'Test content',
            reasoning: 'Test reasoning',
            confidence: 0.8
          },
          voteFor: 'agent-2',
          voteReasoning: 'Test vote reasoning',
          voteSection: 'Test vote section'
        }
      };

      expect(message.id).toBe('msg-1');
      expect(message.agentId).toBe('agent-1');
      expect(message.content).toBe('Test message');
      expect(message.role).toBe('agent');
      expect(message.stage).toBe('individual-thought');
      expect(message.sequenceNumber).toBe(1);
      expect(message.metadata?.reasoning).toBe('Test reasoning');
      expect(message.metadata?.confidence).toBe(0.8);
    });
  });

  describe('Session', () => {
    it('should have correct structure', () => {
      const session: Session = {
        id: 'session-1',
        title: 'Test Session',
        agents: [],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        currentStage: 'individual-thought',
        stageHistory: [],
        stageSummaries: [],
        complete: false,
        outputFileName: 'output.json',
        sequenceNumber: 1,
        language: 'en'
      };

      expect(session.id).toBe('session-1');
      expect(session.title).toBe('Test Session');
      expect(session.status).toBe('active');
      expect(session.currentStage).toBe('individual-thought');
      expect(session.complete).toBe(false);
      expect(session.outputFileName).toBe('output.json');
      expect(session.sequenceNumber).toBe(1);
      expect(session.language).toBe('en');
    });
  });

  describe('AgentResponse', () => {
    it('should have correct structure', () => {
      const response: AgentResponse = {
        agentId: 'agent-1',
        content: 'Test response',
        summary: 'Test summary',
        reasoning: 'Test reasoning',
        confidence: 0.9,
        references: ['ref1'],
        stage: 'individual-thought',
        stageData: {
          agentId: 'agent-1',
          content: 'Test content',
          reasoning: 'Test reasoning',
          confidence: 0.9
        },
        metadata: {
          voteFor: 'agent-2',
          voteReasoning: 'Test vote reasoning',
          voteSection: 'Test vote section'
        }
      };

      expect(response.agentId).toBe('agent-1');
      expect(response.content).toBe('Test response');
      expect(response.summary).toBe('Test summary');
      expect(response.confidence).toBe(0.9);
      expect(response.stage).toBe('individual-thought');
    });
  });

  describe('CollaborationResult', () => {
    it('should have correct structure', () => {
      const result: CollaborationResult = {
        sessionId: 'session-1',
        finalDecision: 'Test decision',
        consensus: 0.8,
        reasoningTrace: [],
        summary: 'Test summary',
        stageResults: []
      };

      expect(result.sessionId).toBe('session-1');
      expect(result.finalDecision).toBe('Test decision');
      expect(result.consensus).toBe(0.8);
      expect(result.summary).toBe('Test summary');
    });
  });

  describe('DialogueStage', () => {
    it('should accept all valid stages', () => {
      const stages: DialogueStage[] = [
        'individual-thought',
        'mutual-reflection',
        'mutual-reflection-summary',
        'conflict-resolution',
        'conflict-resolution-summary',
        'synthesis-attempt',
        'synthesis-attempt-summary',
        'output-generation',
        'finalize'
      ];

      expect(stages).toHaveLength(9);
      expect(stages[0]).toBe('individual-thought');
      expect(stages[8]).toBe('finalize');
    });
  });

  describe('StageHistory', () => {
    it('should have correct structure', () => {
      const history: StageHistory = {
        stage: 'individual-thought',
        startTime: new Date(),
        endTime: new Date(),
        agentResponses: [],
        conflicts: [],
        synthesis: {
          consensus: 0.8,
          unifiedPerspective: 'Test perspective',
          remainingDisagreements: ['disagreement1'],
          confidence: 0.9
        },
        sequenceNumber: 1
      };

      expect(history.stage).toBe('individual-thought');
      expect(history.startTime).toBeInstanceOf(Date);
      expect(history.endTime).toBeInstanceOf(Date);
      expect(history.sequenceNumber).toBe(1);
    });
  });

  describe('StageResult', () => {
    it('should have correct structure', () => {
      const result: StageResult = {
        stage: 'individual-thought',
        agentResponses: [],
        conflicts: [],
        synthesis: {
          consensus: 0.8,
          unifiedPerspective: 'Test perspective',
          remainingDisagreements: ['disagreement1'],
          confidence: 0.9
        },
        duration: 5000
      };

      expect(result.stage).toBe('individual-thought');
      expect(result.duration).toBe(5000);
    });
  });

  describe('Conflict', () => {
    it('should have correct structure', () => {
      const conflict: Conflict = {
        id: 'conflict-1',
        agents: ['agent-1', 'agent-2'],
        description: 'Test conflict',
        severity: 'medium',
        resolution: 'Test resolution'
      };

      expect(conflict.id).toBe('conflict-1');
      expect(conflict.agents).toEqual(['agent-1', 'agent-2']);
      expect(conflict.description).toBe('Test conflict');
      expect(conflict.severity).toBe('medium');
      expect(conflict.resolution).toBe('Test resolution');
    });
  });

  describe('ConflictResolution', () => {
    it('should have correct structure', () => {
      const resolution: ConflictResolution = {
        conflicts: [],
        votes: { 'agent-1': 'agent-2', 'agent-2': 'agent-1' },
        arguments: { 'agent-1': 'arg1', 'agent-2': 'arg2' }
      };

      expect(resolution.conflicts).toEqual([]);
      expect(resolution.votes['agent-1']).toBe('agent-2');
      expect(resolution.arguments['agent-1']).toBe('arg1');
    });
  });

  describe('SynthesisAttempt', () => {
    it('should have correct structure', () => {
      const synthesis: SynthesisAttempt = {
        consensus: 0.8,
        unifiedPerspective: 'Test perspective',
        remainingDisagreements: ['disagreement1', 'disagreement2'],
        confidence: 0.9
      };

      expect(synthesis.consensus).toBe(0.8);
      expect(synthesis.unifiedPerspective).toBe('Test perspective');
      expect(synthesis.remainingDisagreements).toEqual(['disagreement1', 'disagreement2']);
      expect(synthesis.confidence).toBe(0.9);
    });
  });

  describe('IndividualThought', () => {
    it('should have correct structure', () => {
      const thought: IndividualThought = {
        agentId: 'agent-1',
        content: 'Test thought',
        summary: 'Test summary',
        reasoning: 'Test reasoning',
        assumptions: ['assumption1', 'assumption2'],
        approach: 'Test approach'
      };

      expect(thought.agentId).toBe('agent-1');
      expect(thought.content).toBe('Test thought');
      expect(thought.summary).toBe('Test summary');
      expect(thought.reasoning).toBe('Test reasoning');
      expect(thought.assumptions).toEqual(['assumption1', 'assumption2']);
      expect(thought.approach).toBe('Test approach');
    });
  });

  describe('MutualReflection', () => {
    it('should have correct structure', () => {
      const reflection: MutualReflection = {
        agentId: 'agent-1',
        content: 'Test reflection',
        summary: 'Test summary',
        reflections: [
          {
            targetAgentId: 'agent-2',
            reaction: 'Test reaction',
            agreement: true,
            questions: ['question1', 'question2']
          }
        ]
      };

      expect(reflection.agentId).toBe('agent-1');
      expect(reflection.content).toBe('Test reflection');
      expect(reflection.summary).toBe('Test summary');
      expect(reflection.reflections).toHaveLength(1);
      expect(reflection.reflections[0].targetAgentId).toBe('agent-2');
      expect(reflection.reflections[0].agreement).toBe(true);
    });
  });

  describe('DialogueLog', () => {
    it('should have correct structure', () => {
      const log: DialogueLog = {
        sessionId: 'session-1',
        timestamp: new Date(),
        query: 'Test query',
        stages: {
          stage1: [],
          stage2: [],
          stage3: {
            conflicts: [],
            votes: {},
            arguments: {}
          },
          stage4: {
            consensus: 0.8,
            unifiedPerspective: 'Test perspective',
            remainingDisagreements: ['disagreement1'],
            confidence: 0.9
          },
          stage5: {
            agentId: 'agent-1',
            content: 'Test response',
            summary: 'Test summary',
            reasoning: 'Test reasoning',
            confidence: 0.9,
            references: ['ref1'],
            stage: 'individual-thought'
          }
        },
        metadata: {
          participants: [],
          duration: 5000,
          consensusLevel: 0.8
        }
      };

      expect(log.sessionId).toBe('session-1');
      expect(log.query).toBe('Test query');
      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.metadata.duration).toBe(5000);
      expect(log.metadata.consensusLevel).toBe(0.8);
    });
  });

  describe('StageSummary', () => {
    it('should have correct structure', () => {
      const summary: StageSummary = {
        stage: 'individual-thought',
        summary: [
          { speaker: 'agent-1', position: 'Test position' },
          { speaker: 'agent-2', position: 'Test position 2' }
        ],
        timestamp: new Date(),
        stageNumber: 1,
        sequenceNumber: 1
      };

      expect(summary.stage).toBe('individual-thought');
      expect(summary.summary).toHaveLength(2);
      expect(summary.stageNumber).toBe(1);
      expect(summary.sequenceNumber).toBe(1);
    });
  });

  describe('SummaryStage', () => {
    it('should have correct structure', () => {
      const summaryStage: SummaryStage = {
        stage: 'individual-thought',
        summary: 'Test summary',
        timestamp: new Date(),
        stageNumber: 1,
        sequenceNumber: 1
      };

      expect(summaryStage.stage).toBe('individual-thought');
      expect(summaryStage.summary).toBe('Test summary');
      expect(summaryStage.stageNumber).toBe(1);
      expect(summaryStage.sequenceNumber).toBe(1);
    });
  });

  describe('StageData', () => {
    it('should have correct structure', () => {
      const stageData: StageData = {
        agentId: 'agent-1',
        content: 'Test content',
        reasoning: 'Test reasoning',
        confidence: 0.9,
        summary: 'Test summary',
        reflections: [
          {
            targetAgentId: 'agent-2',
            reaction: 'Test reaction',
            agreement: true,
            questions: ['question1']
          }
        ],
        assumptions: ['assumption1'],
        approach: 'Test approach',
        conflicts: [],
        analysis: 'Test analysis',
        resolution: 'Test resolution'
      };

      expect(stageData.agentId).toBe('agent-1');
      expect(stageData.content).toBe('Test content');
      expect(stageData.confidence).toBe(0.9);
      expect(stageData.reflections).toHaveLength(1);
      expect(stageData.assumptions).toEqual(['assumption1']);
      expect(stageData.approach).toBe('Test approach');
    });
  });

  describe('AgentInstance', () => {
    it('should have correct method signatures', () => {
      const agentInstance: AgentInstance = {
        getAgent: () => ({
          id: 'test-agent',
          name: 'Test Agent',
          furigana: 'テストエージェント',
          style: 'logical',
          priority: 'precision',
          memoryScope: 'local',
          personality: 'Test personality',
          preferences: ['test'],
          tone: 'formal',
          communicationStyle: 'direct'
        }),
        setLanguage: (language: Language) => {},
        setSessionId: (sessionId: string) => {},
        setIsSummarizer: (isSummarizer: boolean) => {},
        stage1IndividualThought: async (prompt: string, context: Message[]) => ({
          agentId: 'test-agent',
          content: 'Test response',
          stage: 'individual-thought'
        }),
        stage2MutualReflection: async (prompt: string, individualThoughts: IndividualThought[], context: Message[]) => ({
          agentId: 'test-agent',
          content: 'Test response',
          stage: 'mutual-reflection'
        }),
        stage3ConflictResolution: async (conflicts: Conflict[], context: Message[]) => ({
          agentId: 'test-agent',
          content: 'Test response',
          stage: 'conflict-resolution'
        }),
        stage4SynthesisAttempt: async (synthesisData: SynthesisData, context: Message[]) => ({
          agentId: 'test-agent',
          content: 'Test response',
          stage: 'synthesis-attempt'
        }),
        stage5OutputGeneration: async (finalData: FinalData, context: Message[]) => ({
          agentId: 'test-agent',
          content: 'Test response',
          stage: 'output-generation'
        }),
        stage5_1Finalize: async (votingResults: VotingResults, responses: AgentResponse[], context: Message[]) => ({
          agentId: 'test-agent',
          content: 'Test response',
          stage: 'finalize'
        })
      };

      expect(agentInstance.getAgent().id).toBe('test-agent');
      expect(typeof agentInstance.setLanguage).toBe('function');
      expect(typeof agentInstance.setSessionId).toBe('function');
      expect(typeof agentInstance.setIsSummarizer).toBe('function');
    });
  });

  describe('SynthesisData', () => {
    it('should have correct structure', () => {
      const synthesisData: SynthesisData = {
        query: 'Test query',
        individualThoughts: ['thought1', 'thought2'],
        mutualReflections: ['reflection1'],
        conflictResolutions: ['resolution1'],
        context: 'Test context'
      };

      expect(synthesisData.query).toBe('Test query');
      expect(synthesisData.individualThoughts).toEqual(['thought1', 'thought2']);
      expect(synthesisData.mutualReflections).toEqual(['reflection1']);
      expect(synthesisData.conflictResolutions).toEqual(['resolution1']);
      expect(synthesisData.context).toBe('Test context');
    });
  });

  describe('FinalData', () => {
    it('should have correct structure', () => {
      const finalData: FinalData = {
        query: 'Test query',
        finalData: {
          individualThoughts: ['thought1'],
          mutualReflections: ['reflection1'],
          conflictResolutions: ['resolution1'],
          synthesisAttempts: ['synthesis1']
        },
        context: 'Test context'
      };

      expect(finalData.query).toBe('Test query');
      expect(finalData.finalData.individualThoughts).toEqual(['thought1']);
      expect(finalData.finalData.mutualReflections).toEqual(['reflection1']);
      expect(finalData.finalData.conflictResolutions).toEqual(['resolution1']);
      expect(finalData.finalData.synthesisAttempts).toEqual(['synthesis1']);
      expect(finalData.context).toBe('Test context');
    });
  });

  describe('VotingResults', () => {
    it('should have correct structure', () => {
      const votingResults: VotingResults = {
        'agent-1': 'agent-2',
        'agent-2': 'agent-1',
        'agent-3': 'agent-1'
      };

      expect(votingResults['agent-1']).toBe('agent-2');
      expect(votingResults['agent-2']).toBe('agent-1');
      expect(votingResults['agent-3']).toBe('agent-1');
    });
  });

  describe('StageSummarizerOptions', () => {
    it('should have correct structure', () => {
      const options: StageSummarizerOptions = {
        language: 'en',
        maxSummaryLength: 1000,
        includeConfidence: true
      };

      expect(options.language).toBe('en');
      expect(options.maxSummaryLength).toBe(1000);
      expect(options.includeConfidence).toBe(true);
    });

    it('should allow optional properties', () => {
      const options: StageSummarizerOptions = {};

      expect(options.language).toBeUndefined();
      expect(options.maxSummaryLength).toBeUndefined();
      expect(options.includeConfidence).toBeUndefined();
    });
  });

  describe('DelayOptions', () => {
    it('should have correct structure', () => {
      const options: DelayOptions = {
        agentResponseDelayMS: 15000,
        stageSummarizerDelayMS: 45000,
        finalSummaryDelayMS: 90000,
        defaultDelayMS: 15000
      };

      expect(options.agentResponseDelayMS).toBe(15000);
      expect(options.stageSummarizerDelayMS).toBe(45000);
      expect(options.finalSummaryDelayMS).toBe(90000);
      expect(options.defaultDelayMS).toBe(15000);
    });

    it('should allow optional properties', () => {
      const options: DelayOptions = {};

      expect(options.agentResponseDelayMS).toBeUndefined();
      expect(options.stageSummarizerDelayMS).toBeUndefined();
      expect(options.finalSummaryDelayMS).toBeUndefined();
      expect(options.defaultDelayMS).toBeUndefined();
    });
  });

  describe('ProgressCallback', () => {
    it('should be a function type', () => {
      const callback: ProgressCallback = (update: { message?: Message; session?: Session }) => {
        if (update.message) {
          console.log(update.message.content);
        }
      };

      expect(typeof callback).toBe('function');
    });
  });

  describe('StageExecutionResult', () => {
    it('should have correct structure', () => {
      const result: StageExecutionResult = {
        stage: 'individual-thought',
        agentResponses: [],
        duration: 5000
      };

      expect(result.stage).toBe('individual-thought');
      expect(result.agentResponses).toEqual([]);
      expect(result.duration).toBe(5000);
    });
  });

  describe('SummaryExecutionResult', () => {
    it('should have correct structure', () => {
      const result: SummaryExecutionResult = {
        responses: []
      };

      expect(result.responses).toEqual([]);
    });
  });

  describe('FinalizeExecutionResult', () => {
    it('should have correct structure', () => {
      const result: FinalizeExecutionResult = {
        responses: []
      };

      expect(result.responses).toEqual([]);
    });
  });

  describe('ConflictDescriptionTemplates', () => {
    it('should have correct structure', () => {
      const templates: ConflictDescriptionTemplates = {
        diversePerspectives: 'Test diverse perspectives',
        agentApproaches: 'Test agent approaches',
        approachAnalysis: 'Test approach analysis',
        potentialConflicts: 'Test potential conflicts',
        mutualUnderstanding: 'Test mutual understanding',
        complementarySolutions: 'Test complementary solutions',
        conflictDetails: 'Test conflict details',
        rootCauseAnalysis: 'Test root cause analysis',
        resolutionDirection: 'Test resolution direction',
        discussionFocus: 'Test discussion focus',
        understandingDifferences: 'Test understanding differences',
        conceptualTensions: 'Test conceptual tensions',
        valueConflicts: 'Test value conflicts',
        ideaContradictions: 'Test idea contradictions',
        synthesisOpportunities: 'Test synthesis opportunities',
        frameworkIntegration: 'Test framework integration',
        conceptualResolution: 'Test conceptual resolution',
        ideaSynthesis: 'Test idea synthesis',
        perspectiveIntegration: 'Test perspective integration',
        coreInsights: 'Test core insights',
        fundamentalQuestions: 'Test fundamental questions',
        emergingDirections: 'Test emerging directions',
        unresolvedTensions: 'Test unresolved tensions',
        synthesisPossibilities: 'Test synthesis possibilities',
        multiplePerspectives: 'Test multiple perspectives',
        noSignificantConflicts: 'Test no significant conflicts'
      };

      expect(templates.diversePerspectives).toBe('Test diverse perspectives');
      expect(templates.agentApproaches).toBe('Test agent approaches');
      expect(templates.noSignificantConflicts).toBe('Test no significant conflicts');
    });
  });

  describe('ApproachAnalysis', () => {
    it('should have correct structure', () => {
      const analysis: ApproachAnalysis = {
        agentId: 'agent-1',
        approach: 'Test approach',
        style: 'logical'
      };

      expect(analysis.agentId).toBe('agent-1');
      expect(analysis.approach).toBe('Test approach');
      expect(analysis.style).toBe('logical');
    });
  });

  describe('PotentialConflict', () => {
    it('should have correct structure', () => {
      const conflict: PotentialConflict = {
        type: 'Test type',
        description: 'Test description',
        agents: ['agent-1', 'agent-2']
      };

      expect(conflict.type).toBe('Test type');
      expect(conflict.description).toBe('Test description');
      expect(conflict.agents).toEqual(['agent-1', 'agent-2']);
    });
  });

  describe('Language', () => {
    it('should accept valid languages', () => {
      const languages: Language[] = ['en', 'ja'];

      expect(languages).toContain('en');
      expect(languages).toContain('ja');
    });
  });
}); 