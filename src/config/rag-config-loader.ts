import * as fs from 'fs';
import * as path from 'path';
import { RAGConfig } from '../types/rag.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default RAG configuration
const DEFAULT_RAG_CONFIG: RAGConfig = {
  enabled: false,
  vectorStore: {
    storePath: './data/vector-store',
    embeddingDimension: 1536,
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-3-small',
    distanceMetric: 'cosine'
  },
  ingestion: {
    chunkSize: 500,
    chunkOverlap: 50,
    enableMetadataExtraction: true,
    supportedFileTypes: ['.txt', '.md', '.json'],
    batchSize: 10
  },
  retrieval: {
    defaultTopK: 5,
    defaultMinScore: 0.5,
    maxContextTokens: 2000,
    enableReranking: true
  },
  indexing: {
    autoIndexSessions: true,
    autoIndexLocalDocs: false,
    autoIndexOutputs: true
  }
};

let cachedConfig: RAGConfig | null = null;

/**
 * Load RAG configuration from file
 */
export function loadRAGConfig(): RAGConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = path.resolve(__dirname, '../../config/rag-config.json');

    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);

      // Merge with default config
      cachedConfig = {
        ...DEFAULT_RAG_CONFIG,
        ...loadedConfig,
        vectorStore: {
          ...DEFAULT_RAG_CONFIG.vectorStore,
          ...(loadedConfig.vectorStore || {})
        },
        ingestion: {
          ...DEFAULT_RAG_CONFIG.ingestion,
          ...(loadedConfig.ingestion || {})
        },
        retrieval: {
          ...DEFAULT_RAG_CONFIG.retrieval,
          ...(loadedConfig.retrieval || {})
        },
        indexing: {
          ...DEFAULT_RAG_CONFIG.indexing,
          ...(loadedConfig.indexing || {})
        }
      };

      console.log('[RAGConfig] Loaded RAG configuration from:', configPath);
      console.log('[RAGConfig] RAG enabled:', cachedConfig!.enabled);

      return cachedConfig!;
    } else {
      console.warn('[RAGConfig] Config file not found, using default configuration');
      cachedConfig = DEFAULT_RAG_CONFIG;
      return cachedConfig;
    }
  } catch (error) {
    console.error('[RAGConfig] Failed to load configuration:', error);
    cachedConfig = DEFAULT_RAG_CONFIG;
    return cachedConfig;
  }
}

/**
 * Get current RAG configuration
 */
export function getRAGConfig(): RAGConfig {
  if (!cachedConfig) {
    return loadRAGConfig();
  }
  return cachedConfig;
}

/**
 * Update RAG configuration
 */
export function updateRAGConfig(updates: Partial<RAGConfig>): RAGConfig {
  const currentConfig = getRAGConfig();

  cachedConfig = {
    ...currentConfig,
    ...updates,
    vectorStore: {
      ...currentConfig.vectorStore,
      ...(updates.vectorStore || {})
    },
    ingestion: {
      ...currentConfig.ingestion,
      ...(updates.ingestion || {})
    },
    retrieval: {
      ...currentConfig.retrieval,
      ...(updates.retrieval || {})
    },
    indexing: {
      ...currentConfig.indexing,
      ...(updates.indexing || {})
    }
  };

  console.log('[RAGConfig] Configuration updated');
  return cachedConfig;
}

/**
 * Save current configuration to file
 */
export function saveRAGConfig(config?: RAGConfig): void {
  const configToSave = config || cachedConfig || DEFAULT_RAG_CONFIG;

  try {
    const configPath = path.resolve(__dirname, '../../config/rag-config.json');
    const configDir = path.dirname(configPath);

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    console.log('[RAGConfig] Configuration saved to:', configPath);
  } catch (error) {
    console.error('[RAGConfig] Failed to save configuration:', error);
    throw new Error(`Failed to save RAG configuration: ${error}`);
  }
}

/**
 * Reset configuration to default
 */
export function resetRAGConfig(): RAGConfig {
  cachedConfig = { ...DEFAULT_RAG_CONFIG };
  console.log('[RAGConfig] Configuration reset to default');
  return cachedConfig;
}

/**
 * Check if RAG is enabled
 */
export function isRAGEnabled(): boolean {
  const config = getRAGConfig();
  return config.enabled;
}
