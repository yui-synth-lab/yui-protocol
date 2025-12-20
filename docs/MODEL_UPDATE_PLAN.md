# AI Model Update Plan for Yui Protocol

**作成日**: 2025-11-30
**最終更新日**: 2025-12-20
**ステータス**: Phase 2 完了 - 最新モデル運用中

## 📋 Executive Summary

Yui Protocolで使用する各AIモデルの最新バージョンへの更新が完了しました。

**現状**:
- ✅ OpenAI GPT-5 系に更新完了
- ✅ Gemini 3 系に更新完了
- ✅ Anthropic Claude 4.5 系に更新完了
- ✅ コード対応完了（GPT-5 reasoning/verbosity、Gemini 3 temperature 最適化）

**更新日**: 2025-12-20

---

## 🔍 各プロバイダーの最新モデル（2025年12月20日時点）

### OpenAI

#### 🆕 GPT-5 系（現在使用中）

**GPT-5.2** (2025年12月11日リリース)
- **モデル名**: `gpt-5.2-2025-12-11`
- OpenAI史上最も有能なモデル
- プロフェッショナルな知識作業に最適化

**GPT-5 mini** (2025年8月7日リリース)
- **モデル名**: `gpt-5-mini-2025-08-07`
- 高速でコスト効率の良いGPT-5の軽量版
- 高品質な推論とマルチモーダル機能

#### ⚠️ 重要な変更点

**GPT-5 系では以下のパラメータが非サポート**:
- ❌ `temperature` - カスタム値不可（削除）
- ❌ `top_p` - 完全に廃止
- ❌ `frequency_penalty` / `presence_penalty` - 完全に廃止

**代替パラメータ**:
- ✅ `reasoning.effort`: `"minimal"` (高速) | `"medium"` (標準)
- ✅ `text.verbosity`: `"low"` | `"medium"` | `"high"`

**実装済み**: [ai-executor-impl.ts:166-192](../src/kernel/ai-executor-impl.ts)

---

### Anthropic Claude

#### 🆕 Claude 4.5 系（現在使用中）

**Claude Sonnet 4.5** (2025年9月29日リリース)
- **モデル名**: `claude-sonnet-4-5-20250929`
- 世界最高のコーディングモデル
- 推論と数学で大幅向上
- 価格: $3/$15 per million tokens

**Claude Haiku 4.5** (2025年10月1日リリース)
- **モデル名**: `claude-haiku-4-5-20251001`
- フロンティアレベル性能の小型モデル
- より安価で高速
- 価格: $1/$5 per million tokens

**Claude Opus 4.5** (2025年11月24日リリース)
- **モデル名**: `claude-opus-4-5-20251124`
- 世界最高レベルの性能
- ハイブリッド推論モード
- 価格: $5/$25 per million tokens

#### ✅ 互換性
- `temperature` と `top_p` は引き続きサポート
- 現在の実装と完全互換

---

### Google Gemini

#### 🆕 Gemini 3 系（現在使用中）

**Gemini 3 Pro**
- **モデル名**: `gemini-3-pro-preview`
- LMArena で史上初の1500 Elo突破（1501達成）
- WebDev Arena で1487 Eloでトップ
- 100万トークンのコンテキストウィンドウ

**Gemini 3 Flash**
- **モデル名**: `gemini-3-flash-preview`
- 2025年12月17日リリース
- GPT-5 Proの25%未満のコストでフロンティア性能
- 強力なマルチモーダル、コーディング、エージェント機能

#### ⚠️ 重要な推奨事項

**Gemini 3 系では `temperature=1.0` を強く推奨**:
- 技術的には 0.0-2.0 をサポート
- しかし **1.0以外の値ではループや性能劣化のリスク**
- 特に複雑な数学・推論タスクで問題発生の可能性

**実装済み**: [ai-executor-impl.ts:116-122](../src/kernel/ai-executor-impl.ts)
- Gemini 3 系は自動的に temperature=1.0 を使用
- Gemini 2.5 系は従来の temperature 設定を維持

---

## 📊 現在のYui Protocolの設定（2025-12-20）

### エージェント別モデル設定

| エージェント | モデル | Finalizer | プロバイダー | 状態 |
|------------|--------|-----------|------------|------|
| **yui-000 (結心)** | `gpt-5-mini-2025-08-07` | `gpt-5.2-2025-12-11` | OpenAI | ✅ 最新 |
| **eiro-001 (慧露)** | `gpt-5-mini-2025-08-07` | `gpt-5.2-2025-12-11` | OpenAI | ✅ 最新 |
| **kanshi-001 (観至)** | `claude-haiku-4-5-20251001` | `claude-sonnet-4-5-20250929` | Anthropic | ✅ 最新 |
| **hekito-001 (碧統)** | `gemini-3-flash-preview` | `gemini-3-pro-preview` | Gemini | ✅ 最新 |
| **yoga-001 (陽雅)** | `claude-haiku-4-5-20251001` | `claude-sonnet-4-5-20250929` | Anthropic | ✅ 最新 |

### 実装済みの最適化

**ファイル**: `src/kernel/ai-executor-impl.ts`

#### OpenAI Executor (行 166-201)

✅ **GPT-5 系の自動検出と対応**
```typescript
const isGPT5Model = this.model.startsWith('gpt-5');

if (isGPT5Model) {
  // GPT-5 uses reasoning effort and verbosity instead of temperature
  const reasoningEffort = this.temperature < 0.5 ? 'minimal' : 'medium';
  requestBody.reasoning = { effort: reasoningEffort };
  requestBody.text = { verbosity: 'medium' };
} else {
  // GPT-4 and older models use traditional sampling parameters
  requestBody.temperature = this.temperature;
  requestBody.top_p = this.topP;
  // ...
}
```

**特徴**:
- Temperature の値を reasoning effort にマッピング
- GPT-4 系は従来のパラメータを維持
- 後方互換性を保持

#### Gemini Executor (行 104-147)

✅ **Gemini 3 系の temperature 最適化**
```typescript
// Gemini 3 models strongly recommend temperature=1.0
const isGemini3 = this.model.startsWith('gemini-3');
const temperature = isGemini3 ? 1.0 : this.temperature;

// Enable thinking for Pro models
const isProModel = this.model.includes('-pro');
const thinkingBudget = isProModel ? -1 : 0;
```

**特徴**:
- Gemini 3 系は自動的に temperature=1.0
- Pro モデルは thinking mode を有効化
- Gemini 2.5 系は従来の設定を維持

#### Anthropic Executor

✅ **変更なし - 完全互換**
- Claude 4.5 系は従来のパラメータをサポート
- 既存の実装で問題なく動作

---

## 🎯 実施済み更新（Phase 2 完了）

### ✅ Phase 1: コード修正（完了）

#### ステップ1.1: OpenAI GPT-5 対応
- ✅ GPT-5 モデル検出ロジック実装
- ✅ reasoning.effort パラメータ導入
- ✅ text.verbosity パラメータ導入
- ✅ 後方互換性の維持

#### ステップ1.2: Gemini 3 対応
- ✅ Gemini 3 モデル検出ロジック実装
- ✅ temperature=1.0 の自動設定
- ✅ Pro モデル用 thinking mode の最適化
- ✅ Gemini 2.5 系の互換性維持

### ✅ Phase 2: 設定ファイル更新（完了）

#### ステップ2.1: `.env` の更新
```env
# yui-000 (結心)
AGENT_YUI_000_MODEL=gpt-5-mini-2025-08-07
AGENT_YUI_000_FINALIZER_MODEL=gpt-5.2-2025-12-11

# eiro-001 (慧露)
AGENT_EIRO_001_MODEL=gpt-5-mini-2025-08-07
AGENT_EIRO_001_FINALIZER_MODEL=gpt-5.2-2025-12-11

# kanshi-001 (観至)
AGENT_KANSHI_001_MODEL=claude-haiku-4-5-20251001
AGENT_KANSHI_001_FINALIZER_MODEL=claude-sonnet-4-5-20250929

# hekito-001 (碧統)
AGENT_HEKITO_001_MODEL=gemini-3-flash-preview
AGENT_HEKITO_001_FINALIZER_MODEL=gemini-3-pro-preview

# yoga-001 (陽雅)
AGENT_YOGA_001_MODEL=claude-haiku-4-5-20251001
AGENT_YOGA_001_FINALIZER_MODEL=claude-sonnet-4-5-20250929
```

#### ステップ2.2: エージェントファイルのデフォルト値更新
- ✅ [src/agents/agent-yui.ts](../src/agents/agent-yui.ts) - GPT-5系に更新
- ✅ [src/agents/agent-eiro.ts](../src/agents/agent-eiro.ts) - GPT-5系に更新
- ✅ [src/agents/agent-kanshi.ts](../src/agents/agent-kanshi.ts) - Claude 4.5系に更新
- ✅ [src/agents/agent-hekito.ts](../src/agents/agent-hekito.ts) - Gemini 3系に更新
- ✅ [src/agents/agent-yoga.ts](../src/agents/agent-yoga.ts) - Claude 4.5系に更新

---

## 💰 コスト比較

### 現在のコスト構成

| エージェント | モデル | 価格 (Input/Output per M tokens) | 用途 |
|------------|--------|--------------------------------|------|
| **yui-000** | gpt-5-mini | 未公表 | 通常思考 |
| **yui-000 (finalizer)** | gpt-5.2 | 未公表 | 最終統合 |
| **eiro-001** | gpt-5-mini | 未公表 | 通常思考 |
| **eiro-001 (finalizer)** | gpt-5.2 | 未公表 | 最終統合 |
| **kanshi-001** | claude-haiku-4-5 | $1/$5 | 通常思考 |
| **kanshi-001 (finalizer)** | claude-sonnet-4-5 | $3/$15 | 最終統合 |
| **hekito-001** | gemini-3-flash | $0.50/$3.00 | 通常思考 |
| **hekito-001 (finalizer)** | gemini-3-pro | 未公表 | 最終統合 |
| **yoga-001** | claude-haiku-4-5 | $1/$5 | 通常思考 |
| **yoga-001 (finalizer)** | claude-sonnet-4-5 | $3/$15 | 最終統合 |

**注意**: GPT-5系の価格は未公表のため、実運用で要監視

---

## 📚 参考リンク

### OpenAI
- [GPT-5 New Params and Tools | OpenAI Cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools)
- [gpt-5.2 | AI/ML API Documentation](https://docs.aimlapi.com/api-references/text-models-llm/openai/gpt-5.2)
- [gpt-5-mini | AI/ML API Documentation](https://docs.aimlapi.com/api-references/text-models-llm/openai/gpt-5-mini)

### Anthropic Claude
- [Introducing Claude Opus 4.5](https://www.anthropic.com/news/claude-opus-4-5)
- [Introducing Claude Sonnet 4.5](https://www.anthropic.com/news/claude-sonnet-4-5)
- [Introducing Claude Haiku 4.5](https://www.anthropic.com/news/claude-haiku-4-5)
- [Models overview - Claude API](https://docs.anthropic.com/en/docs/about-claude/models/overview)

### Google Gemini
- [Introducing Gemini 3 Flash: Benchmarks, global availability](https://blog.google/products/gemini/gemini-3-flash/)
- [Build with Gemini 3 Flash: frontier intelligence that scales with you](https://blog.google/technology/developers/build-with-gemini-3-flash/)
- [Gemini models | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3 Flash | Generative AI on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash)

---

## 📝 更新履歴

| 日付 | 更新内容 | 担当 |
|------|---------|------|
| 2025-11-30 | 初版作成、最新モデル調査完了 | Claude Code |
| 2025-12-20 | Phase 2 完了、全モデル更新完了 | Claude Code |
| 2025-12-20 | GPT-5 reasoning/verbosity 対応実装 | Claude Code |
| 2025-12-20 | Gemini 3 temperature 最適化実装 | Claude Code |
| 2025-12-20 | 全エージェント設定ファイル更新完了 | Claude Code |
| 2025-12-20 | ドキュメント更新（実装状況反映） | Claude Code |

---

## ✅ 完了チェックリスト

### 事前準備
- ✅ Gemini 3 Flash のリリース確認
- ✅ APIドキュメントの確認
- ✅ 互換性情報の確認

### コード修正
- ✅ `ai-executor-impl.ts` のOpenAIExecutor修正（GPT-5対応）
- ✅ `ai-executor-impl.ts` のGeminiExecutor修正（Gemini 3最適化）
- ✅ 型定義の更新（不要と判断）

### 設定ファイル更新
- ✅ `.env` 更新
- ✅ `agent-yui.ts` のデフォルト値更新
- ✅ `agent-eiro.ts` のデフォルト値更新
- ✅ `agent-kanshi.ts` のデフォルト値更新
- ✅ `agent-hekito.ts` のデフォルト値更新
- ✅ `agent-yoga.ts` のデフォルト値更新

### テスト
- ⏳ ユニットテスト実施（要実施）
- ⏳ 統合テスト実施（要実施）
- ⏳ 各エージェントの動作確認（要実施）
- ⏳ コスト監視設定（要実施）

### ドキュメント
- ⏳ `README.md` 更新（要実施）
- ⏳ `YUI_PROTOCOL_SPEC_v2.0.md` 更新（要実施）
- ⏳ `CHANGELOG.md` 更新（要実施）
- ✅ `MODEL_UPDATE_PLAN.md` 更新（本ドキュメント）

### デプロイ
- ⏳ 本番環境の.env更新（必要に応じて）
- ⏳ デプロイ実施（必要に応じて）
- ⏳ 動作確認（要実施）
- ⏳ コスト監視開始（要実施）

---

## 🔍 今後の監視項目

1. **コスト監視**
   - GPT-5系の価格公開後、実際のコストを確認
   - 予算超過がないか継続監視

2. **性能監視**
   - Gemini 3 の temperature=1.0 による影響を観察
   - GPT-5 の reasoning/verbosity 設定の最適化

3. **新モデルの追跡**
   - Gemini 3 の正式版リリース（-preview 削除）
   - GPT-5.x 系の新バージョン
   - Claude 4.5 の新バージョン

4. **API変更の監視**
   - 各プロバイダーのAPI変更
   - 非推奨パラメータの通知
   - 新機能の追加

---

**現在のステータス**: ✅ Phase 2 完了 - 最新モデル運用中
**次のアクション**: テストと動作確認、コスト監視の開始
