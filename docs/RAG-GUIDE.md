# Yui Protocol RAG機能ガイド

## 概要

Yui Protocolに追加されたRAG (Retrieval-Augmented Generation) 機能により、エージェントは外部知識源を参照して、より根拠のある深い議論を行えるようになりました。

## 主な機能

### 1. **知識源の統合**
- ローカルドキュメント (.txt, .md, .json)
- 過去の対話履歴（セッション）
- カスタム知識ベース

### 2. **自動インデックス化**
- セッション終了時に自動的に対話履歴をインデックス化
- 指定ディレクトリの監視と定期的なインデックス更新

### 3. **エージェント統合**
- すべてのBaseAgent派生クラスでRAG機能を利用可能
- エージェント固有のフィルタリング
- 個性を反映した知識検索

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

必要なパッケージ:
- `vectordb` - LanceDB vector store
- `openai` - OpenAI embeddings

### 2. 環境変数の設定

`.env`ファイルに以下を追加:

```bash
# OpenAI API Key (embeddings用)
OPENAI_API_KEY=your_api_key_here
```

### 3. RAG設定ファイルの編集

`config/rag-config.json`:

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
  },
  "retrieval": {
    "defaultTopK": 5,
    "defaultMinScore": 0.5,
    "maxContextTokens": 2000
  },
  "indexing": {
    "autoIndexSessions": true,
    "autoIndexLocalDocs": false,
    "watchDirectories": ["./knowledge", "./docs"]
  }
}
```

## 使用方法

### RAGシステムの初期化

```typescript
import { getRAGManager } from './src/kernel/rag/rag-manager.js';

// RAGマネージャーを取得
const ragManager = getRAGManager();

// 初期化
await ragManager.initialize();

// RAGRetrieverを取得
const ragRetriever = ragManager.getRetriever();
```

### エージェントでの使用

```typescript
import { BaseAgent } from './src/agents/base-agent.js';
import { getRAGManager } from './src/kernel/rag/rag-manager.js';

// RAGマネージャーを初期化
const ragManager = getRAGManager();
await ragManager.initialize();

// エージェントを作成（RAGRetrieverを渡す）
const agent = new YourAgent(
  agentConfig,
  interactionLogger,
  'en',
  ragManager.getRetriever()
);

// RAG機能を有効化
agent.setRAGEnabled(true);

// RAG機能を使って知識を取得
const knowledge = await agent.retrieveKnowledge('What is quantum computing?');

if (knowledge) {
  console.log(`Found ${knowledge.retrievedKnowledge.length} relevant sources`);
  console.log(knowledge.formattedContext);
}
```

### ドキュメントのインデックス化

#### ローカルファイルをインデックス

```typescript
const ragManager = getRAGManager();
const retriever = ragManager.getRetriever();

// 単一ファイルをインデックス
await retriever.indexLocalDocuments(['./docs/guide.md']);

// ディレクトリ全体をインデックス（再帰的）
await retriever.indexDirectory('./knowledge', true);
```

#### セッション履歴をインデックス

```typescript
// セッション終了時に自動的にインデックス化（config.autoIndexSessions: trueの場合）
// または手動でインデックス化:

const messages = [
  /* セッションのメッセージ配列 */
];

await ragManager.indexSessionMessages('session-123', messages);
```

### RAG検索の実行

```typescript
const retriever = ragManager.getRetriever();

// 基本検索
const results = await retriever.retrieve({
  query: 'エージェント間の対話について',
  topK: 5,
  minScore: 0.5
});

console.log(`Found ${results.results.length} results`);
console.log(results.augmentedContext);

// フィルタ付き検索
const filteredResults = await retriever.retrieve({
  query: 'Previous discussions about AI ethics',
  topK: 3,
  filters: {
    sourceType: ['session-history'],
    agentId: 'yui-000',
    dateRange: {
      start: new Date('2025-01-01'),
      end: new Date()
    }
  }
});
```

### エージェント固有の知識検索

```typescript
// エージェント内部で自分の過去の発言を検索
class MyAgent extends BaseAgent {
  async processWithKnowledge(query: string) {
    // 自分の過去の発言を優先的に検索
    const myKnowledge = await this.retrieveAgentSpecificKnowledge(query);

    if (myKnowledge) {
      console.log(`Found ${myKnowledge.sources.length} of my previous statements`);
    }

    // プロンプトにRAG知識を統合
    const enhancedPrompt = await this.enhancePromptWithRAG(
      originalPrompt,
      query
    );

    // 拡張されたプロンプトでAI実行
    return await this.executeAIWithErrorHandling(
      enhancedPrompt,
      personality,
      sessionId,
      stage,
      'operation'
    );
  }
}
```

## 設定オプション

### Vector Store設定

| オプション             | 説明                                  | デフォルト値                   |
| ---------------------- | ------------------------------------- | ------------------------------ |
| `storePath`            | ベクトルストアの保存先                | `./data/vector-store`          |
| `embeddingDimension`   | 埋め込みベクトルの次元数              | `1536`                         |
| `embeddingProvider`    | 埋め込みプロバイダー                  | `openai`                       |
| `embeddingModel`       | 埋め込みモデル                        | `text-embedding-3-small`       |
| `distanceMetric`       | 距離メトリック                        | `cosine`                       |

### Ingestion設定

| オプション                 | 説明                      | デフォルト値           |
| -------------------------- | ------------------------- | ---------------------- |
| `chunkSize`                | 各チャンクのサイズ（文字数）| `500`                  |
| `chunkOverlap`             | チャンク間のオーバーラップ | `50`                   |
| `enableMetadataExtraction` | メタデータ自動抽出        | `true`                 |
| `supportedFileTypes`       | サポートするファイル形式  | `['.txt', '.md', '.json']` |
| `batchSize`                | 並列処理バッチサイズ      | `10`                   |

### Retrieval設定

| オプション          | 説明                          | デフォルト値 |
| ------------------- | ----------------------------- | ------------ |
| `defaultTopK`       | デフォルトの検索結果数        | `5`          |
| `defaultMinScore`   | 最小類似度スコア              | `0.5`        |
| `maxContextTokens`  | コンテキストの最大トークン数  | `2000`       |
| `enableReranking`   | リランキングの有効化          | `true`       |

### Indexing設定

| オプション           | 説明                           | デフォルト値            |
| -------------------- | ------------------------------ | ----------------------- |
| `autoIndexSessions`  | セッション自動インデックス化   | `true`                  |
| `autoIndexLocalDocs` | ローカルドキュメント自動インデックス | `false`           |
| `indexingInterval`   | インデックス更新間隔（分）     | `60`                    |
| `watchDirectories`   | 監視するディレクトリ           | `['./knowledge', './docs']` |

## RAG統計情報の取得

```typescript
const ragManager = getRAGManager();
const stats = await ragManager.getStats();

console.log('RAG Statistics:');
console.log(`  Enabled: ${stats.isEnabled}`);
console.log(`  Initialized: ${stats.isInitialized}`);
console.log(`  Total Vectors: ${stats.totalVectors}`);
console.log(`  Store Size: ${(stats.storeSizeBytes / 1024 / 1024).toFixed(2)} MB`);
```

## ベストプラクティス

### 1. **効率的なチャンクサイズ**
- 短すぎるチャンク（< 200文字）: 文脈が失われる
- 長すぎるチャンク（> 1000文字）: 関連性が薄れる
- 推奨: 400-600文字

### 2. **適切なフィルタリング**
```typescript
// 時間範囲でフィルタ（最近の議論のみ）
const recentDiscussions = await retriever.retrieve({
  query: 'AI ethics',
  filters: {
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 過去7日間
      end: new Date()
    }
  }
});

// 特定のエージェントの発言のみ
const yuiStatements = await retriever.retrieve({
  query: 'philosophical perspectives',
  filters: {
    agentId: 'yui-000'
  }
});
```

### 3. **コスト管理**
- `text-embedding-3-small` (1536次元): 低コスト、十分な精度
- `text-embedding-3-large` (3072次元): 高コスト、最高精度
- バッチ処理を活用してAPIコール削減

### 4. **定期的なメンテナンス**
```typescript
// 古いデータのクリーンアップ（必要に応じて実装）
// ベクトルストアのサイズ監視
const stats = await ragManager.getStats();
if (stats.storeSizeBytes > 1024 * 1024 * 1024) { // 1GB超過
  console.warn('Vector store size exceeds 1GB, consider cleanup');
}
```

## トラブルシューティング

### RAGが初期化されない

```bash
# 設定を確認
cat config/rag-config.json

# enabled: true になっているか確認
# OPENAI_API_KEYが設定されているか確認
echo $OPENAI_API_KEY
```

### 検索結果が返らない

```typescript
// 最小スコアを下げてみる
const results = await retriever.retrieve({
  query: '...',
  minScore: 0.3 // デフォルト: 0.5
});

// インデックスされているデータを確認
const stats = await ragManager.getStats();
console.log(`Total vectors: ${stats.totalVectors}`);
```

### 埋め込み生成エラー

```bash
# OpenAI APIキーを確認
# レート制限に達していないか確認
# バッチサイズを小さくする
```

## 今後の拡張予定

- [ ] Webクローラーによる外部知識の取り込み
- [ ] 画像・PDFのサポート
- [ ] マルチモーダル埋め込み
- [ ] カスタムリランキングモデル
- [ ] Knowledge Graphとの統合

## まとめ

RAG機能により、Yui Protocolのエージェントは:
- より深い知識に基づいた議論が可能に
- 過去の議論を参照して一貫性のある対話
- 外部ドキュメントの内容を正確に引用
- エージェント間の知識共有と学習

詳細な実装については、各コンポーネントのソースコードを参照してください:
- [src/kernel/rag/](../src/kernel/rag/)
- [src/types/rag.ts](../src/types/rag.ts)
- [src/config/rag-config-loader.ts](../src/config/rag-config-loader.ts)
