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
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.node.json' },
    exclude: { path: '\\.(test|spec)\\.ts$' }
  }
};
