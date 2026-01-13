---
name: implement-v2
description: Implement v2.0 dynamic dialogue features for Yui Protocol. Use when working on memory hierarchy, consensus system, or facilitator agent.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Implement V2 Feature Skill

v2.0動的対話システムの機能を実装するスキル。

## 重要原則

1. **後方互換性**: v1.0を破壊しない
2. **段階的追加**: 既存コードを修正ではなく拡張
3. **テスト必須**: 新機能には必ずテスト追加

## 主要コンポーネント

| ファイル | 役割 |
|----------|------|
| `src/kernel/dynamic-router.ts` | 動的対話ルーター |
| `src/kernel/memory-manager.ts` | 記憶階層化 |
| `src/agents/facilitator-agent.ts` | 対話進行管理 |
| `src/types/consensus.ts` | 納得度システム型 |
| `src/types/memory.ts` | 記憶システム型 |

## 実装パターン

```typescript
// 既存機能を保持しつつ拡張
export class YuiProtocolRouter {
  // v1.0メソッド（変更しない）
  async runStageBasedDialogue() { ... }

  // v2.0メソッド（新規追加）
  async runDynamicDialogue() { ... }
}
```

## 詳細計画

[docs/v2-implementation-plan.md](../../../docs/v2-implementation-plan.md) を参照
