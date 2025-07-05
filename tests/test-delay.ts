// StageSummarizerのdelay動作テスト
import { RealtimeYuiProtocolRouter } from '../src/kernel/realtime-router.ts';

async function testDelay() {
  console.log('Starting delay test...');
  
  // テスト用にdelayを短縮
  const router = new RealtimeYuiProtocolRouter(undefined, undefined, undefined, undefined, {
    stageSummarizerDelayMS: 2000,
    finalSummaryDelayMS: 3000
  });
  
  // テストセッションを作成
  const session = await router.createSession('Delay Test', ['yui-000', 'kanshi-001']);
  
  console.log(`Created session: ${session.id}`);
  
  // Stage 1を実行（StageSummarizerのdelayをテスト）
  console.log('\n=== Testing StageSummarizer delay ===');
  const startTime = Date.now();
  
  try {
    await router.executeStageRealtime(
      session.id,
      'Test prompt for delay',
      'individual-thought'
    );
    
    const duration = Date.now() - startTime;
    console.log(`Stage 1 completed in ${duration}ms`);
    console.log('Expected: ~2 seconds (2,000ms) for StageSummarizer delay');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testDelay().catch(console.error); 