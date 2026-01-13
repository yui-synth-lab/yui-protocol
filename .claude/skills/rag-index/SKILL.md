---
name: rag-index
description: Manage RAG (Retrieval-Augmented Generation) indexes. Use for indexing outputs, sessions, or checking RAG statistics.
allowed-tools: Bash, Read, Glob
model: haiku
---

# RAG Index Skill

RAGシステムのインデックスを管理するスキル。

## インデックス作成

```bash
# 出力データをインデックス化
npm run rag:index-outputs

# セッションデータをインデックス化
npm run rag:index-sessions
```

## 統計確認

```bash
npm run rag:stats
```

## 関連ファイル

- `src/kernel/rag/vector-store.ts` - ベクトルストア
- `src/kernel/rag/document-ingestion.ts` - ドキュメント取り込み
- `src/kernel/rag/embedding-generator.ts` - 埋め込み生成
- `scripts/index-outputs.ts` - インデックススクリプト
- `scripts/index-sessions.ts` - セッションインデックススクリプト

## 詳細ドキュメント

- [docs/RAG-GUIDE.md](../../../docs/RAG-GUIDE.md)
- [docs/RAG-QUICKSTART.md](../../../docs/RAG-QUICKSTART.md)
