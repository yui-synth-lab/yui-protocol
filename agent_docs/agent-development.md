# エージェント開発ガイド

## エージェントの構造

すべてのエージェントは `BaseAgent` を継承:

```typescript
// src/agents/base-agent.ts
export abstract class BaseAgent {
  abstract generateResponse(context: ConversationContext): Promise<AgentResponse>;
}
```

## 既存エージェント

| エージェント | 役割 | ファイル |
|--------------|------|----------|
| Yui | 調停者・まとめ役 | `agent-yui.ts` |
| Eiro | 論理的思考 | `agent-eiro.ts` |
| Kanshi | 感性的視点 | `agent-kanshi.ts` |
| Yoga | 実践的観点 | `agent-yoga.ts` |
| Hekito | 批判的検証 | `agent-hekito.ts` |
| Facilitator | 対話進行管理 | `facilitator-agent.ts` |

## 新規エージェント追加手順

1. `src/agents/agent-[name].ts` を作成
2. `BaseAgent` を継承
3. `AgentManager` に登録
4. プロンプトテンプレートを `src/templates/` に追加

## 個性の表現

各エージェントは独自の:

- 思考スタイル（プロンプトで定義）
- 記憶パターン（MemoryManagerで管理）
- 応答トーン
