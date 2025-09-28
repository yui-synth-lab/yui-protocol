import fs from 'fs';
import path from 'path';
import { V2Settings, DEFAULT_V2_SETTINGS } from '../types/v2-config.js';

export class V2ConfigLoader {
  private static instance: V2ConfigLoader;
  private config: V2Settings;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'v2-settings.json');
    this.config = this.loadConfig();
  }

  public static getInstance(): V2ConfigLoader {
    if (!V2ConfigLoader.instance) {
      V2ConfigLoader.instance = new V2ConfigLoader();
    }
    return V2ConfigLoader.instance;
  }

  private loadConfig(): V2Settings {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const parsedConfig = JSON.parse(configData) as Partial<V2Settings>;

        // デフォルト設定とマージ（部分的な設定ファイルにも対応）
        return this.mergeWithDefaults(parsedConfig);
      } else {
        console.warn(`[V2Config] 設定ファイルが見つかりません: ${this.configPath}`);
        console.warn('[V2Config] デフォルト設定を使用します');
        return DEFAULT_V2_SETTINGS;
      }
    } catch (error) {
      console.error(`[V2Config] 設定ファイルの読み込みに失敗: ${error}`);
      console.error('[V2Config] デフォルト設定を使用します');
      return DEFAULT_V2_SETTINGS;
    }
  }

  private mergeWithDefaults(partial: Partial<V2Settings>): V2Settings {
    return {
      memory: {
        ...DEFAULT_V2_SETTINGS.memory,
        ...partial.memory
      },
      consensus: {
        ...DEFAULT_V2_SETTINGS.consensus,
        ...partial.consensus
      },
      facilitator: {
        ...DEFAULT_V2_SETTINGS.facilitator,
        ...partial.facilitator,
        actionPriority: {
          ...DEFAULT_V2_SETTINGS.facilitator.actionPriority,
          ...partial.facilitator?.actionPriority
        }
      }
    };
  }

  public getConfig(): V2Settings {
    return this.config;
  }

  public getMemoryConfig(): V2Settings['memory'] {
    return this.config.memory;
  }

  public getConsensusConfig(): V2Settings['consensus'] {
    return this.config.consensus;
  }

  public getFacilitatorConfig(): V2Settings['facilitator'] {
    return this.config.facilitator;
  }

  public reloadConfig(): V2Settings {
    console.log('[V2Config] 設定ファイルを再読み込み中...');
    this.config = this.loadConfig();
    console.log('[V2Config] 設定ファイルの再読み込み完了');
    return this.config;
  }

  public validateConfig(): boolean {
    const config = this.config;

    try {
      // Memory設定の検証
      if (config.memory.maxRecentMessages < 1 || config.memory.maxRecentMessages > 20) {
        throw new Error('maxRecentMessages は 1-20 の範囲である必要があります');
      }
      if (config.memory.tokenThreshold < 1000 || config.memory.tokenThreshold > 50000) {
        throw new Error('tokenThreshold は 1000-50000 の範囲である必要があります');
      }
      if (config.memory.compressionRatio < 0.1 || config.memory.compressionRatio > 1.0) {
        throw new Error('compressionRatio は 0.1-1.0 の範囲である必要があります');
      }

      // Consensus設定の検証
      if (config.consensus.convergenceThreshold < 5.0 || config.consensus.convergenceThreshold > 10.0) {
        throw new Error('convergenceThreshold は 5.0-10.0 の範囲である必要があります');
      }
      if (config.consensus.maxRounds < 5 || config.consensus.maxRounds > 50) {
        throw new Error('maxRounds は 5-50 の範囲である必要があります');
      }
      if (config.consensus.minSatisfactionLevel < 1 || config.consensus.minSatisfactionLevel > 10) {
        throw new Error('minSatisfactionLevel は 1-10 の範囲である必要があります');
      }

      // Facilitator設定の検証
      const priorities = config.facilitator.actionPriority;
      Object.values(priorities).forEach((priority, index) => {
        if (priority < 1 || priority > 10) {
          const key = Object.keys(priorities)[index];
          throw new Error(`actionPriority.${key} は 1-10 の範囲である必要があります`);
        }
      });

      if (config.facilitator.interventionCooldown < 0 || config.facilitator.interventionCooldown > 10) {
        throw new Error('interventionCooldown は 0-10 の範囲である必要があります');
      }

      return true;
    } catch (error) {
      console.error(`[V2Config] 設定の検証に失敗: ${error}`);
      return false;
    }
  }

  public logCurrentConfig(): void {
    console.log('[V2Config] 現在の設定:');
    console.log(JSON.stringify(this.config, null, 2));
  }
}

// Singleton インスタンス取得のヘルパー関数
export function getV2Config(): V2Settings {
  return V2ConfigLoader.getInstance().getConfig();
}

export function getV2MemoryConfig(): V2Settings['memory'] {
  return V2ConfigLoader.getInstance().getMemoryConfig();
}

export function getV2ConsensusConfig(): V2Settings['consensus'] {
  return V2ConfigLoader.getInstance().getConsensusConfig();
}

export function getV2FacilitatorConfig(): V2Settings['facilitator'] {
  return V2ConfigLoader.getInstance().getFacilitatorConfig();
}