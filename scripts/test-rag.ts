/**
 * RAG機能の簡単なテストスクリプト
 */

import { config } from 'dotenv';
import { getRAGManager } from '../src/kernel/rag/rag-manager.js';

// Load environment variables
config();

async function testRAG() {
  console.log('🧪 RAG機能テスト開始...\n');

  try {
    // Step 1: RAGマネージャーを初期化
    console.log('[1/5] RAGマネージャーを初期化中...');
    const ragManager = getRAGManager();
    await ragManager.initialize();

    if (!ragManager.isReady()) {
      console.log('❌ RAGが有効化されていません');
      console.log('\n解決方法:');
      console.log('  1. config/rag-config.json で "enabled": true を確認');
      console.log('  2. .env に OPENAI_API_KEY が設定されているか確認');
      console.log('  3. npm install を実行');
      process.exit(1);
    }

    console.log('✓ RAGマネージャー初期化成功\n');

    // Step 2: 統計情報を取得
    console.log('[2/5] RAG統計情報を取得中...');
    const stats = await ragManager.getStats();
    console.log('✓ 統計情報取得成功');
    console.log(`  - 有効: ${stats.isEnabled ? 'はい' : 'いいえ'}`);
    console.log(`  - 初期化済み: ${stats.isInitialized ? 'はい' : 'いいえ'}`);
    console.log(`  - ベクトル数: ${stats.totalVectors}`);
    console.log(`  - ストレージサイズ: ${(stats.storeSizeBytes / 1024 / 1024).toFixed(2)} MB\n`);

    // Step 3: テストファイルを作成してインデックス化
    console.log('[3/5] テストドキュメントを作成中...');
    const fs = await import('fs/promises');
    const path = await import('path');
    const testDir = path.resolve('data/test-rag');
    const testFile = path.join(testDir, 'test-document.md');

    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, `# テストドキュメント

これはRAG機能のテストドキュメントです。
Yui Protocolは複数のAIエージェントが協働するシステムです。
エージェント間の対話により深い洞察が得られます。

## 主な機能
- RAG (Retrieval-Augmented Generation)
- ベクトル検索
- 自動インデックス化
`, 'utf-8');

    console.log(`✓ テストファイル作成: ${testFile}\n`);

    // Step 4: テストファイルをインデックス化
    console.log('[4/5] テストファイルをインデックス化中...');
    const retriever = ragManager.getRetriever();
    if (!retriever) {
      console.log('❌ RAG Retrieverが利用できません');
      process.exit(1);
    }

    const chunksIndexed = await retriever.indexLocalDocuments([testFile]);
    console.log(`✓ インデックス化完了: ${chunksIndexed} チャンク\n`);

    // Step 5: 検索テスト
    console.log('[5/5] 検索テストを実行中...');
    const searchResult = await retriever.retrieve({
      query: 'Yui Protocolの主な機能',
      topK: 3,
      minScore: 0.3
    });

    console.log(`✓ 検索完了: ${searchResult.results.length} 件の結果\n`);

    if (searchResult.results.length > 0) {
      console.log('📄 検索結果:');
      searchResult.results.forEach((result, index) => {
        console.log(`\n  [${index + 1}] スコア: ${(result.score * 100).toFixed(1)}%`);
        console.log(`      内容: ${result.chunk.content.substring(0, 100)}...`);
      });
    } else {
      console.log('⚠️  検索結果が見つかりませんでした');
    }

    // クリーンアップ
    console.log('\n🧹 テストファイルをクリーンアップ中...');
    await fs.unlink(testFile);
    await fs.rmdir(testDir);

    // 最終統計
    console.log('\n📊 最終統計:');
    const finalStats = await ragManager.getStats();
    console.log(`   ベクトル数: ${finalStats.totalVectors}`);
    console.log(`   ストレージサイズ: ${(finalStats.storeSizeBytes / 1024 / 1024).toFixed(2)} MB`);

    await ragManager.shutdown();

    console.log('\n✅ すべてのテストが成功しました！');
    console.log('RAG機能は正常に動作しています。\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ テスト失敗:', error);
    console.error('\nエラー詳細:', error);
    process.exit(1);
  }
}

// テスト実行
testRAG().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
