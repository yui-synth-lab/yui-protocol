import { promises as fs } from 'fs';
import path from 'path';
import { AIInteractionLog, SessionInteractionSummary, DialogueStage, Language } from '../types/index.js';

export interface SimplifiedInteractionLog {
  id: string;
  sessionId: string;
  stage: DialogueStage;
  agentId: string;
  agentName: string;
  timestamp: Date;
  prompt: string;
  output: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  error?: string;
}

export class InteractionLogger {
  private logDir: string;

  constructor(logDir: string = './logs') {
    this.logDir = logDir;
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.access(this.logDir);
    } catch {
      await fs.mkdir(this.logDir, { recursive: true });
    }
  }

  // Save simplified interaction log with hierarchical structure
  public async saveInteractionLog(log: SimplifiedInteractionLog): Promise<void> {
    try {
      // Create hierarchical directory structure: logs/sessionId/stage/agentId.json
      const sessionDir = path.join(this.logDir, log.sessionId);
      const stageDir = path.join(sessionDir, log.stage);
      
      // Ensure directories exist
      await fs.mkdir(sessionDir, { recursive: true });
      await fs.mkdir(stageDir, { recursive: true });

      // Save to agent-specific file
      const agentLogPath = path.join(stageDir, `${log.agentId}.json`);
      await this.appendToFile(agentLogPath, log);

      console.log(`[InteractionLogger] Saved interaction log for ${log.agentId} in ${log.stage} of session ${log.sessionId}`);
    } catch (error) {
      console.error(`[InteractionLogger] Error saving interaction log:`, error);
    }
  }

  private async appendToFile(filePath: string, log: SimplifiedInteractionLog): Promise<void> {
    try {
      let logs: SimplifiedInteractionLog[] = [];
      
      // Try to read existing logs
      try {
        const existingData = await fs.readFile(filePath, 'utf8');
        logs = JSON.parse(existingData);
      } catch {
        // File doesn't exist or is empty, start with empty array
      }

      // Add new log
      logs.push(log);

      // Write back to file
      await fs.writeFile(filePath, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
      console.error(`[InteractionLogger] Error appending to file ${filePath}:`, error);
    }
  }

  // Get all interaction logs for a session
  public async getSessionLogs(sessionId: string): Promise<SimplifiedInteractionLog[]> {
    try {
      const sessionDir = path.join(this.logDir, sessionId);
      const logs: SimplifiedInteractionLog[] = [];
      
      // Check if session directory exists
      try {
        await fs.access(sessionDir);
      } catch {
        return [];
      }

      // Read all stages
      const stages = await fs.readdir(sessionDir);
      for (const stage of stages) {
        const stageDir = path.join(sessionDir, stage);
        const stageStat = await fs.stat(stageDir);
        
        if (stageStat.isDirectory()) {
          const agentFiles = await fs.readdir(stageDir);
          for (const agentFile of agentFiles) {
            if (agentFile.endsWith('.json')) {
              const agentLogPath = path.join(stageDir, agentFile);
              try {
                const data = await fs.readFile(agentLogPath, 'utf8');
                const agentLogs: SimplifiedInteractionLog[] = JSON.parse(data);
                logs.push(...agentLogs);
              } catch (error) {
                console.error(`[InteractionLogger] Error reading file ${agentLogPath}:`, error);
              }
            }
          }
        }
      }
      
      // Convert date strings back to Date objects and sort by timestamp
      return logs
        .map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error(`[InteractionLogger] Error reading session logs for ${sessionId}:`, error);
      return [];
    }
  }

  // Get all interaction logs for an agent
  public async getAgentLogs(agentId: string): Promise<SimplifiedInteractionLog[]> {
    try {
      const logs: SimplifiedInteractionLog[] = [];
      
      // Read all sessions
      const sessions = await fs.readdir(this.logDir);
      for (const sessionId of sessions) {
        const sessionDir = path.join(this.logDir, sessionId);
        const sessionStat = await fs.stat(sessionDir);
        
        if (sessionStat.isDirectory()) {
          // Read all stages in this session
          const stages = await fs.readdir(sessionDir);
          for (const stage of stages) {
            const stageDir = path.join(sessionDir, stage);
            const stageStat = await fs.stat(stageDir);
            
            if (stageStat.isDirectory()) {
              const agentLogPath = path.join(stageDir, `${agentId}.json`);
              try {
                await fs.access(agentLogPath);
                const data = await fs.readFile(agentLogPath, 'utf8');
                const agentLogs: SimplifiedInteractionLog[] = JSON.parse(data);
                logs.push(...agentLogs);
              } catch {
                // Agent file doesn't exist for this stage, continue
              }
            }
          }
        }
      }
      
      // Convert date strings back to Date objects and sort by timestamp
      return logs
        .map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error(`[InteractionLogger] Error reading agent logs for ${agentId}:`, error);
      return [];
    }
  }

  // Get all interaction logs for a stage
  public async getStageLogs(stage: DialogueStage): Promise<SimplifiedInteractionLog[]> {
    try {
      const logs: SimplifiedInteractionLog[] = [];
      
      // Read all sessions
      const sessions = await fs.readdir(this.logDir);
      for (const sessionId of sessions) {
        const sessionDir = path.join(this.logDir, sessionId);
        const sessionStat = await fs.stat(sessionDir);
        
        if (sessionStat.isDirectory()) {
          const stageDir = path.join(sessionDir, stage);
          try {
            await fs.access(stageDir);
            const agentFiles = await fs.readdir(stageDir);
            for (const agentFile of agentFiles) {
              if (agentFile.endsWith('.json')) {
                const agentLogPath = path.join(stageDir, agentFile);
                try {
                  const data = await fs.readFile(agentLogPath, 'utf8');
                  const agentLogs: SimplifiedInteractionLog[] = JSON.parse(data);
                  logs.push(...agentLogs);
                } catch (error) {
                  console.error(`[InteractionLogger] Error reading file ${agentLogPath}:`, error);
                }
              }
            }
          } catch {
            // Stage directory doesn't exist for this session, continue
          }
        }
      }
      
      // Convert date strings back to Date objects and sort by timestamp
      return logs
        .map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error(`[InteractionLogger] Error reading stage logs for ${stage}:`, error);
      return [];
    }
  }

  // Generate session interaction summary
  public async generateSessionSummary(sessionId: string, title: string, language: Language): Promise<SessionInteractionSummary> {
    const logs = await this.getSessionLogs(sessionId);
    
    if (logs.length === 0) {
      return {
        sessionId,
        title,
        createdAt: new Date(),
        totalInteractions: 0,
        agents: [],
        stages: [],
        language
      };
    }

    // Group by agent
    const agentStats = new Map<string, { interactions: number; totalDuration: number; confidences: number[] }>();
    const stageStats = new Map<DialogueStage, { interactions: number; totalDuration: number }>();

    for (const log of logs) {
      // Agent stats
      if (!agentStats.has(log.agentId)) {
        agentStats.set(log.agentId, { interactions: 0, totalDuration: 0, confidences: [] });
      }
      const agentStat = agentStats.get(log.agentId)!;
      agentStat.interactions++;
      agentStat.totalDuration += log.duration;

      // Stage stats
      if (!stageStats.has(log.stage)) {
        stageStats.set(log.stage, { interactions: 0, totalDuration: 0 });
      }
      const stageStat = stageStats.get(log.stage)!;
      stageStat.interactions++;
      stageStat.totalDuration += log.duration;
    }

    const agents = Array.from(agentStats.entries()).map(([agentId, stats]) => ({
      agentId,
      agentName: logs.find(log => log.agentId === agentId)?.agentName || agentId,
      interactions: stats.interactions,
      totalDuration: stats.totalDuration,
      averageConfidence: 0 // Simplified logs don't include confidence
    }));

    const stages = Array.from(stageStats.entries()).map(([stage, stats]) => ({
      stage,
      interactions: stats.interactions,
      averageDuration: stats.totalDuration / stats.interactions
    }));

    return {
      sessionId,
      title,
      createdAt: logs[0].timestamp,
      completedAt: logs[logs.length - 1].timestamp,
      totalInteractions: logs.length,
      agents,
      stages,
      language
    };
  }

  // Get all session summaries
  public async getAllSessionSummaries(): Promise<SessionInteractionSummary[]> {
    try {
      const sessions = await fs.readdir(this.logDir);
      const summaries: SessionInteractionSummary[] = [];
      
      for (const sessionId of sessions) {
        const sessionDir = path.join(this.logDir, sessionId);
        try {
          const sessionStat = await fs.stat(sessionDir);
          if (sessionStat.isDirectory()) {
            try {
              const logs = await this.getSessionLogs(sessionId);
              if (logs.length > 0) {
                const summary = await this.generateSessionSummary(
                  sessionId, 
                  `Session ${sessionId}`, 
                  'en' // Default language
                );
                summaries.push(summary);
              }
            } catch (error) {
              console.error(`[InteractionLogger] Error generating summary for ${sessionId}:`, error);
            }
          }
        } catch (error) {
          // Skip if not a directory
        }
      }
      
      return summaries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('[InteractionLogger] Error reading session summaries:', error);
      return [];
    }
  }

  // Delete logs for a session
  public async deleteSessionLogs(sessionId: string): Promise<boolean> {
    try {
      const sessionDir = path.join(this.logDir, sessionId);
      await fs.rm(sessionDir, { recursive: true, force: true });
      console.log(`[InteractionLogger] Deleted logs for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`[InteractionLogger] Error deleting logs for session ${sessionId}:`, error);
      return false;
    }
  }
} 