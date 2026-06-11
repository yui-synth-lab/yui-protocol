// エージェントロースターの単一情報源。
// 具象エージェントクラスの import はこのファイルに集約する（kernel からは import しない）。
// 新しいエージェントを追加する場合はここに 1 エントリ追加するだけでよい。
import { EiroAgent } from './agent-eiro.js';
import { KanshiAgent } from './agent-kanshi.js';
import { YogaAgent } from './agent-yoga.js';
import { HekitoAgent } from './agent-hekito.js';
import { YuiAgent } from './agent-yui.js';
import type { AgentFactory } from '../dialogue/contracts.js';

export function createDefaultAgentFactories(): AgentFactory[] {
  return [
    { id: 'eiro-001', create: (logger, rag) => new EiroAgent(logger, rag) },
    { id: 'kanshi-001', create: (logger, rag) => new KanshiAgent(logger, rag) },
    { id: 'yoga-001', create: (logger, rag) => new YogaAgent(logger, rag) },
    { id: 'hekito-001', create: (logger, rag) => new HekitoAgent(logger, rag) },
    { id: 'yui-000', create: (logger, rag) => new YuiAgent(logger, rag) }
  ];
}

/** 既定エージェントの ID 一覧（ファシリテーター等のフォールバック用） */
export const DEFAULT_AGENT_IDS: string[] = createDefaultAgentFactories().map(f => f.id);
