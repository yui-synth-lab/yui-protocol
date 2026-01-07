// RAG (Retrieval-Augmented Generation) 関連の型定義

/**
 * Vector embedding representation
 */
export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  text: string;
  timestamp: Date;
}

/**
 * Document chunk for RAG processing
 */
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  source: string;
  sourceType: 'local-file' | 'session-history' | 'web' | 'custom';
  title?: string;
  author?: string;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
  agentId?: string; // For session history
  sessionId?: string; // For session history
  stage?: string; // For session history
  fileType?: string; // For local files
  filePath?: string; // For local files
}

/**
 * RAG retrieval result
 */
export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number; // Similarity score (0-1)
  relevance: number; // Relevance to query (0-1)
}

/**
 * RAG search query
 */
export interface RAGQuery {
  query: string;
  filters?: {
    sourceType?: DocumentMetadata['sourceType'][];
    agentId?: string;
    sessionId?: string;
    tags?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  topK?: number; // Number of results to return
  minScore?: number; // Minimum similarity score
  includeMetadata?: boolean;
}

/**
 * RAG search response
 */
export interface RAGResponse {
  results: RetrievalResult[];
  query: string;
  totalResults: number;
  processingTimeMs: number;
  augmentedContext: string; // Formatted context for LLM
}

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  storePath: string;
  embeddingDimension: number;
  embeddingProvider: 'openai' | 'local';
  embeddingModel?: string;
  indexType?: string;
  distanceMetric?: 'cosine' | 'euclidean' | 'dot';
}

/**
 * Document ingestion configuration
 */
export interface IngestionConfig {
  chunkSize: number; // Characters per chunk
  chunkOverlap: number; // Overlap between chunks
  enableMetadataExtraction: boolean;
  supportedFileTypes: string[];
  batchSize: number; // Number of chunks to process in parallel
}

/**
 * RAG system statistics
 */
export interface RAGStats {
  totalDocuments: number;
  totalChunks: number;
  totalVectors: number;
  storeSizeBytes: number;
  lastIndexedAt?: Date;
  indexingInProgress: boolean;
}

/**
 * Session history for RAG indexing
 */
export interface SessionHistoryDocument {
  sessionId: string;
  agentId: string;
  stage: string;
  content: string;
  timestamp: Date;
  metadata: {
    confidence?: number;
    reasoning?: string;
    references?: string[];
  };
}

/**
 * RAG-enhanced context for agents
 */
export interface RAGEnhancedContext {
  originalQuery: string;
  retrievedKnowledge: RetrievalResult[];
  formattedContext: string;
  sources: {
    id: string;
    title: string;
    sourceType: string;
    relevance: number;
  }[];
  totalTokensEstimate: number;
}

/**
 * Knowledge base entry
 */
export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  isIndexed: boolean;
}

/**
 * RAG configuration
 */
export interface RAGConfig {
  enabled: boolean;
  vectorStore: VectorStoreConfig;
  ingestion: IngestionConfig;
  retrieval: {
    defaultTopK: number;
    defaultMinScore: number;
    maxContextTokens: number;
    enableReranking: boolean;
  };
  indexing: {
    autoIndexSessions: boolean;
    autoIndexLocalDocs: boolean;
    autoIndexOutputs: boolean; // Auto-index new output markdown files
    indexingInterval?: number; // Minutes
    watchDirectories?: string[];
  };
}
