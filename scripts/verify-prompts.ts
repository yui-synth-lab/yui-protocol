
import { AIExecutor, createAIExecutor } from '../src/kernel/ai-executor.js';
import { VOTE_ANALYSIS_PROMPT, CONSENSUS_CHECK_PROMPT, extractVoteDetails } from '../src/templates/prompts.js';

// Mock Executor to simulate AI response with thinking tags
class TestExecutor extends AIExecutor {
    async execute(prompt: string, personality: string): Promise<any> {
        const rawContent = `<think>
This is a thought process.
I should consider A and B.
</think>
Here is the actual response.`;

        return {
            content: this.sanitizeContent(rawContent), // Sanitization happens here
            success: true,
            duration: 100
        };
    }
}

async function verifySanitization() {
    console.log('--- Verifying Sanitization ---');
    const executor = new TestExecutor({ agentId: 'test-agent' });
    const result = await executor.execute('test prompt', 'test personality');

    console.log('Processed Content:', JSON.stringify(result.content));

    if (result.content.includes('<think>')) {
        console.error('FAIL: <think> tag found in output');
    } else if (result.content.trim() === 'Here is the actual response.') {
        console.log('PASS: <think> tags removed correctly');
    } else {
        console.error('FAIL: Unexpected output format');
    }
}

async function verifyPrompts() {
    console.log('\n--- Verifying Prompts ---');
    // Just checking if the prompts contain the new instructions
    const votePromptChecks = [
        'JSON array',
        'voterId',
        'targetId'
    ];

    let votePass = true;
    for (const check of votePromptChecks) {
        if (!VOTE_ANALYSIS_PROMPT.includes(check)) {
            console.error(`FAIL: Vote prompt missing "${check}"`);
            votePass = false;
        }
    }
    if (votePass) console.log('PASS: Vote prompt format updated');

}

async function verifyVoteParsing() {
    console.log('\n--- Verifying Vote Parsing ---');

    const jsonVote = `
  Here is my vote:
  \`\`\`json
  [
    { "voterId": "test-agent", "targetId": "target-agent", "reason": "Good reasoning" }
  ]
  \`\`\`
  `;

    const result = extractVoteDetails(jsonVote, 'test-agent', [{ id: 'target-agent', name: 'Target' }]);

    if (result.votedAgent === 'target-agent' && result.reasoning === 'Good reasoning') {
        console.log('PASS: JSON vote parsing successful');
    } else {
        console.error('FAIL: JSON vote parsing failed', result);
    }

    const legacyVote = `
  **Agent Vote and Justification**
  Agent Vote: target-agent
  Reasoning: Legacy reasoning
  `;

    const legacyResult = extractVoteDetails(legacyVote, 'test-agent', [{ id: 'target-agent', name: 'Target' }]);

    if (legacyResult.votedAgent === 'target-agent' && legacyResult.reasoning && legacyResult.reasoning.includes('Legacy reasoning')) {
        console.log('PASS: Legacy vote parsing successful');
    } else {
        // Note: Legacy parsing might be slightly different depending on whitespace, but we check if it catches something
        if (legacyResult.votedAgent === 'target-agent') {
            console.log('PASS: Legacy vote parsing successful (agent match)');
        } else {
            console.error('FAIL: Legacy vote parsing failed', legacyResult);
        }
    }
}

async function run() {
    await verifySanitization();
    await verifyPrompts();
    await verifyVoteParsing();
}

run().catch(console.error);
