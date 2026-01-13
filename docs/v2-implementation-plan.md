# Yui Protocol 2.0 実装計画

> このドキュメントはv2.0動的対話システムの詳細な実装計画を記載しています。

## 概要

現在の固定ステージ制から「納得するまで対話を続ける」動的システムへの進化。

## 実装フェーズ

### Phase 1: 記憶の階層化システム (最優先)

#### 1.1 新しい型定義の追加

`src/types/memory.ts` を新規作成

#### 1.2 メモリマネージャーの実装

`src/kernel/memory-manager.ts` を実装

#### 1.3 BaseAgent の拡張

`src/agents/base-agent.ts` を修正（記憶関連メソッドを追加）

### Phase 2: 動的対話システム (中優先)

#### 2.1 納得度システムの実装

`src/types/consensus.ts` を新規作成

#### 2.2 ファシリテーターエージェントの追加

`src/agents/facilitator-agent.ts` を新規作成

#### 2.3 動的ルーターの実装

`src/kernel/dynamic-router.ts` を新規作成

### Phase 3: プロンプト最適化 (中優先)

#### 3.1 階層化プロンプトテンプレート

`src/templates/v2-prompts.ts` を新規作成

### Phase 4: 既存システムとの統合

#### 4.1 YuiProtocolRouter の拡張

`src/kernel/router.ts` を修正（既存メソッドを保持しつつ拡張）

#### 4.2 API エンドポイントの追加

`src/server/index.ts` に新規エンドポイント追加

#### 4.3 UI での選択機能（将来的な拡張）

`src/ui/App.tsx` に選択UI追加

## 開発の進め方

### 1. 既存システムの保護

- 既存のエンドポイントとメソッドは**絶対に削除しない**
- v1.0とv2.0を並行して動作させる
- 段階的移行を可能にする設計

### 2. テスト戦略

```bash
# Phase 1 テスト: メモリ圧縮
npm run test:memory

# Phase 2 テスト: 動的対話
npm run test:dynamic

# 統合テスト
npm run test:integration:v2

# 既存機能の回帰テスト
npm run test:regression
```

### 3. ログとデバッグ

- 記憶圧縮の過程を詳細にログ出力
- 納得度の変遷を時系列で追跡
- ファシリテーターの判断根拠を記録
- トークン使用量の継続的監視

### 4. 段階的リリース

1. **Phase 1**: 記憶階層化のみをテスト
2. **Phase 2**: 動的対話機能を追加
3. **Phase 3**: UIでの選択機能実装
4. **Phase 4**: 本格運用とフィードバック収集

## 期待される成果

| 指標 | 目標 |
|------|------|
| トークン使用量 | 現在の50-70%に削減 |
| 議論の深度 | より納得のいく議論の実現 |
| 創発性 | 予期しない洞察の発見増加 |
| 持続性 | 長期間の対話セッションが可能 |
| 個性 | エージェントごとの記憶パターンの確立 |

## 設定ファイル例

### `config/v2-settings.json`

```json
{
  "memory": {
    "maxRecentMessages": 5,
    "tokenThreshold": 8000,
    "compressionRatio": 0.3
  },
  "consensus": {
    "convergenceThreshold": 7.5,
    "maxRounds": 20,
    "minSatisfactionLevel": 6
  },
  "facilitator": {
    "actionPriority": {
      "deep_dive": 8,
      "clarification": 7,
      "perspective_shift": 6,
      "summarize": 5,
      "conclude": 9
    },
    "interventionCooldown": 2
  }
}
```

## ブランチ戦略

- **ベース**: main ブランチから `feature/v2.0-dynamic-dialogue` ブランチを作成
- Phase 1の記憶階層化から始め、安定動作を確認後に次のフェーズに進む
