# テスト実行ガイド

## 単体テスト (Vitest)

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:ui

# カバレッジ付き
npm run test:coverage
```

## E2Eテスト (Selenium)

```bash
# 個別テスト
npm run test:console
npm run test:system
npm run test:progression
npm run test:stage-indicator
```

## テストファイルの場所

- 単体テスト: `src/**/*.test.ts`
- E2Eテスト: `selenium-tests/*.cjs`

## デバッグ

Vitestの `--reporter=verbose` オプションで詳細出力。
