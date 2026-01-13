---
name: create-agent
description: Create new AI agent implementations for the Yui Protocol system. Use when adding agents like Yui, Eiro, Kanshi.
allowed-tools: Read, Write, Glob, Grep
model: sonnet
---

# Create Agent Skill

新しいエージェントを作成するためのスキル。

## 手順

1. **ファイル作成**: `src/agents/agent-[name].ts` を作成
2. **BaseAgent継承**: `src/agents/base-agent.ts` を参照
3. **プロンプト定義**: `src/templates/prompts.ts` または `v2-prompts.ts` にテンプレート追加
4. **AgentManager登録**: `src/kernel/services/agent-manager.ts` に登録

## テンプレート

```typescript
import { BaseAgent } from './base-agent.js';
import { ConversationContext, AgentResponse } from '../types/index.js';

export class Agent[Name] extends BaseAgent {
  constructor() {
    super('[name]', '[日本語名]');
  }

  async generateResponse(context: ConversationContext): Promise<AgentResponse> {
    // 実装
  }
}
```

## 注意事項

- エージェントの個性を明確に定義する
- 他のエージェントとの差別化を意識
- ESMインポートには `.js` 拡張子が必要
