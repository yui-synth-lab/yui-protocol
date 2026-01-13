# ビルドとデプロイ

## ビルド手順

```bash
# クリーンビルド
npm run clean && npm run build

# 開発ビルド（ウォッチモード）
npm run dev
```

## ビルド成果物

```text
dist/
├── client/     # Viteビルドのフロントエンド
└── server/     # tscビルドのバックエンド
```

## よくある問題

### ESM関連エラー

このプロジェクトはESM (`"type": "module"`) を使用。importには拡張子 `.js` が必要。

### 型エラー

`npm run build` で型チェックが実行される。`tsconfig.server.json` がサーバー側の設定。
