# outputs ディレクトリのインデックス化ガイド

## 概要

このガイドでは、`outputs/` ディレクトリ以下のすべての Markdown ファイル (*.md) をRAGシステムにインデックス化する方法を説明します。

## 🚀 自動インデックス化（推奨）

**セッション終了時に生成されたMarkdownファイルは自動的にRAGにインデックス化されます！**

### 設定方法

`config/rag-config.json` で自動インデックス化を有効化:

```json
{
  "enabled": true,
  "indexing": {
    "autoIndexOutputs": true  // これをtrueに設定（デフォルトでtrue）
  }
}
```

### 動作

セッションが終了してMarkdownファイルが `outputs/` ディレクトリに保存されると:

1. ✅ ファイルが `outputs/` に保存される
2. 🔍 RAGシステムが自動的にファイルを検出
3. 📊 ファイルをチャンク化して埋め込みベクトルを生成
4. 💾 LanceDBにインデックス化

**ログ出力例:**
```
[OutputStorage] Saved output to outputs/178_1.md
[OutputStorage] 🔍 Auto-indexing to RAG: outputs/178_1.md
[OutputStorage] ✓ Auto-indexed 3 chunks to RAG
```

これにより、新しい議論の内容がすぐにRAG検索可能になります！

---

## 📦 手動一括インデックス化

既存のoutputsファイルをまとめてインデックス化したい場合:

## 前提条件

1. **RAG機能が有効化されていること**
   - `config/rag-config.json` で `"enabled": true`
   - `.env` に `OPENAI_API_KEY` が設定済み

2. **依存関係がインストールされていること**
   ```bash
   npm install
   ```

## インデックス化手順

### ステップ1: RAG設定の確認

`config/rag-config.json` が正しく設定されているか確認:

```json
{
  "enabled": true,
  "vectorStore": {
    "storePath": "./data/vector-store",
    "embeddingDimension": 1536,
    "embeddingProvider": "openai",
    "embeddingModel": "text-embedding-3-small"
  },
  "ingestion": {
    "chunkSize": 500,
    "chunkOverlap": 50,
    "supportedFileTypes": [".txt", ".md", ".json"]
  }
}
```

### ステップ2: outputs ディレクトリをインデックス化

以下のコマンドを実行:

```bash
npm run rag:index-outputs
```

このコマンドは:
- `outputs/` ディレクトリ以下のすべての `.md` ファイルをスキャン
- 各ファイルをチャンク化（デフォルト: 500文字/チャンク）
- OpenAI APIで埋め込みベクトルを生成
- LanceDBにインデックス化

### 実行例

```bash
$ npm run rag:index-outputs

=== Yui Protocol - Outputs Indexing Script ===

[1/4] Initializing RAG Manager...
✓ RAG Manager initialized successfully

[2/4] Scanning outputs directory: /path/to/yui-protocol/outputs
[3/4] Indexing Markdown files...
    This may take a few minutes depending on the number of files.

✓ Indexing complete in 45.23s
   Total chunks indexed: 1247

[4/4] RAG System Statistics:
   - Total vectors: 1247
   - Store size: 15.42 MB
   - Enabled: true
   - Initialized: true

=== Test Search ===
Searching for: "Yui Protocol"

Found 3 relevant documents:

  [1] Yui_Protocol.md
      Relevance: 87.3%
      Preview: Yui Protocol は、複数のAIエージェントが対話することで...

  [2] 153_1.md
      Relevance: 82.1%
      Preview: エージェント間の対話により、より深い洞察が得られます...

  [3] temporal_adhesion.md
      Relevance: 78.5%
      Preview: 時間的な粘着性という概念について...

✅ Indexing completed successfully!

You can now search through all outputs using RAG queries.
```

## インデックス化後の使用方法

### 1. エージェントでの使用

```typescript
import { getRAGManager } from './src/kernel/rag/rag-manager.js';

// RAGマネージャーを取得
const ragManager = getRAGManager();
await ragManager.initialize();
const retriever = ragManager.getRetriever();

// outputs内のドキュメントを検索
const results = await retriever.retrieve({
  query: '時間的粘着性について教えて',
  topK: 5,
  filters: {
    sourceType: ['local-file']
  }
});

console.log('検索結果:', results.results.length);
results.results.forEach(result => {
  console.log(`- ${result.chunk.metadata.title}: ${result.score}`);
});
```

### 2. 特定のトピックで検索

```typescript
// 特定のセッション番号で検索
const sessionResults = await retriever.retrieve({
  query: 'セッション153の議論',
  topK: 10,
  filters: {
    sourceType: ['local-file']
  }
});

// 時間範囲でフィルタ（ファイルの作成日時）
const recentResults = await retriever.retrieve({
  query: '最近の議論',
  filters: {
    dateRange: {
      start: new Date('2025-01-01'),
      end: new Date()
    }
  }
});
```

### 3. BaseAgentでの使用

```typescript
class MyAgent extends BaseAgent {
  async stage1IndividualThought(prompt: string, context: Message[], language: Language) {
    // 過去のoutputsから関連する議論を検索
    const pastDiscussions = await this.retrieveKnowledge(prompt, {
      sourceType: ['local-file']
    });

    if (pastDiscussions && pastDiscussions.retrievedKnowledge.length > 0) {
      console.log(`Found ${pastDiscussions.sources.length} related past discussions`);

      // 過去の議論を考慮して応答
      const enhancedPrompt = await this.enhancePromptWithRAG(
        originalPrompt,
        prompt,
        { sourceType: ['local-file'] }
      );
    }

    return super.stage1IndividualThought(prompt, context, language);
  }
}
```

## RAG統計の確認

インデックス化の状況を確認するには:

```bash
npm run rag:stats
```

出力例:
```
=== Yui Protocol - RAG Statistics ===

📊 System Status:
   Enabled: ✓
   Initialized: ✓

📚 Vector Store:
   Total vectors: 1,247
   Store size: 15.42 MB
   Store path: ./data/vector-store

⚙️  Configuration:
   Embedding provider: openai
   Embedding model: text-embedding-3-small
   Embedding dimension: 1536
   Chunk size: 500 chars
   Chunk overlap: 50 chars

📈 Estimated Content:
   Total characters: ~623,500
   Approximate pages: ~312
```

## トラブルシューティング

### エラー: "OPENAI_API_KEY not found"

**解決策:**
```bash
# .envファイルにAPIキーを追加
echo "OPENAI_API_KEY=sk-your_key_here" >> .env
```

### エラー: "RAG is not enabled"

**解決策:**
`config/rag-config.json` で `enabled: true` に設定:
```json
{
  "enabled": true,
  ...
}
```

### インデックス化が遅い

大量のファイル（100+）をインデックス化する場合、数分かかることがあります。

**最適化のヒント:**
1. `batchSize` を調整（デフォルト: 10）
   ```json
   "ingestion": {
     "batchSize": 5  // 小さくすると安定、大きくすると高速
   }
   ```

2. OpenAI APIのレート制限を確認
   - free tier: 3 requests/min
   - tier 1: 500 requests/min

### メモリ不足エラー

非常に大きなファイルをインデックス化する場合:

```json
"ingestion": {
  "chunkSize": 300,  // デフォルト: 500
  "chunkOverlap": 30  // デフォルト: 50
}
```

## パフォーマンスとコスト

### 推定コスト（OpenAI）

- **text-embedding-3-small**: $0.00002 / 1K tokens
- 100ファイル × 平均5KB = 約500KB
- 500KB ≈ 125,000 tokens
- コスト: 約 $0.0025 (0.25円)

### インデックス化時間

| ファイル数 | 推定時間 |
|----------|---------|
| 10       | 5-10秒  |
| 50       | 30-60秒 |
| 100      | 1-2分   |
| 500+     | 5-10分  |

## ベストプラクティス

### 1. 定期的な再インデックス化

outputsディレクトリが更新された場合:
```bash
# 既存のインデックスをクリア（必要に応じて）
rm -rf data/vector-store

# 再インデックス化
npm run rag:index-outputs
```

### 2. 選択的インデックス化

特定のファイルのみをインデックス化したい場合:

```typescript
import { getRAGManager } from './src/kernel/rag/rag-manager.js';

const ragManager = getRAGManager();
await ragManager.initialize();
const retriever = ragManager.getRetriever();

// 特定のファイルのみ
await retriever.indexLocalDocuments([
  './outputs/Yui_Protocol.md',
  './outputs/temporal_adhesion.md'
]);
```

### 3. インデックスのバックアップ

```bash
# バックアップ
cp -r data/vector-store data/vector-store-backup

# 復元
rm -rf data/vector-store
cp -r data/vector-store-backup data/vector-store
```

## まとめ

- **インデックス化**: `npm run rag:index-outputs`
- **統計確認**: `npm run rag:stats`
- **検索**: RAGRetrieverの`retrieve()`メソッド
- **エージェント統合**: BaseAgentの`retrieveKnowledge()`メソッド

これで、過去のすべてのoutputsファイルがRAG検索可能になり、エージェントは過去の議論を参照しながら、より深い対話ができるようになります！
