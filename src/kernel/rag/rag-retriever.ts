import {
  RAGQuery,
  RAGResponse,
  RAGEnhancedContext,
  RetrievalResult,
  RAGConfig,
  DocumentChunk,
  SessionHistoryDocument
} from '../../types/rag.js';
import { VectorStore } from './vector-store.js';
import { EmbeddingGenerator } from './embedding-generator.js';
import { DocumentIngestion } from './document-ingestion.js';

/**
 * Main RAG retrieval system
 */
export class RAGRetriever {
  private vectorStore: VectorStore;
  private embeddingGenerator: EmbeddingGenerator;
  private documentIngestion: DocumentIngestion;
  private config: RAGConfig;
  private initialized: boolean = false;

  constructor(config: RAGConfig) {
    this.config = config;
    this.vectorStore = new VectorStore(config.vectorStore);
    this.embeddingGenerator = new EmbeddingGenerator(config.vectorStore);
    this.documentIngestion = new DocumentIngestion(config.ingestion, this.embeddingGenerator);
  }

  /**
   * Initialize the RAG retriever
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[RAGRetriever] Already initialized');
      return;
    }

    if (!this.config.enabled) {
      console.log('[RAGRetriever] RAG is disabled in configuration');
      return;
    }

    try {
      await this.vectorStore.initialize();
      this.initialized = true;
      console.log('[RAGRetriever] Initialization complete');
    } catch (error) {
      console.error('[RAGRetriever] Initialization failed:', error);
      throw new Error(`Failed to initialize RAG retriever: ${error}`);
    }
  }

  /**
   * Retrieve relevant knowledge for a query
   */
  async retrieve(query: RAGQuery): Promise<RAGResponse> {
    if (!this.initialized) {
      throw new Error('RAG retriever not initialized');
    }

    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query.query);

      // Search vector store
      const topK = query.topK || this.config.retrieval.defaultTopK;
      const minScore = query.minScore || this.config.retrieval.defaultMinScore;

      const results = await this.vectorStore.search(queryEmbedding, {
        topK,
        minScore,
        filters: query.filters
      });

      // Re-rank results if enabled
      const finalResults = this.config.retrieval.enableReranking
        ? await this.rerankResults(query.query, results)
        : results;

      // Generate augmented context
      const augmentedContext = this.formatAugmentedContext(finalResults);

      const processingTimeMs = Date.now() - startTime;

      console.log(`[RAGRetriever] Retrieved ${finalResults.length} results in ${processingTimeMs}ms`);

      return {
        results: finalResults,
        query: query.query,
        totalResults: finalResults.length,
        processingTimeMs,
        augmentedContext
      };
    } catch (error) {
      console.error('[RAGRetriever] Retrieval failed:', error);
      throw new Error(`Failed to retrieve: ${error}`);
    }
  }

  /**
   * Retrieve and format enhanced context for agents
   */
  async retrieveEnhancedContext(query: string, filters?: RAGQuery['filters']): Promise<RAGEnhancedContext> {
    const ragQuery: RAGQuery = {
      query,
      filters,
      topK: this.config.retrieval.defaultTopK,
      minScore: this.config.retrieval.defaultMinScore,
      includeMetadata: true
    };

    const response = await this.retrieve(ragQuery);

    // Format sources
    const sources = response.results.map(result => ({
      id: result.chunk.id,
      title: result.chunk.metadata.title || result.chunk.metadata.source,
      sourceType: result.chunk.metadata.sourceType,
      relevance: result.score
    }));

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const totalTokensEstimate = Math.ceil(response.augmentedContext.length / 4);

    return {
      originalQuery: query,
      retrievedKnowledge: response.results,
      formattedContext: response.augmentedContext,
      sources,
      totalTokensEstimate
    };
  }

  /**
   * Index local documents
   */
  async indexLocalDocuments(filePaths: string[]): Promise<number> {
    if (!this.initialized) {
      throw new Error('RAG retriever not initialized');
    }

    try {
      console.log(`[RAGRetriever] Indexing ${filePaths.length} local documents...`);
      const chunks = await this.documentIngestion.ingestLocalFiles(filePaths);

      await this.vectorStore.addChunks(chunks);
      console.log(`[RAGRetriever] Successfully indexed ${chunks.length} chunks from ${filePaths.length} documents`);

      return chunks.length;
    } catch (error) {
      console.error('[RAGRetriever] Failed to index local documents:', error);
      throw new Error(`Failed to index documents: ${error}`);
    }
  }

  /**
   * Index a directory of documents
   */
  async indexDirectory(dirPath: string, recursive: boolean = false): Promise<number> {
    if (!this.initialized) {
      throw new Error('RAG retriever not initialized');
    }

    try {
      console.log(`[RAGRetriever] Indexing directory: ${dirPath} (recursive: ${recursive})`);
      const chunks = await this.documentIngestion.ingestDirectory(dirPath, recursive);

      await this.vectorStore.addChunks(chunks);
      console.log(`[RAGRetriever] Successfully indexed ${chunks.length} chunks from directory`);

      return chunks.length;
    } catch (error) {
      console.error('[RAGRetriever] Failed to index directory:', error);
      throw new Error(`Failed to index directory: ${error}`);
    }
  }

  /**
   * Index session history
   */
  async indexSessionHistory(history: SessionHistoryDocument[]): Promise<number> {
    if (!this.initialized) {
      throw new Error('RAG retriever not initialized');
    }

    try {
      console.log(`[RAGRetriever] Indexing ${history.length} session history documents...`);
      const chunks = await this.documentIngestion.ingestSessionHistory(history);

      await this.vectorStore.addChunks(chunks);
      console.log(`[RAGRetriever] Successfully indexed ${chunks.length} chunks from session history`);

      return chunks.length;
    } catch (error) {
      console.error('[RAGRetriever] Failed to index session history:', error);
      throw new Error(`Failed to index session history: ${error}`);
    }
  }

  /**
   * Get RAG system statistics
   */
  async getStats(): Promise<{
    totalVectors: number;
    storeSizeBytes: number;
    isInitialized: boolean;
    isEnabled: boolean;
  }> {
    if (!this.initialized) {
      return {
        totalVectors: 0,
        storeSizeBytes: 0,
        isInitialized: false,
        isEnabled: this.config.enabled
      };
    }

    const storeStats = await this.vectorStore.getStats();

    return {
      ...storeStats,
      isInitialized: this.initialized,
      isEnabled: this.config.enabled
    };
  }

  /**
   * Re-rank results based on relevance to query
   */
  private async rerankResults(query: string, results: RetrievalResult[]): Promise<RetrievalResult[]> {
    // Simple reranking based on keyword matching
    // In a more advanced implementation, this could use a reranking model

    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);

    for (const result of results) {
      const contentLower = result.chunk.content.toLowerCase();

      // Count keyword matches
      let keywordMatches = 0;
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          keywordMatches++;
        }
      }

      // Adjust relevance score based on keyword matches
      const keywordBoost = (keywordMatches / queryTerms.length) * 0.2;
      result.relevance = Math.min(1, result.score + keywordBoost);
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * Format augmented context for LLM consumption
   */
  private formatAugmentedContext(results: RetrievalResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const contextParts: string[] = [
      '=== Retrieved Knowledge ===\n'
    ];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = result.chunk.metadata.title || result.chunk.metadata.source;
      const sourceType = result.chunk.metadata.sourceType;

      contextParts.push(
        `[${i + 1}] Source: ${source} (${sourceType})`,
        `Relevance: ${(result.relevance * 100).toFixed(1)}%`,
        `Content: ${result.chunk.content}`,
        ''
      );
    }

    contextParts.push('=== End of Retrieved Knowledge ===\n');

    return contextParts.join('\n');
  }

  /**
   * Close the RAG retriever
   */
  async close(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.close();
    }
    this.initialized = false;
    console.log('[RAGRetriever] Closed');
  }
}
