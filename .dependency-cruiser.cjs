/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        '循環依存の禁止（リファクタリング計画 Phase 1 完了条件）。' +
        '動的import経由の意図的な循環（ai-executor → ai-executor-impl）のみ許容する。',
      from: {},
      to: {
        circular: true,
        // 全エッジが静的importの循環のみ違反とする（動的import経由の循環は許容）
        viaOnly: { dependencyTypesNot: ['dynamic-import'] }
      }
    },
    {
      name: 'types-must-stay-foundation',
      severity: 'error',
      comment: 'types/ は基盤層。templates/kernel/agents/server/ui に依存してはならない。',
      from: { path: '^src/types' },
      to: { path: '^src/(templates|kernel|agents|server|ui)' }
    },
    {
      name: 'kernel-must-not-import-agents',
      severity: 'error',
      comment:
        'orchestration(kernel) はエージェント具象に依存しない（Phase 2）。' +
        '具象生成は src/agents/registry.ts + src/bootstrap/ に集約。' +
        'facilitator-agent.ts への依存のみ（デフォルト構築のため）暫定許容 — ' +
        'FacilitatorPort 経由の注入が標準経路（bootstrap/createDynamicRouter）。',
      from: { path: '^src/kernel' },
      to: { path: '^src/agents', pathNot: '^src/agents/facilitator-agent\\.ts$' }
    },
    {
      name: 'storage-must-not-depend-on-rag',
      severity: 'error',
      comment:
        '永続化層は RAG を知らない（Phase 4）。RAG 自動インデックスは bootstrap が ' +
        'OutputSavedListener として配線する。',
      from: { path: '^src/kernel/(output-storage|session-storage)\\.ts$' },
      to: { path: '^src/kernel/rag' }
    },
    {
      name: 'v1-router-must-not-depend-on-v2',
      severity: 'error',
      comment:
        'v1（router.ts）は v2（dynamic-router.ts）を参照しない（Phase 4 / 設計原則1: v1.0 must never break）。' +
        '両ルーターは server + bootstrap が対等に保持する。',
      from: { path: '^src/kernel/router\\.ts$' },
      to: { path: '^src/kernel/dynamic-router\\.ts$' }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.node.json' },
    exclude: { path: '\\.(test|spec)\\.ts$' }
  }
};
