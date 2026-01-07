import { config } from 'dotenv';
import OpenAI from 'openai';
import { VectorStoreConfig } from '../../types/rag.js';

// Load environment variables
config();

/**
 * Generates embeddings for text using OpenAI or local models
 */
export class EmbeddingGenerator {
  private openai?: OpenAI;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;

    if (config.embeddingProvider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required for OpenAI embeddings');
      }
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.config.embeddingProvider === 'openai') {
      return this.generateOpenAIEmbedding(text);
    } else {
      throw new Error(`Embedding provider '${this.config.embeddingProvider}' not yet implemented`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (this.config.embeddingProvider === 'openai') {
      return this.generateOpenAIEmbeddings(texts);
    } else {
      throw new Error(`Embedding provider '${this.config.embeddingProvider}' not yet implemented`);
    }
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const model = this.config.embeddingModel || 'text-embedding-3-small';

      const response = await this.openai.embeddings.create({
        model,
        input: text,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      const embedding = response.data[0].embedding;

      // Verify dimension matches config
      if (embedding.length !== this.config.embeddingDimension) {
        console.warn(
          `[EmbeddingGenerator] Embedding dimension mismatch: expected ${this.config.embeddingDimension}, got ${embedding.length}`
        );
      }

      return embedding;
    } catch (error) {
      console.error('[EmbeddingGenerator] Failed to generate OpenAI embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Generate embeddings in batch using OpenAI API
   */
  private async generateOpenAIEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const model = this.config.embeddingModel || 'text-embedding-3-small';

      // OpenAI supports batch embedding requests
      const response = await this.openai.embeddings.create({
        model,
        input: texts,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embeddings returned from OpenAI');
      }

      // Sort by index to ensure correct order
      const sortedData = response.data.sort((a, b) => a.index - b.index);
      const embeddings = sortedData.map(item => item.embedding);

      // Verify all embeddings have correct dimension
      for (const embedding of embeddings) {
        if (embedding.length !== this.config.embeddingDimension) {
          console.warn(
            `[EmbeddingGenerator] Embedding dimension mismatch: expected ${this.config.embeddingDimension}, got ${embedding.length}`
          );
        }
      }

      console.log(`[EmbeddingGenerator] Generated ${embeddings.length} embeddings using ${model}`);
      return embeddings;
    } catch (error) {
      console.error('[EmbeddingGenerator] Failed to generate OpenAI embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error}`);
    }
  }

  /**
   * Get embedding dimension for the configured model
   */
  getEmbeddingDimension(): number {
    return this.config.embeddingDimension;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }
}
