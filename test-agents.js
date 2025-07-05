import { AgentManager } from './src/kernel/services/agent-manager.js';
import { InteractionLogger } from './src/kernel/interaction-logger.js';

async function testAgentInitialization() {
  console.log('Testing agent initialization...');
  
  const interactionLogger = new InteractionLogger();
  const agentManager = new AgentManager(interactionLogger);
  
  console.log('Initializing agents...');
  agentManager.initializeAgents();
  
  console.log('Getting available agents...');
  const agents = agentManager.getAvailableAgents();
  
  console.log(`Found ${agents.length} agents:`);
  agents.forEach(agent => {
    console.log(`- ${agent.name} (${agent.id}): ${agent.personality}`);
  });
  
  // Test getting specific agents
  const yuiAgent = agentManager.getAgent('yui-000');
  const yogaAgent = agentManager.getAgent('yoga-001');
  
  console.log('\nTesting specific agents:');
  console.log('Yui agent:', yuiAgent ? 'Found' : 'Not found');
  console.log('Yoga agent:', yogaAgent ? 'Found' : 'Not found');
}

testAgentInitialization().catch(console.error); 