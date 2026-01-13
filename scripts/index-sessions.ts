/**
 * Script to index all session files to RAG
 * Usage: npm run rag:index-sessions
 */

import { config } from 'dotenv';
config();

import { getRAGManager } from '../src/kernel/rag/rag-manager.js';

async function main() {
  console.log('=== Yui Protocol - Index Sessions to RAG ===\n');

  try {
    const ragManager = getRAGManager();
    await ragManager.initialize();

    if (!ragManager.isReady()) {
      console.error('RAG system is not ready. Check configuration.');
      process.exit(1);
    }

    console.log('Indexing sessions directory...\n');
    const chunksIndexed = await ragManager.indexAllSessions('./sessions');

    console.log(`\n✅ Successfully indexed ${chunksIndexed} chunks from sessions`);

    // Show stats
    const stats = await ragManager.getStats();
    console.log(`\n📊 Total vectors in RAG: ${stats.totalVectors.toLocaleString()}`);

    await ragManager.shutdown();
  } catch (error) {
    console.error('Failed to index sessions:', error);
    process.exit(1);
  }
}

main();
