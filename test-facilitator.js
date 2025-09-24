// Simple test script for the silent facilitator system

import { FacilitatorAgent } from './src/agents/facilitator-agent.js';

async function testSilentFacilitator() {
  console.log('🎭 Testing Silent Facilitator System');

  // Create a test facilitator
  const facilitator = new FacilitatorAgent('test-session-001');

  // Mock message data
  const mockMessages = [
    { agentId: 'eiro-001', content: 'This is a logical analysis of the problem. We need to consider multiple factors.', role: 'agent' },
    { agentId: 'eiro-001', content: 'Building on my previous point, I believe the solution lies in systematic approach.', role: 'agent' },
    { agentId: 'eiro-001', content: 'Furthermore, we should examine the underlying assumptions.', role: 'agent' },
    { agentId: 'yui-000', content: 'I feel there\'s more to this than logic alone can reveal.', role: 'agent' },
    { agentId: 'user', content: 'What is the meaning of life?', role: 'user' }
  ];

  console.log('\n📊 Testing participation balance detection:');
  const silentAdjustments = facilitator.performSilentAdjustments(mockMessages, 1, 'What is the meaning of life?');
  console.log('Facilitator Action:', silentAdjustments.facilitator_action);
  console.log('Participation Balance:', silentAdjustments.participation_balance);
  console.log('Dominant Speakers:', silentAdjustments.dominant_speakers);
  console.log('Silent Agents:', silentAdjustments.silent_agents);
  console.log('Word Count Adjustments:', silentAdjustments.word_count_adjustments);

  console.log('\n📏 Testing word count guidance:');
  const guidance = facilitator.createWordCountGuidance('eiro-001', silentAdjustments.dominant_speakers, silentAdjustments.silent_agents);
  console.log('Guidance for eiro-001:', guidance);

  const guidance2 = facilitator.createWordCountGuidance('yoga-001', silentAdjustments.dominant_speakers, silentAdjustments.silent_agents);
  console.log('Guidance for yoga-001:', guidance2);

  console.log('\n🔄 Testing topic shift detection:');
  const topicShiftMessages = [
    { agentId: 'eiro-001', content: 'We should analyze quantum mechanics and particle physics.', role: 'agent' },
    { agentId: 'yui-000', content: 'Quantum entanglement is fascinating from a scientific perspective.', role: 'agent' },
    { agentId: 'hekito-001', content: 'The wave-particle duality suggests complex underlying reality.', role: 'agent' },
    { agentId: 'yoga-001', content: 'I love cooking pasta with fresh tomatoes.', role: 'agent' },
    { agentId: 'kanshi-001', content: 'The best recipes come from Italian grandmothers.', role: 'agent' },
    { agentId: 'eiro-001', content: 'Culinary traditions reflect cultural heritage.', role: 'agent' }
  ];

  // Test topic shift (should be detected when conversation shifts from quantum physics to cooking)
  console.log('Topic shift detected:', facilitator.detectTopicShift ? facilitator.detectTopicShift(topicShiftMessages) : 'Not available in current version');

  console.log('\n✅ Silent Facilitator Test Complete');
  console.log('\nThe facilitator never speaks directly but influences:');
  console.log('  • 150-200 word count per response');
  console.log('  • Balanced participation across all 5 agents');
  console.log('  • Topic shift detection and logging');
  console.log('  • Question/metaphor ending prompts');
  console.log('  • Silent action logging in metadata');
}

// Run the test
testSilentFacilitator().catch(console.error);