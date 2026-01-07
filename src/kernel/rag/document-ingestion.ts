import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DocumentChunk,
  DocumentMetadata,
  IngestionConfig,
  SessionHistoryDocument
} from '../../types/rag.js';
import { EmbeddingGenerator } from './embedding-generator.js';

/**
 * Handles document ingestion and chunking for RAG
 */
export class DocumentIngestion {
  private config: IngestionConfig;
  private embeddingGenerator: EmbeddingGenerator;

  constructor(config: IngestionConfig, embeddingGenerator: EmbeddingGenerator) {
    this.config = config;
    this.embeddingGenerator = embeddingGenerator;
  }

  /**
   * Ingest a local file and convert to chunks
   */
  async ingestLocalFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!this.config.supportedFileTypes.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      const metadata: DocumentMetadata = {
        source: filePath,
        sourceType: 'local-file',
        title: fileName,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        fileType: ext,
        filePath: filePath
      };

      return await this.chunkDocument(content, metadata);
    } catch (error) {
      console.error(`[DocumentIngestion] Failed to ingest file ${filePath}:`, error);
      throw new Error(`Failed to ingest file: ${error}`);
    }
  }

  /**
   * Ingest multiple local files
   */
  async ingestLocalFiles(filePaths: string[]): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];

    for (const filePath of filePaths) {
      try {
        const chunks = await this.ingestLocalFile(filePath);
        allChunks.push(...chunks);
      } catch (error) {
        console.warn(`[DocumentIngestion] Skipping file ${filePath}:`, error);
      }
    }

    return allChunks;
  }

  /**
   * Ingest a directory of files
   */
  async ingestDirectory(dirPath: string, recursive: boolean = false): Promise<DocumentChunk[]> {
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }

      const files: string[] = [];
      await this.collectFiles(dirPath, files, recursive);

      console.log(`[DocumentIngestion] Found ${files.length} files in ${dirPath}`);
      return await this.ingestLocalFiles(files);
    } catch (error) {
      console.error(`[DocumentIngestion] Failed to ingest directory ${dirPath}:`, error);
      throw new Error(`Failed to ingest directory: ${error}`);
    }
  }

  /**
   * Ingest session history
   */
  async ingestSessionHistory(history: SessionHistoryDocument[]): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];

    for (const doc of history) {
      const metadata: DocumentMetadata = {
        source: `session-${doc.sessionId}`,
        sourceType: 'session-history',
        title: `Session ${doc.sessionId} - ${doc.agentId} - ${doc.stage}`,
        createdAt: doc.timestamp,
        agentId: doc.agentId,
        sessionId: doc.sessionId,
        stage: doc.stage
      };

      const chunks = await this.chunkDocument(doc.content, metadata);
      allChunks.push(...chunks);
    }

    console.log(`[DocumentIngestion] Ingested ${history.length} session history documents into ${allChunks.length} chunks`);
    return allChunks;
  }

  /**
   * Chunk a document into smaller pieces
   */
  private async chunkDocument(content: string, metadata: DocumentMetadata): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const { chunkSize, chunkOverlap } = this.config;

    // Split content into chunks with overlap
    const textChunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      const chunkText = content.slice(start, end);
      textChunks.push(chunkText);

      // Move start position with overlap
      start += chunkSize - chunkOverlap;
      if (start >= content.length) break;
    }

    // Generate embeddings for all chunks in batch
    const embeddings = await this.embeddingGenerator.generateEmbeddings(textChunks);

    // Create document chunks
    for (let i = 0; i < textChunks.length; i++) {
      const chunk: DocumentChunk = {
        id: uuidv4(),
        content: textChunks[i],
        metadata: { ...metadata },
        embedding: embeddings[i],
        chunkIndex: i,
        totalChunks: textChunks.length
      };
      chunks.push(chunk);
    }

    console.log(`[DocumentIngestion] Created ${chunks.length} chunks from document: ${metadata.title || metadata.source}`);
    return chunks;
  }

  /**
   * Recursively collect files from directory
   */
  private async collectFiles(dirPath: string, files: string[], recursive: boolean): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await this.collectFiles(fullPath, files, recursive);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (this.config.supportedFileTypes.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  /**
   * Extract metadata from content (if enabled)
   */
  private extractMetadata(content: string): { title?: string; author?: string; tags?: string[] } {
    if (!this.config.enableMetadataExtraction) {
      return {};
    }

    const metadata: { title?: string; author?: string; tags?: string[] } = {};

    // Try to extract title from markdown header
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Try to extract author from markdown metadata
    const authorMatch = content.match(/^author:\s*(.+)$/mi);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    // Try to extract tags from markdown metadata
    const tagsMatch = content.match(/^tags?:\s*\[(.+)\]$/mi);
    if (tagsMatch) {
      metadata.tags = tagsMatch[1].split(',').map(tag => tag.trim());
    }

    return metadata;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IngestionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[DocumentIngestion] Configuration updated:', this.config);
  }
}
