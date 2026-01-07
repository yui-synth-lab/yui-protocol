/**
 * RAGシステムの統計情報を表示するスクリプト
 */

import { config } from 'dotenv';
import { getRAGManager } from '../src/kernel/rag/rag-manager.js';

// Load environment variables
config();

async function showRAGStats() {
  console.log('=== Yui Protocol - RAG Statistics ===\n');

  try {
    // RAGマネージャーを初期化
    const ragManager = getRAGManager();
    await ragManager.initialize();

    if (!ragManager.isReady()) {
      console.log('⚠️  RAG is not enabled or not initialized');
      console.log('\nTo enable RAG:');
      console.log('  1. Set "enabled": true in config/rag-config.json');
      console.log('  2. Set OPENAI_API_KEY in .env file');
      console.log('  3. Run: npm install\n');
      process.exit(0);
    }

    // 統計情報を取得
    const stats = await ragManager.getStats();

    console.log('📊 System Status:');
    console.log(`   Enabled: ${stats.isEnabled ? '✓' : '✗'}`);
    console.log(`   Initialized: ${stats.isInitialized ? '✓' : '✗'}`);
    console.log('');

    console.log('📚 Vector Store:');
    console.log(`   Total vectors: ${stats.totalVectors.toLocaleString()}`);
    console.log(`   Store size: ${(stats.storeSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Store path: ${stats.config.vectorStore.storePath}`);
    console.log('');

    console.log('⚙️  Configuration:');
    console.log(`   Embedding provider: ${stats.config.vectorStore.embeddingProvider}`);
    console.log(`   Embedding model: ${stats.config.vectorStore.embeddingModel}`);
    console.log(`   Embedding dimension: ${stats.config.vectorStore.embeddingDimension}`);
    console.log(`   Chunk size: ${stats.config.ingestion.chunkSize} chars`);
    console.log(`   Chunk overlap: ${stats.config.ingestion.chunkOverlap} chars`);
    console.log('');

    console.log('🔍 Retrieval Settings:');
    console.log(`   Default top-K: ${stats.config.retrieval.defaultTopK}`);
    console.log(`   Min score: ${stats.config.retrieval.defaultMinScore}`);
    console.log(`   Max context tokens: ${stats.config.retrieval.maxContextTokens}`);
    console.log(`   Reranking: ${stats.config.retrieval.enableReranking ? 'enabled' : 'disabled'}`);
    console.log('');

    console.log('📁 Indexing:');
    console.log(`   Auto-index sessions: ${stats.config.indexing.autoIndexSessions ? 'enabled' : 'disabled'}`);
    console.log(`   Auto-index local docs: ${stats.config.indexing.autoIndexLocalDocs ? 'enabled' : 'disabled'}`);
    if (stats.config.indexing.watchDirectories && stats.config.indexing.watchDirectories.length > 0) {
      console.log(`   Watch directories:`);
      stats.config.indexing.watchDirectories.forEach(dir => {
        console.log(`     - ${dir}`);
      });
    }
    console.log('');

    console.log('💾 Supported File Types:');
    console.log(`   ${stats.config.ingestion.supportedFileTypes.join(', ')}`);
    console.log('');

    // 簡単な推定情報
    if (stats.totalVectors > 0) {
      const avgCharsPerChunk = stats.config.ingestion.chunkSize;
      const estimatedTotalChars = stats.totalVectors * avgCharsPerChunk;
      const estimatedPages = Math.ceil(estimatedTotalChars / 2000); // 1ページ約2000文字と仮定

      console.log('📈 Estimated Content:');
      console.log(`   Total characters: ~${estimatedTotalChars.toLocaleString()}`);
      console.log(`   Approximate pages: ~${estimatedPages.toLocaleString()}`);
      console.log('');
    }

    console.log('✅ RAG system is operational!\n');

    // シャットダウン
    await ragManager.shutdown();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Failed to get RAG statistics:', error);
    process.exit(1);
  }
}

// スクリプト実行
showRAGStats().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
