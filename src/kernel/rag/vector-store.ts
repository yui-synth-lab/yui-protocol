import { connect, Table, Connection } from 'vectordb';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  VectorEmbedding,
  DocumentChunk,
  VectorStoreConfig,
  RAGQuery,
  RetrievalResult
} from '../../types/rag.js';

/**
 * LanceDB-based vector store for RAG functionality
 */
export class VectorStore {
  private db: Connection | null = null;
  private table: Table | null = null;
  private config: VectorStoreConfig;
  private initialized: boolean = false;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[VectorStore] Already initialized');
      return;
    }

    try {
      // Ensure store directory exists
      await fs.mkdir(this.config.storePath, { recursive: true });

      // Connect to LanceDB
      this.db = await connect(this.config.storePath);
      console.log(`[VectorStore] Connected to LanceDB at ${this.config.storePath}`);

      // Create or open table
      try {
        this.table = await this.db.openTable('yui_knowledge');
        console.log('[VectorStore] Opened existing table: yui_knowledge');
      } catch (error) {
        // Table doesn't exist, create it
        console.log('[VectorStore] Creating new table: yui_knowledge');
        this.table = await this.db.createTable('yui_knowledge', [
          {
            id: 'init',
            vector: new Array(this.config.embeddingDimension).fill(0),
            text: 'Initialization document',
            metadata: JSON.stringify({
              source: 'system',
              sourceType: 'custom',
              createdAt: new Date().toISOString()
            })
          }
        ]);
      }

      this.initialized = true;
      console.log('[VectorStore] Initialization complete');
    } catch (error) {
      console.error('[VectorStore] Initialization failed:', error);
      throw new Error(`Failed to initialize vector store: ${error}`);
    }
  }

  /**
   * Add document chunks to the vector store
   */
  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.initialized || !this.table) {
      throw new Error('Vector store not initialized');
    }

    if (chunks.length === 0) {
      console.log('[VectorStore] No chunks to add');
      return;
    }

    try {
      const records = chunks.map(chunk => ({
        id: chunk.id,
        vector: chunk.embedding || new Array(this.config.embeddingDimension).fill(0),
        text: chunk.content,
        metadata: JSON.stringify({
          ...chunk.metadata,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          createdAt: chunk.metadata.createdAt.toISOString(),
          updatedAt: chunk.metadata.updatedAt?.toISOString()
        })
      }));

      await this.table.add(records);
      console.log(`[VectorStore] Added ${chunks.length} chunks to vector store`);
    } catch (error) {
      console.error('[VectorStore] Failed to add chunks:', error);
      throw new Error(`Failed to add chunks: ${error}`);
    }
  }

  /**
   * Search for similar documents
   */
  async search(queryVector: number[], options: {
    topK?: number;
    minScore?: number;
    filters?: RAGQuery['filters'];
  } = {}): Promise<RetrievalResult[]> {
    if (!this.initialized || !this.table) {
      throw new Error('Vector store not initialized');
    }

    try {
      const topK = options.topK || 5;

      // Perform vector search
      let query = this.table
        .search(queryVector)
        .limit(topK);

      // Apply metadata filters if provided
      if (options.filters) {
        const filterConditions: string[] = [];

        if (options.filters.sourceType && options.filters.sourceType.length > 0) {
          const types = options.filters.sourceType.map(t => `'${t}'`).join(',');
          filterConditions.push(`metadata->>'sourceType' IN (${types})`);
        }

        if (options.filters.agentId) {
          filterConditions.push(`metadata->>'agentId' = '${options.filters.agentId}'`);
        }

        if (options.filters.sessionId) {
          filterConditions.push(`metadata->>'sessionId' = '${options.filters.sessionId}'`);
        }

        if (options.filters.dateRange) {
          const start = options.filters.dateRange.start.toISOString();
          const end = options.filters.dateRange.end.toISOString();
          filterConditions.push(`metadata->>'createdAt' >= '${start}'`);
          filterConditions.push(`metadata->>'createdAt' <= '${end}'`);
        }

        if (filterConditions.length > 0) {
          const filterString = filterConditions.join(' AND ');
          query = query.where(filterString);
        }
      }

      const results = await query.execute();

      // Convert to RetrievalResult format
      const retrievalResults: RetrievalResult[] = results
        .filter((r: any) => !options.minScore || r._distance >= options.minScore)
        .map((result: any) => {
          const metadata = JSON.parse(result.metadata);

          return {
            chunk: {
              id: result.id,
              content: result.text,
              metadata: {
                ...metadata,
                createdAt: new Date(metadata.createdAt),
                updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : undefined
              },
              chunkIndex: metadata.chunkIndex,
              totalChunks: metadata.totalChunks,
              embedding: result.vector
            },
            score: this.convertDistanceToScore(result._distance),
            relevance: this.convertDistanceToScore(result._distance)
          };
        });

      console.log(`[VectorStore] Found ${retrievalResults.length} results for query`);
      return retrievalResults;
    } catch (error) {
      console.error('[VectorStore] Search failed:', error);
      throw new Error(`Search failed: ${error}`);
    }
  }

  /**
   * Delete chunks by ID
   */
  async deleteChunks(chunkIds: string[]): Promise<void> {
    if (!this.initialized || !this.table) {
      throw new Error('Vector store not initialized');
    }

    try {
      const deleteCondition = chunkIds.map(id => `id = '${id}'`).join(' OR ');
      await this.table.delete(deleteCondition);
      console.log(`[VectorStore] Deleted ${chunkIds.length} chunks`);
    } catch (error) {
      console.error('[VectorStore] Failed to delete chunks:', error);
      throw new Error(`Failed to delete chunks: ${error}`);
    }
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<{
    totalVectors: number;
    storeSizeBytes: number;
  }> {
    if (!this.initialized || !this.table) {
      throw new Error('Vector store not initialized');
    }

    try {
      const count = await this.table.countRows();

      // Get directory size
      let storeSizeBytes = 0;
      try {
        const files = await fs.readdir(this.config.storePath);
        for (const file of files) {
          const filePath = path.join(this.config.storePath, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            storeSizeBytes += stats.size;
          }
        }
      } catch (error) {
        console.warn('[VectorStore] Failed to calculate store size:', error);
      }

      return {
        totalVectors: count,
        storeSizeBytes
      };
    } catch (error) {
      console.error('[VectorStore] Failed to get stats:', error);
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  /**
   * Convert distance metric to similarity score (0-1)
   */
  private convertDistanceToScore(distance: number): number {
    // For cosine distance: score = 1 - distance
    // Ensure score is between 0 and 1
    const score = Math.max(0, Math.min(1, 1 - distance));
    return score;
  }

  /**
   * Close the vector store connection
   */
  async close(): Promise<void> {
    if (this.db) {
      // LanceDB connections are automatically managed
      this.db = null;
      this.table = null;
      this.initialized = false;
      console.log('[VectorStore] Connection closed');
    }
  }
}
