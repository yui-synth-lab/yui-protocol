import { AIExecutor, AIExecutorOptions, createAIExecutor } from './ai-executor.js';
import type { ExecutorFactory, TaskTier } from '../dialogue/contracts.js';

/**
 * AIExecutor を (agentId, tier, provider, model) 単位でキャッシュするファクトリ（コスト削減 M8）。
 * 呼び出し毎の executor 生成（ローカルLLMではモデル再ロード）を排除する。
 */
export class CachingExecutorFactory implements ExecutorFactory {
  private cache = new Map<string, Promise<AIExecutor>>();

  async getExecutor(
    agentId: string,
    options?: Partial<AIExecutorOptions>,
    tier: TaskTier = 'reasoning'
  ): Promise<AIExecutor> {
    const key = `${agentId}::${tier}::${options?.provider ?? 'default'}::${options?.model ?? 'default'}`;
    let executorPromise = this.cache.get(key);
    if (!executorPromise) {
      executorPromise = createAIExecutor(agentId, options);
      this.cache.set(key, executorPromise);
    }
    return executorPromise;
  }

  clear(): void {
    this.cache.clear();
  }
}

/** 既定のプロセス共有ファクトリ。テストや特殊構成では個別にインスタンス化して注入する */
export const defaultExecutorFactory = new CachingExecutorFactory();
