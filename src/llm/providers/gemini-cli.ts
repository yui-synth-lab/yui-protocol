import { spawn } from 'child_process';
import { AIExecutor, AIExecutorOptions, AIExecutionResult } from '../../kernel/ai-executor.js';

// Gemini CLI Implementation
export class GeminiCliExecutor extends AIExecutor {
  private path: string;

  constructor(options: AIExecutorOptions) {
    super(options);
    this.path = this.customConfig.path || 'C:\\Users\\yuyay\\AppData\\Roaming\\npm\\gemini.cmd';
  }

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    // system message非対応APIなので、personalityがあればpromptの先頭に付与
    const effectivePrompt = personality ? `${personality}\n\n${prompt}` : prompt;
    console.log(`[${this.agentId}] Calling Gemini CLI with prompt: ${prompt.substring(0, 100)}...`);

    return new Promise((resolve, reject) => {
      const gemini = spawn(this.path, ['-m', this.model], { shell: true });

      let output = '';
      let error = '';

      gemini.stdout.on('data', (data) => {
        console.log(`[${this.agentId}] Gemini stdout: ${data.toString().substring(0, 100)}...`);
        output += data.toString();
      });

      gemini.stderr.on('data', (data) => {
        console.log(`[${this.agentId}] Gemini stderr: ${data.toString().substring(0, 100)}...`);
        error += data.toString();
      });

      gemini.on('close', (code) => {
        const duration = Date.now() - startTime;
        console.log(`[${this.agentId}] Gemini process closed with code: ${code}`);

        if (code === 0) {
          console.log(`[${this.agentId}] Gemini CLI executed successfully!`);
          resolve({
            content: this.sanitizeContent(output.trim()),
            model: this.model,
            duration,
            success: true
          });
        } else {
          console.warn(`[${this.agentId}] Gemini CLI failed with code ${code}: ${error}`);
          resolve({
            content: this.generateFallbackResponse(prompt),
            model: this.model,
            duration,
            success: false,
            error: `Process exited with code ${code}: ${error}`
          });
        }
      });

      gemini.on('error', (err) => {
        const duration = Date.now() - startTime;
        console.warn(`[${this.agentId}] Gemini CLI error: ${err.message}`);
        resolve({
          content: this.generateFallbackResponse(prompt),
          model: this.model,
          duration,
          success: false,
          error: err.message
        });
      });

      // Send the actual prompt via stdin
      console.log(`[${this.agentId}] Writing prompt to stdin...`);
      gemini.stdin.write(effectivePrompt);
      gemini.stdin.end();
    });
  }
}
