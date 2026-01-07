import { config } from 'dotenv';
import { RAGRetriever } from './rag-retriever.js';
import { RAGConfig, SessionHistoryDocument } from '../../types/rag.js';
import { Message, DialogueStage } from '../../types/index.js';
import { loadRAGConfig } from '../../config/rag-config-loader.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
config();

/**
 * RAG system manager - handles initialization and lifecycle
 */
export class RAGManager {
  private static instance: RAGManager | null = null;
  private ragRetriever: RAGRetriever | null = null;
  private config: RAGConfig;
  private initialized: boolean = false;
  private indexingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = loadRAGConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RAGManager {
    if (!RAGManager.instance) {
      RAGManager.instance = new RAGManager();
    }
    return RAGManager.instance;
  }

  /**
   * Initialize RAG system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[RAGManager] Already initialized');
      return;
    }

    if (!this.config.enabled) {
      console.log('[RAGManager] RAG is disabled');
      return;
    }

    try {
      console.log('[RAGManager] Initializing RAG system...');

      this.ragRetriever = new RAGRetriever(this.config);
      await this.ragRetriever.initialize();

      // Set up automatic indexing if enabled
      if (this.config.indexing.autoIndexLocalDocs && this.config.indexing.indexingInterval) {
        this.startAutoIndexing();
      }

      this.initialized = true;
      console.log('[RAGManager] RAG system initialized successfully');
    } catch (error) {
      console.error('[RAGManager] Failed to initialize:', error);
      throw new Error(`Failed to initialize RAG manager: ${error}`);
    }
  }

  /**
   * Get RAG retriever instance
   */
  getRetriever(): RAGRetriever | null {
    if (!this.initialized || !this.ragRetriever) {
      console.warn('[RAGManager] RAG system not initialized or disabled');
      return null;
    }
    return this.ragRetriever;
  }

  /**
   * Index session messages automatically
   */
  async indexSessionMessages(sessionId: string, messages: Message[]): Promise<number> {
    if (!this.initialized || !this.ragRetriever || !this.config.indexing.autoIndexSessions) {
      return 0;
    }

    try {
      // Convert messages to session history documents
      const historyDocs: SessionHistoryDocument[] = messages
        .filter(msg => msg.role === 'agent' && msg.agentId && msg.content)
        .map(msg => ({
          sessionId,
          agentId: msg.agentId!,
          stage: msg.stage || 'unknown',
          content: msg.content,
          timestamp: msg.timestamp || new Date(),
          metadata: {
            confidence: (msg as any).confidence,
            reasoning: (msg as any).reasoning,
            references: (msg as any).references
          }
        }));

      if (historyDocs.length === 0) {
        console.log(`[RAGManager] No indexable messages in session ${sessionId}`);
        return 0;
      }

      const chunksIndexed = await this.ragRetriever.indexSessionHistory(historyDocs);
      console.log(`[RAGManager] Indexed ${chunksIndexed} chunks from ${historyDocs.length} messages in session ${sessionId}`);

      return chunksIndexed;
    } catch (error) {
      console.error('[RAGManager] Failed to index session messages:', error);
      return 0;
    }
  }

  /**
   * Index local documents from configured directories
   */
  async indexLocalDocuments(): Promise<number> {
    if (!this.initialized || !this.ragRetriever) {
      return 0;
    }

    let totalChunks = 0;

    try {
      const watchDirs = this.config.indexing.watchDirectories || [];

      for (const dir of watchDirs) {
        try {
          // Check if directory exists
          const dirPath = path.resolve(dir);
          await fs.access(dirPath);

          console.log(`[RAGManager] Indexing directory: ${dirPath}`);
          const chunks = await this.ragRetriever.indexDirectory(dirPath, true);
          totalChunks += chunks;
        } catch (error) {
          console.warn(`[RAGManager] Skipping directory ${dir}:`, error);
        }
      }

      console.log(`[RAGManager] Indexed ${totalChunks} chunks from local documents`);
      return totalChunks;
    } catch (error) {
      console.error('[RAGManager] Failed to index local documents:', error);
      return totalChunks;
    }
  }

  /**
   * Start automatic indexing
   */
  private startAutoIndexing(): void {
    if (this.indexingInterval) {
      console.warn('[RAGManager] Auto-indexing already started');
      return;
    }

    const intervalMinutes = this.config.indexing.indexingInterval || 60;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`[RAGManager] Starting auto-indexing every ${intervalMinutes} minutes`);

    this.indexingInterval = setInterval(async () => {
      console.log('[RAGManager] Running automatic indexing...');
      await this.indexLocalDocuments();
    }, intervalMs);

    // Run initial indexing
    this.indexLocalDocuments().catch(err => {
      console.error('[RAGManager] Initial indexing failed:', err);
    });
  }

  /**
   * Stop automatic indexing
   */
  stopAutoIndexing(): void {
    if (this.indexingInterval) {
      clearInterval(this.indexingInterval);
      this.indexingInterval = null;
      console.log('[RAGManager] Auto-indexing stopped');
    }
  }

  /**
   * Get RAG statistics
   */
  async getStats(): Promise<{
    isEnabled: boolean;
    isInitialized: boolean;
    totalVectors: number;
    storeSizeBytes: number;
    config: RAGConfig;
  }> {
    const stats = this.ragRetriever
      ? await this.ragRetriever.getStats()
      : {
          totalVectors: 0,
          storeSizeBytes: 0,
          isInitialized: false,
          isEnabled: false
        };

    return {
      ...stats,
      config: this.config
    };
  }

  /**
   * Shutdown RAG system
   */
  async shutdown(): Promise<void> {
    console.log('[RAGManager] Shutting down RAG system...');

    this.stopAutoIndexing();

    if (this.ragRetriever) {
      await this.ragRetriever.close();
      this.ragRetriever = null;
    }

    this.initialized = false;
    console.log('[RAGManager] RAG system shut down');
  }

  /**
   * Check if RAG is initialized and ready
   */
  isReady(): boolean {
    return this.initialized && !!this.ragRetriever;
  }
}

// Export singleton instance getter
export function getRAGManager(): RAGManager {
  return RAGManager.getInstance();
}
