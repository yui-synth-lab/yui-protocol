# V2.0 動的対話システム設定

このディレクトリには、Yui Protocol 2.0の動的対話システムの設定ファイルが含まれています。

## 設定ファイル

### v2-settings.json
V2.0システムの主要な設定を管理します。

```json
{
  "memory": {
    "maxRecentMessages": 5,      // 短期記憶に保持する最大メッセージ数
    "tokenThreshold": 8000,      // 記憶圧縮を開始するトークン閾値
    "compressionRatio": 0.3      // 圧縮率 (0.1-1.0)
  },
  "consensus": {
    "convergenceThreshold": 7.5, // 収束判定の閾値 (5.0-10.0)
    "maxRounds": 20,            // 最大ラウンド数 (5-50)
    "minSatisfactionLevel": 6   // 最低満足度レベル (1-10)
  },
  "facilitator": {
    "actionPriority": {
      "deep_dive": 8,           // 深掘り促進の優先度
      "clarification": 7,       // 明確化要求の優先度
      "perspective_shift": 6,   // 視点転換の優先度
      "summarize": 5,          // 要約促進の優先度
      "conclude": 9            // 結論誘導の優先度
    },
    "interventionCooldown": 2   // ファシリテーター介入のクールダウン
  }
}
```

## 設定の説明

### Memory（記憶管理）
- **maxRecentMessages**: 圧縮せずに保持する直近のメッセージ数。多すぎるとトークン消費が増加。
- **tokenThreshold**: この値を超えると古いメッセージを圧縮。大きすぎると遅延、小さすぎると頻繁な圧縮。
- **compressionRatio**: 圧縮後のサイズ比率。小さいほど積極的に圧縮（情報損失のリスク）。

### Consensus（合意形成）
- **convergenceThreshold**: この満足度を超えると議論終了の候補。高すぎると永続対話。
- **maxRounds**: 強制終了までの最大ラウンド数。コスト制御の最後の手段。
- **minSatisfactionLevel**: 強制終了時に必要な最低満足度。品質保証の閾値。

### Facilitator（ファシリテーター）
- **actionPriority**: 各アクションの重要度。高いほど優先実行。
- **interventionCooldown**: 連続介入を防ぐクールダウン期間。

## 設定変更の手順

1. `v2-settings.json`を編集
2. サーバーを再起動（設定は起動時に読み込まれます）
3. ログで設定値を確認

## デフォルト動作

設定ファイルが見つからない場合、システムは自動的にデフォルト設定を使用します。設定の一部のみ指定した場合、残りはデフォルト値で補完されます。

## トラブルシューティング

### 設定ファイルが読み込まれない
- ファイルパス: `config/v2-settings.json`
- JSON形式が正しいか確認
- ファイルの読み取り権限を確認

### 設定値が無効
- 各パラメータの有効範囲を確認
- サーバーログで検証エラーメッセージを確認
- 無効な設定があってもデフォルト値で動作継続

### パフォーマンス調整
- **応答が遅い**: tokenThresholdを下げる、maxRoundsを制限
- **記憶が不十分**: maxRecentMessagesを増やす、compressionRatioを上げる
- **議論が長すぎる**: convergenceThresholdを下げる、maxRoundsを制限