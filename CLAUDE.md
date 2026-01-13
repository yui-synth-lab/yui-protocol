# CLAUDE.md - Yui Protocol

## What (技術構成)

マルチエージェント対話システム。複数のAIエージェントが哲学的テーマについて対話し、創発的な洞察を生成する。

### プロジェクト構造

```text
src/
├── agents/          # エージェント実装 (Yui, Eiro, Kanshi, Yoga, Hekito, Facilitator)
├── kernel/          # コアシステム
│   ├── router.ts         # v1.0 固定ステージ制ルーター
│   ├── dynamic-router.ts # v2.0 動的対話ルーター
│   ├── memory-manager.ts # 記憶階層化システム
│   ├── rag/              # RAG (検索拡張生成) システム
│   └── services/         # サービス層
├── server/          # Express API サーバー
├── types/           # TypeScript 型定義
├── templates/       # プロンプトテンプレート
└── config/          # 設定ローダー
```

### 技術スタック

- **Runtime**: TypeScript + Node.js (ESM)
- **Build**: Vite
- **Backend**: Express + Socket.IO
- **Frontend**: React
- **RAG**: LanceDB (vectordb)
- **Test**: Vitest

## Why (目的)

「納得するまで対話を続ける」動的システム。記憶の階層化とトークン効率化を両立させ、深い思索の場を提供する。

## How (作業方法)

### 基本コマンド

```bash
npm run build          # ビルド (Vite + TypeScript)
npm run dev            # フロントエンド開発サーバー
npm run dev:server     # バックエンド開発サーバー
npm run test           # テスト実行
npm run test:coverage  # カバレッジ付きテスト
```

### RAG関連コマンド

```bash
npm run rag:index-outputs   # 出力をインデックス化
npm run rag:index-sessions  # セッションをインデックス化
npm run rag:stats           # RAG統計表示
```

### 変更の検証

1. `npm run build` でビルドエラーがないことを確認
2. `npm run test` でテストが通ることを確認
3. 型エラーはビルド時に検出される

## 設計原則

1. **後方互換性**: v1.0システムを破壊しない。新機能は並行追加
2. **段階的進化**: 急激な変更ではなく自然な進化
3. **エージェントの個性**: 各エージェントの思考・記憶スタイルを尊重
4. **コスト意識**: トークン使用量を継続的に監視
5. **透明性**: 圧縮・要約プロセスをログに記録

## スキル & サブエージェント

### Skills (`.claude/skills/`)

| スキル | 用途 |
|--------|------|
| `create-agent` | 新規エージェント作成 |
| `run-tests` | テスト実行と検証 |
| `rag-index` | RAGインデックス管理 |
| `implement-v2` | v2.0機能実装 |

### Sub Agents (`.claude/agents/`)

| エージェント | 用途 |
|--------------|------|
| `code-reviewer` | コード品質レビュー |
| `test-runner` | テスト実行と修正 |
| `v2-implementer` | v2.0機能実装専門 |

## 詳細ドキュメント

- [docs/v2-implementation-plan.md](docs/v2-implementation-plan.md) - v2.0実装計画
- [docs/RAG-GUIDE.md](docs/RAG-GUIDE.md) - RAGシステムガイド
- [agent_docs/](agent_docs/) - タスク固有ドキュメント
