import { spawn } from 'child_process';
import { AIExecutor, generateSharedFallbackResponse } from './ai-executor.js';

export interface GeminiClientOptions {
  agentName: string;
  maxTokens?: number;
  model?: string;
  path?: string;
}

export class GeminiClient {
  private agentName: string;
  private maxTokens: number;
  private model: string;
  private path: string;

  constructor(options: GeminiClientOptions) {
    this.agentName = options.agentName;
    this.maxTokens = options.maxTokens || 4000;
    this.model = options.model || 'gemini-2.5-flash';
    this.path = options.path || 'C:\\Users\\yuyay\\AppData\\Roaming\\npm\\gemini.cmd';
  }

  async callGeminiCli(prompt: string): Promise<string> {
    console.log(`[${this.agentName}] Calling Gemini CLI with prompt: ${prompt.substring(0, 100)}...`);
    
    return new Promise((resolve, reject) => {
      const gemini = spawn(this.path, ['-m', this.model], { shell: true });
      
      let output = '';
      let error = '';
      
      gemini.stdout.on('data', (data) => {
        console.log(`[${this.agentName}] Gemini stdout: ${data.toString().substring(0, 100)}...`);
        output += data.toString();
      });
      
      gemini.stderr.on('data', (data) => {
        console.log(`[${this.agentName}] Gemini stderr: ${data.toString().substring(0, 100)}...`);
        error += data.toString();
      });
      
      gemini.on('close', (code) => {
        console.log(`[${this.agentName}] Gemini process closed with code: ${code}`);
        if (code === 0) {
          console.log(`[${this.agentName}] Gemini CLI executed successfully!`);
          resolve(output.trim());
        } else {
          console.warn(`[${this.agentName}] Gemini CLI failed with code ${code}: ${error}`);
          // Fallback to simulated response
          resolve(this.generateFallbackResponse(prompt));
        }
      });
      
      gemini.on('error', (err) => {
        console.warn(`[${this.agentName}] Gemini CLI error: ${err.message}`);
        // Fallback to simulated response
        resolve(this.generateFallbackResponse(prompt));
      });

      // Send the actual prompt via stdin
      console.log(`[${this.agentName}] Writing prompt to stdin...`);
      gemini.stdin.write(prompt);
      gemini.stdin.end();
    });
  }

  async callGeminiCliWithTruncation(prompt: string): Promise<string> {
    const estimatedTokens = Math.ceil(prompt.length / 4); // Rough estimation
    
    if (estimatedTokens > this.maxTokens) {
      console.warn(`[${this.agentName}] Estimated tokens (${estimatedTokens}) exceed limit (${this.maxTokens}). Truncating prompt.`);
      const truncatedPrompt = this.truncatePrompt(prompt, this.maxTokens);
      console.log(`[${this.agentName}] Using truncated prompt: ${truncatedPrompt.substring(0, 100)}...`);
      return this.callGeminiCli(truncatedPrompt);
    }
    
    return this.callGeminiCli(prompt);
  }

  private truncatePrompt(prompt: string, maxTokens: number): string {
    const maxChars = maxTokens * 4; // Rough conversion
    if (prompt.length <= maxChars) {
      return prompt;
    }
    
    // Try to truncate at sentence boundaries
    const truncated = prompt.substring(0, maxChars);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('\n')
    );
    
    if (lastSentenceEnd > maxChars * 0.8) {
      return prompt.substring(0, lastSentenceEnd + 1);
    }
    
    return truncated + '...';
  }

  private generateFallbackResponse(prompt: string): string {
    return generateSharedFallbackResponse(this.agentName, prompt);
  }
}

// Factory function to create GeminiClient instances
export function createGeminiClient(agentName: string, options?: Partial<GeminiClientOptions>): GeminiClient {
  return new GeminiClient({
    agentName,
    ...options
  });
} 