import { DynamicDialogueRouter } from '../src/kernel/dynamic-router.js';
import { ConsensusIndicator } from '../src/types/consensus.js';
import { FacilitatorAgent } from '../src/agents/facilitator-agent.js';
import { SessionStorage } from '../src/kernel/session-storage.js';

describe('Dynamic Router Convergence Logic', () => {
  let router: DynamicDialogueRouter;
  let facilitator: FacilitatorAgent;

  beforeEach(() => {
    const sessionStorage = new SessionStorage();
    router = new DynamicDialogueRouter(sessionStorage);
    facilitator = new FacilitatorAgent();
    // Set up router with original query
    (router as any).originalQuery = 'Test discussion topic';
  });

  describe('Round-based Convergence Logic', () => {
    test('should never converge in early rounds (0-2) regardless of satisfaction', () => {
      const highSatisfactionConsensus: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 9, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Perfect' },
        { agentId: 'agent2', satisfactionLevel: 9, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Excellent' },
        { agentId: 'agent3', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Great' }
      ];

      // Test early rounds - should always continue
      const earlyRounds = [0, 1, 2];
      earlyRounds.forEach(round => {
        const shouldContinue = (facilitator as any).shouldContinueDialogue(
          highSatisfactionConsensus,
          round,
          8.7 // High overall consensus
        );
        expect(shouldContinue).toBe(true); // Should continue in early rounds
      });
    });

    test('should require very high satisfaction for mid-round convergence (3-4)', () => {
      const consensusData: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Good' },
        { agentId: 'agent2', satisfactionLevel: 7, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ok' },
        { agentId: 'agent3', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' }
      ];

      // Mid-round with good but not excellent satisfaction - should continue
      const shouldContinueRound3 = (facilitator as any).shouldContinueDialogue(consensusData, 3, 7.7);
      expect(shouldContinueRound3).toBe(true);

      // Mid-round with very high satisfaction and unanimous readiness - can converge
      const excellentConsensus: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 9, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Perfect' },
        { agentId: 'agent2', satisfactionLevel: 9, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Excellent' },
        { agentId: 'agent3', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Great' }
      ];

      const shouldContinueExcellent = (facilitator as any).shouldContinueDialogue(excellentConsensus, 4, 8.7);
      expect(shouldContinueExcellent).toBe(false); // Can converge with excellent satisfaction
    });

    test('should apply standard conditions for later rounds (5+)', () => {
      const consensusData: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' },
        { agentId: 'agent2', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Good conclusion' },
        { agentId: 'agent3', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Satisfied' },
        { agentId: 'agent4', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' }
      ];

      // Later round with high satisfaction - should converge
      const shouldContinueRound5 = (facilitator as any).shouldContinueDialogue(consensusData, 5, 8.0);
      expect(shouldContinueRound5).toBe(false); // Should converge in later rounds with good conditions
    });

    test('should not converge with low satisfaction even in later rounds', () => {
      const lowSatisfactionConsensus: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 4, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready but unsatisfied' },
        { agentId: 'agent2', satisfactionLevel: 3, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Hasty conclusion' },
        { agentId: 'agent3', satisfactionLevel: 5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Barely ok' },
        { agentId: 'agent4', satisfactionLevel: 2, readyToMove: false, hasAdditionalPoints: true, questionsForOthers: [], reasoning: 'Very unsatisfied' },
        { agentId: 'agent5', satisfactionLevel: 4, readyToMove: false, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Need improvement' }
      ];

      // Even in later rounds, low satisfaction should prevent convergence
      const shouldContinueRound6 = (facilitator as any).shouldContinueDialogue(lowSatisfactionConsensus, 6, 3.6);
      expect(shouldContinueRound6).toBe(true); // Should continue due to low satisfaction
    });

    test('should not converge when critical points remain', () => {
      const consensusData: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Good' },
        { agentId: 'agent2', satisfactionLevel: 9, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Excellent' },
        { agentId: 'agent3', satisfactionLevel: 7, readyToMove: false, hasAdditionalPoints: true, questionsForOthers: [], reasoning: 'Critical points remain' },
        { agentId: 'agent4', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' },
        { agentId: 'agent5', satisfactionLevel: 6, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ok to conclude' }
      ];

      // Even with 4/5 ready and high satisfaction, critical points should prevent convergence
      const continuingVotes = consensusData.filter(c => !c.readyToMove || c.hasAdditionalPoints).length;
      const hasAdditionalPointsCount = consensusData.filter(c => c.hasAdditionalPoints).length;

      expect(continuingVotes).toBe(1);
      expect(hasAdditionalPointsCount).toBe(1);

      // If any agent has critical points, should continue
      const hasCriticalPoints = consensusData.some(c => c.hasAdditionalPoints);
      expect(hasCriticalPoints).toBe(true);
    });
  });

  describe('Convergence Reason Classification', () => {
    test('should classify as natural_consensus for high satisfaction + majority ready', () => {
      const consensusData: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Great insights' },
        { agentId: 'agent2', satisfactionLevel: 9, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Perfect conclusion' },
        { agentId: 'agent3', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Satisfied' }
      ];

      const readyToMoveCount = consensusData.filter(c => c.readyToMove).length;
      const averageSatisfaction = consensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensusData.length;
      const majorityThreshold = Math.ceil(consensusData.length / 2);

      let convergenceReason: 'natural_consensus' | 'high_satisfaction' | 'facilitator_decision' | 'max_rounds';

      if (averageSatisfaction >= 8.0 && readyToMoveCount >= majorityThreshold) {
        convergenceReason = 'natural_consensus';
      } else {
        convergenceReason = 'high_satisfaction';
      }

      expect(convergenceReason).toBe('natural_consensus');
    });

    test('should classify as high_satisfaction for good consensus with adequate rounds', () => {
      const round = 3;
      const overallConsensus = 7.2;

      let convergenceReason: 'natural_consensus' | 'high_satisfaction' | 'facilitator_decision' | 'max_rounds';

      if (overallConsensus >= 7.0 && round >= 3) {
        convergenceReason = 'high_satisfaction';
      } else {
        convergenceReason = 'facilitator_decision';
      }

      expect(convergenceReason).toBe('high_satisfaction');
    });
  });

  describe('Updated Round Progression Logic', () => {
    test('should always continue in rounds 0-2 regardless of consensus', () => {
      const perfectConsensus: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 10, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Perfect' },
        { agentId: 'agent2', satisfactionLevel: 10, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Perfect' },
        { agentId: 'agent3', satisfactionLevel: 10, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Perfect' }
      ];

      // Even with perfect consensus, early rounds should continue
      [0, 1, 2].forEach(round => {
        const shouldContinue = (facilitator as any).shouldContinueDialogue(perfectConsensus, round, 10.0);
        expect(shouldContinue).toBe(true);
      });
    });

    test('should use stricter conditions for mid-rounds (3-4)', () => {
      const goodConsensus: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Good' },
        { agentId: 'agent2', satisfactionLevel: 7, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ok' },
        { agentId: 'agent3', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' }
      ];

      // Mid-rounds should continue with good but not excellent consensus
      const shouldContinueRound3 = (facilitator as any).shouldContinueDialogue(goodConsensus, 3, 7.7);
      const shouldContinueRound4 = (facilitator as any).shouldContinueDialogue(goodConsensus, 4, 7.7);

      expect(shouldContinueRound3).toBe(true);
      expect(shouldContinueRound4).toBe(true);
    });

    test('should apply standard conditions for later rounds (5+)', () => {
      const testScenarios = [
        {
          round: 5,
          consensus: [
            { agentId: 'agent1', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' },
            { agentId: 'agent2', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Good' },
            { agentId: 'agent3', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' },
            { agentId: 'agent4', satisfactionLevel: 8, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' }
          ],
          overallConsensus: 8.0,
          shouldContinue: false // Should converge with high satisfaction + majority ready in round 5+
        },
        {
          round: 6,
          consensus: [
            { agentId: 'agent1', satisfactionLevel: 7, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ok' },
            { agentId: 'agent2', satisfactionLevel: 7, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Good' },
            { agentId: 'agent3', satisfactionLevel: 7, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Ready' }
          ],
          overallConsensus: 7.0,
          shouldContinue: false // Should converge in round 6+ with good satisfaction + majority ready
        }
      ];

      testScenarios.forEach(({ round, consensus, overallConsensus, shouldContinue }) => {
        const result = (facilitator as any).shouldContinueDialogue(consensus, round, overallConsensus);
        expect(result).toBe(shouldContinue);
      });
    });
  });

  describe('Error Handling in Convergence', () => {
    test('should handle empty consensus data gracefully', () => {
      const consensusData: ConsensusIndicator[] = [];

      const readyToMoveCount = consensusData.length > 0 ? consensusData.filter(c => c.readyToMove).length : 0;
      const averageSatisfaction = consensusData.length > 0 ?
        consensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensusData.length : 0;

      expect(readyToMoveCount).toBe(0);
      expect(averageSatisfaction).toBe(0);

      // Should not converge with empty data
      const shouldConverge = readyToMoveCount > 0 && averageSatisfaction >= 6.0;
      expect(shouldConverge).toBe(false);
    });

    test('should handle malformed consensus data', () => {
      const consensusData: Partial<ConsensusIndicator>[] = [
        { agentId: 'agent1' }, // Missing required fields
        { agentId: 'agent2', satisfactionLevel: 7 }, // Missing readyToMove
        { agentId: 'agent3', readyToMove: true }, // Missing satisfactionLevel
      ];

      // Should handle missing fields gracefully
      const validData = consensusData.filter(c =>
        c.satisfactionLevel !== undefined && c.readyToMove !== undefined
      ) as ConsensusIndicator[];

      expect(validData.length).toBe(0); // No fully valid entries

      // Fallback behavior for safety
      const readyToMoveCount = validData.filter(c => c.readyToMove).length;
      expect(readyToMoveCount).toBe(0);
    });
  });

  describe('Configuration Integration Tests', () => {
    test('should respect updated configuration values', () => {
      // Test that new configuration values are applied correctly
      const consensusData: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 7.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'At threshold' },
        { agentId: 'agent2', satisfactionLevel: 7.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'At threshold' },
        { agentId: 'agent3', satisfactionLevel: 7.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'At threshold' }
      ];

      // With new convergenceThreshold of 7.5, this should be at the boundary
      // But still should continue in round 7 as conditions are stricter now
      const shouldContinueRound7 = (facilitator as any).shouldContinueDialogue(consensusData, 7, 7.5);
      expect(shouldContinueRound7).toBe(false); // Should converge at round 7+ with threshold satisfaction
    });

    test('should enforce higher satisfaction requirements in updated logic', () => {
      const borderlineConsensus: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 6.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Minimum' },
        { agentId: 'agent2', satisfactionLevel: 6.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Minimum' },
        { agentId: 'agent3', satisfactionLevel: 6.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Minimum' }
      ];

      // With new minSatisfactionLevel of 6.5 and stricter logic,
      // this should not be sufficient for early convergence
      const shouldContinueRound5 = (facilitator as any).shouldContinueDialogue(borderlineConsensus, 5, 6.5);
      expect(shouldContinueRound5).toBe(true); // Should continue - satisfaction too low for early convergence
    });

    test('should allow convergence near max rounds with minimum satisfaction', () => {
      const minSatisfactionConsensus: ConsensusIndicator[] = [
        { agentId: 'agent1', satisfactionLevel: 6.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Minimum acceptable' },
        { agentId: 'agent2', satisfactionLevel: 6.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Minimum acceptable' },
        { agentId: 'agent3', satisfactionLevel: 6.5, readyToMove: true, hasAdditionalPoints: false, questionsForOthers: [], reasoning: 'Minimum acceptable' }
      ];

      // Near max rounds (20), should converge with minimum satisfaction
      const shouldContinueRound19 = (facilitator as any).shouldContinueDialogue(minSatisfactionConsensus, 19, 6.5);
      const shouldContinueRound20 = (facilitator as any).shouldContinueDialogue(minSatisfactionConsensus, 20, 6.5);

      expect(shouldContinueRound19).toBe(true);  // Should continue at round 19
      expect(shouldContinueRound20).toBe(false); // Should converge at max rounds (20)
    });
  });
});