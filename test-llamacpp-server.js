/**
 * llama.cpp Server Test Script
 *
 * Tests the llama-server integration with OpenAI-compatible API
 *
 * Prerequisites:
 * 1. Start llama-server with: llama-server -m <model_path> --port 8080
 * 2. Configure .env with LLAMACPP_BASE_URL and LLAMACPP_MODEL_NAME
 *
 * Usage:
 *   node test-llamacpp-server.js
 */

import dotenv from 'dotenv';
import { createAIExecutor } from './dist/kernel/ai-executor.js';

dotenv.config();

const LLAMACPP_BASE_URL = process.env.LLAMACPP_BASE_URL || 'http://localhost:8080';
const LLAMACPP_MODEL_NAME = process.env.LLAMACPP_MODEL_NAME || 'local-model';

console.log('='.repeat(80));
console.log('llama.cpp Server Test');
console.log('='.repeat(80));
console.log(`Server URL: ${LLAMACPP_BASE_URL}`);
console.log(`Model Name: ${LLAMACPP_MODEL_NAME}`);
console.log('='.repeat(80));
console.log('');

async function testLlamaCppServer() {
  try {
    console.log('Creating llamacpp executor...');
    const executor = await createAIExecutor('test-llamacpp', {
      provider: 'llamacpp',
      model: LLAMACPP_MODEL_NAME,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 500,
      customConfig: {
        baseUrl: LLAMACPP_BASE_URL
      }
    });

    console.log('✓ Executor created successfully\n');

    // Test 1: Simple prompt without personality
    console.log('Test 1: Simple prompt (no personality)');
    console.log('-'.repeat(80));
    const prompt1 = 'What is the capital of France? Answer in one sentence.';
    console.log(`Prompt: ${prompt1}`);
    console.log('Executing...\n');

    const result1 = await executor.execute(prompt1, '');

    if (result1.success) {
      console.log('✓ Test 1 PASSED');
      console.log(`Response: ${result1.content}`);
      console.log(`Duration: ${result1.duration}ms`);
      console.log(`Tokens used: ${result1.tokensUsed || 'N/A'}`);
    } else {
      console.log('✗ Test 1 FAILED');
      console.log(`Error: ${result1.error}`);
      if (result1.errorDetails) {
        console.log(`Details: ${JSON.stringify(result1.errorDetails, null, 2)}`);
      }
    }

    console.log('\n');

    // Test 2: Prompt with personality
    console.log('Test 2: Prompt with personality');
    console.log('-'.repeat(80));
    const personality = 'You are a helpful and concise assistant. Always answer briefly and clearly.';
    const prompt2 = 'Explain what AI is in simple terms.';
    console.log(`Personality: ${personality}`);
    console.log(`Prompt: ${prompt2}`);
    console.log('Executing...\n');

    const result2 = await executor.execute(prompt2, personality);

    if (result2.success) {
      console.log('✓ Test 2 PASSED');
      console.log(`Response: ${result2.content}`);
      console.log(`Duration: ${result2.duration}ms`);
      console.log(`Tokens used: ${result2.tokensUsed || 'N/A'}`);
    } else {
      console.log('✗ Test 2 FAILED');
      console.log(`Error: ${result2.error}`);
      if (result2.errorDetails) {
        console.log(`Details: ${JSON.stringify(result2.errorDetails, null, 2)}`);
      }
    }

    console.log('\n');

    // Test 3: Longer conversation-style prompt
    console.log('Test 3: Conversation-style prompt');
    console.log('-'.repeat(80));
    const prompt3 = 'Tell me a very short story about a robot learning to paint. Keep it under 100 words.';
    console.log(`Prompt: ${prompt3}`);
    console.log('Executing...\n');

    const result3 = await executor.execute(prompt3, '');

    if (result3.success) {
      console.log('✓ Test 3 PASSED');
      console.log(`Response: ${result3.content}`);
      console.log(`Duration: ${result3.duration}ms`);
      console.log(`Tokens used: ${result3.tokensUsed || 'N/A'}`);
    } else {
      console.log('✗ Test 3 FAILED');
      console.log(`Error: ${result3.error}`);
      if (result3.errorDetails) {
        console.log(`Details: ${JSON.stringify(result3.errorDetails, null, 2)}`);
      }
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('Test Summary');
    console.log('='.repeat(80));

    const allPassed = result1.success && result2.success && result3.success;
    if (allPassed) {
      console.log('✓ All tests PASSED!');
      console.log('\nYour llama.cpp server integration is working correctly.');
    } else {
      console.log('✗ Some tests FAILED');
      console.log('\nPlease check:');
      console.log('1. llama-server is running on the correct port');
      console.log('2. LLAMACPP_BASE_URL is configured correctly in .env');
      console.log('3. The model is loaded properly in llama-server');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ CRITICAL ERROR');
    console.error('='.repeat(80));
    console.error(error);
    console.error('\nPossible causes:');
    console.error('1. llama-server is not running');
    console.error('2. Connection refused - check if port 8080 is accessible');
    console.error('3. Model not loaded in llama-server');
    console.error('\nTo start llama-server:');
    console.error('  llama-server -m /path/to/model.gguf --port 8080');
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run the test
testLlamaCppServer();
