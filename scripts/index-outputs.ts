/**
 * outputs ディレクトリ以下の *.md ファイルをRAGシステムにインデックス化するスクリプト
 */

import { config } from 'dotenv';
import { getRAGManager } from '../src/kernel/rag/rag-manager.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function indexOutputsDirectory() {
  console.log('=== Yui Protocol - Outputs Indexing Script ===\n');

  try {
    // RAGマネージャーを初期化
    console.log('[1/4] Initializing RAG Manager...');
    const ragManager = getRAGManager();
    await ragManager.initialize();

    if (!ragManager.isReady()) {
      console.error('❌ RAG Manager is not ready. Please check your configuration.');
      console.error('   - Is RAG enabled in config/rag-config.json?');
      console.error('   - Is OPENAI_API_KEY set in .env?');
      process.exit(1);
    }

    console.log('✓ RAG Manager initialized successfully\n');

    // outputsディレクトリのパスを取得
    const outputsPath = path.resolve(__dirname, '../outputs');
    console.log(`[2/4] Scanning outputs directory: ${outputsPath}`);

    // outputsディレクトリをインデックス化
    console.log('[3/4] Indexing Markdown files...');
    console.log('    This may take a few minutes depending on the number of files.\n');

    const retriever = ragManager.getRetriever();
    if (!retriever) {
      console.error('❌ RAG Retriever not available');
      process.exit(1);
    }

    const startTime = Date.now();
    const chunksIndexed = await retriever.indexDirectory(outputsPath, true);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✓ Indexing complete in ${duration}s`);
    console.log(`   Total chunks indexed: ${chunksIndexed}\n`);

    // 統計情報を表示
    console.log('[4/4] RAG System Statistics:');
    const stats = await ragManager.getStats();
    console.log(`   - Total vectors: ${stats.totalVectors}`);
    console.log(`   - Store size: ${(stats.storeSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Enabled: ${stats.isEnabled}`);
    console.log(`   - Initialized: ${stats.isInitialized}\n`);

    // テスト検索を実行
    console.log('=== Test Search ===');
    console.log('Searching for: "Yui Protocol"\n');

    const testResults = await retriever.retrieve({
      query: 'Yui Protocol',
      topK: 3,
      minScore: 0.3
    });

    if (testResults.results.length > 0) {
      console.log(`Found ${testResults.results.length} relevant documents:`);
      testResults.results.forEach((result, index) => {
        const title = result.chunk.metadata.title || 'Untitled';
        const score = (result.score * 100).toFixed(1);
        console.log(`\n  [${index + 1}] ${title}`);
        console.log(`      Relevance: ${score}%`);
        console.log(`      Preview: ${result.chunk.content.substring(0, 150)}...`);
      });
    } else {
      console.log('No results found.');
    }

    console.log('\n✅ Indexing completed successfully!');
    console.log('\nYou can now search through all outputs using RAG queries.');

    // シャットダウン
    await ragManager.shutdown();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Indexing failed:', error);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// スクリプト実行
indexOutputsDirectory().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
