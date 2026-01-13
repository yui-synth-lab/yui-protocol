# RAG操作ガイド

## 概要

RAG (Retrieval-Augmented Generation) システムは、過去の対話履歴を検索してエージェントの応答を強化する。

## コマンド

```bash
# 出力をインデックス化
npm run rag:index-outputs

# セッションをインデックス化
npm run rag:index-sessions

# 統計表示
npm run rag:stats
```

## アーキテクチャ

```text
src/kernel/rag/
├── vector-store.ts        # LanceDBベクトルストア
├── document-ingestion.ts  # ドキュメント取り込み
├── rag-retriever.ts       # 検索実行
├── embedding-generator.ts # 埋め込み生成
└── rag-manager.ts         # 統合管理
```

## 設定

`src/config/rag-config-loader.ts` で設定をロード。

## 詳細ドキュメント

- [docs/RAG-GUIDE.md](../docs/RAG-GUIDE.md)
- [docs/RAG-QUICKSTART.md](../docs/RAG-QUICKSTART.md)
- [docs/RAG-OUTPUTS-INDEXING.md](../docs/RAG-OUTPUTS-INDEXING.md)
