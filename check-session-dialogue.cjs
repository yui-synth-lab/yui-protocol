const fs = require('fs');

const sessionId = process.argv[2] || '208';
const session = JSON.parse(fs.readFileSync(`sessions/${sessionId}.json`, 'utf8'));

// エージェントのメッセージを抽出
const agentMessages = session.messages.filter(m =>
  m.role === 'agent' && m.agentId !== 'facilitator-001' && m.agentId !== 'system'
);

console.log('=== 初期の対話（最初の3メッセージ） ===\n');
agentMessages.slice(0, 3).forEach(m => {
  const agent = session.agents.find(a => a.id === m.agentId);
  console.log(`【${agent?.name || m.agentId}】 (${m.stage || 'unknown'})`);
  console.log(m.content.substring(0, 250) + '...\n');
});

console.log('\n=== 後期の対話（最後の3メッセージ） ===\n');
agentMessages.slice(-3).forEach(m => {
  const agent = session.agents.find(a => a.id === m.agentId);
  console.log(`【${agent?.name || m.agentId}】 (${m.stage || 'unknown'})`);
  console.log(m.content.substring(0, 250) + '...\n');
});

// 収束メッセージを確認
const convergenceMsg = session.messages.find(m =>
  m.agentId === 'system' && m.content.includes('対話完了')
);
if (convergenceMsg) {
  console.log('\n=== 収束理由 ===');
  console.log(convergenceMsg.content.substring(0, 400));
}

// ファイナライザーメッセージを確認
const finalizerMsg = session.messages.find(m => m.stage === 'finalize');
if (finalizerMsg) {
  const agent = session.agents.find(a => a.id === finalizerMsg.agentId);
  console.log('\n=== ファイナライザー ===');
  console.log(`選出: ${agent?.name || finalizerMsg.agentId}`);
  console.log('\n最終統合メッセージ（最初の500文字）:');
  console.log(finalizerMsg.content.substring(0, 500) + '...');
}
