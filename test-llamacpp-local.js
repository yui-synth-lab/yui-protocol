/**
 * llama.cpp Local Execution Test Script
 *
 * Tests direct GGUF model loading with node-llama-cpp
 *
 * Prerequisites:
 * 1. Download a GGUF model file (e.g., llama-3.3-70b-instruct-q4_k_m.gguf)
 * 2. Configure .env with LLAMACPP_MODEL_PATH pointing to your .gguf file
 * 3. Optionally configure LLAMACPP_CONTEXT_SIZE and LLAMACPP_GPU_LAYERS
 *
 * Usage:
 *   node test-llamacpp-local.js
 */

import dotenv from 'dotenv';
import { createAIExecutor } from './dist/kernel/ai-executor.js';
import { existsSync } from 'fs';

dotenv.config();

const LLAMACPP_MODEL_PATH = process.env.LLAMACPP_MODEL_PATH || '';
const LLAMACPP_CONTEXT_SIZE = parseInt(process.env.LLAMACPP_CONTEXT_SIZE || '4096', 10);
const LLAMACPP_GPU_LAYERS = parseInt(process.env.LLAMACPP_GPU_LAYERS || '0', 10);

console.log('='.repeat(80));
console.log('llama.cpp Local Execution Test');
console.log('='.repeat(80));
console.log(`Model Path: ${LLAMACPP_MODEL_PATH || 'NOT SET'}`);
console.log(`Context Size: ${LLAMACPP_CONTEXT_SIZE}`);
console.log(`GPU Layers: ${LLAMACPP_GPU_LAYERS} (0 = CPU only, -1 = all layers)`);
console.log('='.repeat(80));
console.log('');

// Validate model path
if (!LLAMACPP_MODEL_PATH) {
  console.error('✗ ERROR: LLAMACPP_MODEL_PATH is not set in .env');
  console.error('\nPlease configure .env with:');
  console.error('  LLAMACPP_MODEL_PATH=C:/path/to/your/model.gguf');
  console.error('\nExample:');
  console.error('  LLAMACPP_MODEL_PATH=C:/models/llama-3.3-70b-instruct-q4_k_m.gguf');
  process.exit(1);
}

if (!existsSync(LLAMACPP_MODEL_PATH)) {
  console.error(`✗ ERROR: Model file not found at: ${LLAMACPP_MODEL_PATH}`);
  console.error('\nPlease check:');
  console.error('1. The file path is correct');
  console.error('2. The file exists and is accessible');
  console.error('3. The path uses the correct format for your OS');
  process.exit(1);
}

console.log('✓ Model file found');
console.log('');

async function testLlamaCppLocal() {
  try {
    console.log('Creating llamacpp-local executor...');
    console.log('⚠️  This may take a while on first run (loading model into memory)');
    console.log('');

    const executor = await createAIExecutor('test-llamacpp-local', {
      provider: 'llamacpp-local',
      model: 'local-gguf-model',
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 500,
      customConfig: {
        modelPath: LLAMACPP_MODEL_PATH,
        contextSize: LLAMACPP_CONTEXT_SIZE,
        gpuLayers: LLAMACPP_GPU_LAYERS
      }
    });

    console.log('✓ Executor created successfully');
    console.log('ℹ️  Model will be loaded on first execution');
    console.log('');

    // Test 1: Simple prompt without personality
    console.log('Test 1: Simple prompt (no personality)');
    console.log('-'.repeat(80));
    const prompt1 = 'What is 2+2? Answer in one sentence.';
    console.log(`Prompt: ${prompt1}`);
    console.log('Executing... (model loading may take 10-60 seconds)');
    console.log('');

    const startTime1 = Date.now();
    const result1 = await executor.execute(prompt1, '');
    const totalTime1 = Date.now() - startTime1;

    if (result1.success) {
      console.log('✓ Test 1 PASSED');
      console.log(`Response: ${result1.content}`);
      console.log(`Model execution time: ${result1.duration}ms`);
      console.log(`Total time (including loading): ${totalTime1}ms`);
    } else {
      console.log('✗ Test 1 FAILED');
      console.log(`Error: ${result1.error}`);
      if (result1.errorDetails) {
        console.log(`Details: ${JSON.stringify(result1.errorDetails, null, 2)}`);
      }
      throw new Error('Test 1 failed');
    }

    console.log('\n');

    // Test 2: Prompt with personality (should be faster as model is already loaded)
    console.log('Test 2: Prompt with personality');
    console.log('-'.repeat(80));
    const personality = 'You are a helpful and concise assistant. Always answer briefly and clearly.';
    const prompt2 = 'What is AI? Answer in one short sentence.';
    console.log(`Personality: ${personality}`);
    console.log(`Prompt: ${prompt2}`);
    console.log('Executing... (should be faster now)');
    console.log('');

    const result2 = await executor.execute(prompt2, personality);

    if (result2.success) {
      console.log('✓ Test 2 PASSED');
      console.log(`Response: ${result2.content}`);
      console.log(`Duration: ${result2.duration}ms`);
    } else {
      console.log('✗ Test 2 FAILED');
      console.log(`Error: ${result2.error}`);
      if (result2.errorDetails) {
        console.log(`Details: ${JSON.stringify(result2.errorDetails, null, 2)}`);
      }
      throw new Error('Test 2 failed');
    }

    console.log('\n');

    // Test 3: Japanese prompt (if model supports it)
    console.log('Test 3: Japanese prompt');
    console.log('-'.repeat(80));
    const prompt3 = '日本の首都はどこですか？一文で答えてください。';
    console.log(`Prompt: ${prompt3}`);
    console.log('Executing...');
    console.log('');

    const result3 = await executor.execute(prompt3, '');

    if (result3.success) {
      console.log('✓ Test 3 PASSED');
      console.log(`Response: ${result3.content}`);
      console.log(`Duration: ${result3.duration}ms`);
    } else {
      console.log('✗ Test 3 FAILED (may not support Japanese)');
      console.log(`Error: ${result3.error}`);
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('Test Summary');
    console.log('='.repeat(80));

    const criticalPassed = result1.success && result2.success;
    if (criticalPassed) {
      console.log('✓ All critical tests PASSED!');
      console.log('\nYour llama.cpp local execution is working correctly.');
      console.log('\nPerformance Tips:');
      console.log('1. Use GPU acceleration by setting LLAMACPP_GPU_LAYERS > 0');
      console.log('2. Reduce LLAMACPP_CONTEXT_SIZE if you run out of memory');
      console.log('3. Use quantized models (Q4, Q5) for better performance');
      console.log('4. Model stays loaded in memory between calls (faster 2nd+ calls)');
    } else {
      console.log('✗ Critical tests FAILED');
      console.log('\nPlease check:');
      console.log('1. Model file is a valid GGUF format');
      console.log('2. Enough RAM/VRAM available for the model');
      console.log('3. LLAMACPP_CONTEXT_SIZE is not too large');
    }

    console.log('\n');
    console.log('Model Information:');
    console.log(`- Path: ${LLAMACPP_MODEL_PATH}`);
    console.log(`- Context Size: ${LLAMACPP_CONTEXT_SIZE} tokens`);
    console.log(`- GPU Layers: ${LLAMACPP_GPU_LAYERS}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ CRITICAL ERROR');
    console.error('='.repeat(80));
    console.error(error);
    console.error('\nPossible causes:');
    console.error('1. Invalid GGUF file format');
    console.error('2. Out of memory - try reducing LLAMACPP_CONTEXT_SIZE or LLAMACPP_GPU_LAYERS');
    console.error('3. Incompatible model architecture');
    console.error('4. Corrupted model file');
    console.error('\nRecommendations:');
    console.error('- Start with LLAMACPP_GPU_LAYERS=0 (CPU only)');
    console.error('- Use smaller models (7B or 13B parameters)');
    console.error('- Use quantized versions (Q4_K_M or Q5_K_M)');
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run the test
testLlamaCppLocal();
