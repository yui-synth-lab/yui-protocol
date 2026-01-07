# RAG機能 クイックスタートガイド

## 🚀 5分で始めるRAG機能

### ステップ1: 依存関係のインストール

```bash
npm install
```

### ステップ2: 環境変数の設定

`.env`ファイルを作成またはを編集:

```bash
# OpenAI API Key (embeddings用)
OPENAI_API_KEY=sk-your_api_key_here
```

### ステップ3: RAG機能を有効化

`config/rag-config.json`の`enabled`を`true`に設定:

```json
{
  "enabled": true,
  ...
}
```

### ステップ4: ビルド

```bash
npm run build
```

### ステップ5: サーバー起動

```bash
npm run server
```

## ✅ 動作確認

### ドキュメントをインデックス化

プロジェクトルートに`knowledge`ディレクトリを作成:

```bash
mkdir knowledge
```

サンプルドキュメントを追加:

```bash
echo "Yui Protocol は、複数のAIエージェントが対話することで深い思索を実現するシステムです。" > knowledge/about.txt
```

### RAG検索をテスト

TypeScriptコンソールまたはテストスクリプトで:

```typescript
import { getRAGManager } from './dist/kernel/rag/rag-manager.js';

async function testRAG() {
  const ragManager = getRAGManager();
  await ragManager.initialize();

  // ドキュメントをインデックス
  await ragManager.indexLocalDocuments();

  // 検索テスト
  const retriever = ragManager.getRetriever();
  const results = await retriever.retrieve({
    query: 'Yui Protocolとは何ですか?',
    topK: 3
  });

  console.log('検索結果:', results.augmentedContext);

  await ragManager.shutdown();
}

testRAG();
```

## 📊 RAG統計の確認

```typescript
const stats = await ragManager.getStats();
console.log('RAG Statistics:', stats);
```

## 🔧 よくある問題

### 問題: RAGが初期化されない

**解決策:**
1. `config/rag-config.json`の`enabled: true`を確認
2. `.env`に`OPENAI_API_KEY`が設定されているか確認
3. `npm install`で依存関係が正しくインストールされているか確認

### 問題: 検索結果が返らない

**解決策:**
1. ドキュメントがインデックス化されているか確認
   ```typescript
   const stats = await ragManager.getStats();
   console.log('Total vectors:', stats.totalVectors);
   ```
2. `minScore`を下げてみる (デフォルト: 0.5 → 0.3)

### 問題: OpenAI API エラー

**解決策:**
1. APIキーが有効か確認
2. レート制限に達していないか確認
3. `config/rag-config.json`の`batchSize`を小さくする (10 → 5)

## 📖 詳細ドキュメント

詳しい使い方は [RAG-GUIDE.md](./RAG-GUIDE.md) を参照してください。

## 🎯 次のステップ

1. **過去の対話をインデックス化**: `autoIndexSessions: true`
2. **カスタム知識を追加**: `knowledge/`ディレクトリにファイルを配置
3. **エージェントでRAG使用**: BaseAgentの`retrieveKnowledge()`メソッド

## 💡 活用例

```typescript
// エージェント内でRAG知識を活用
class MyAgent extends BaseAgent {
  async stage1IndividualThought(prompt: string, context: Message[], language: Language) {
    // RAGで関連知識を取得
    const knowledge = await this.retrieveKnowledge(prompt);

    if (knowledge && knowledge.retrievedKnowledge.length > 0) {
      console.log(`Found ${knowledge.sources.length} relevant sources`);
      // 知識を考慮した応答を生成
    }

    // 通常の処理を続行
    return super.stage1IndividualThought(prompt, context, language);
  }
}
```

## 🔗 関連リソース

- [完全ガイド](./RAG-GUIDE.md)
- [型定義](../src/types/rag.ts)
- [設定ファイル](../config/rag-config.json)
- [実装サンプル](../src/kernel/rag/)
