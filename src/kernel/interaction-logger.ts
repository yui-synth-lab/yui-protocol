import { promises as fs } from 'fs';
import path from 'path';
import { DialogueStage, Language } from '../types/index.js';

export interface SimplifiedInteractionLog {
  id: string;
  sessionId: string;
  stage: DialogueStage;
  agentId: string;
  agentName: string;
  timestamp: Date | string;
  prompt: string;
  output: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  error?: string;
  personality?: string; // Added personality field
  provider?: string; // AIサービス名
  model?: string;     // モデル名
  // Facilitator-specific fields
  facilitatorAction?: string;
  facilitatorReasoning?: string;
  participationBalance?: Record<string, number>;
  topicShift?: boolean;
  consensusLevel?: number;
  roundNumber?: number;
  // Voting analysis fields
  voteAnalysis?: {
    totalVotes: number;
    validVotes: number;
    selectedAgent: string;
    voteCounts: Record<string, number>;
    voteDetails: { agentId: string; voteFor: string | undefined; voteReasoning?: string }[];
  };
}

export type FileSystem = typeof fs;

export class InteractionLogger {
  private logDir: string;
  private fs: FileSystem;

  constructor(logDir: string = './logs', fileSystem?: FileSystem) {
    this.logDir = logDir;
    this.fs = fileSystem || fs;
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await this.fs.access(this.logDir);
    } catch {
      await this.fs.mkdir(this.logDir, { recursive: true });
    }
  }

  // Save simplified interaction log with hierarchical structure
  public async saveInteractionLog(log: SimplifiedInteractionLog): Promise<void> {
    try {
      // Create hierarchical directory structure: logs/sessionId/stage/agentId.json
      const sessionDir = path.join(this.logDir, log.sessionId);
      const stageDir = path.join(sessionDir, log.stage);

      // Ensure directories exist
      await this.fs.mkdir(sessionDir, { recursive: true });
      await this.fs.mkdir(stageDir, { recursive: true });

      // Save to agent-specific file
      const agentLogPath = path.join(stageDir, `${log.agentId}.json`);
      await this.appendToFile(agentLogPath, log);

      console.log(`[InteractionLogger] Saved interaction log for ${log.agentId} in ${log.stage} of session ${log.sessionId}`);
    } catch (error) {
      console.error(`[InteractionLogger] Error saving interaction log:`, error);
    }
  }

  // Save facilitator log with special handling
  public async saveFacilitatorLog(log: {
    sessionId: string;
    roundNumber: number;
    timestamp: Date;
    action: string;
    reasoning: string;
    participationBalance: Record<string, number>;
    topicShift: boolean;
    consensusLevel?: number;
    duration?: number;
  }): Promise<void> {
    try {
      const facilitatorLog: SimplifiedInteractionLog = {
        id: `facilitator-${log.sessionId}-${log.roundNumber}-${Date.now()}`,
        sessionId: log.sessionId,
        stage: 'facilitator' as DialogueStage,
        agentId: 'facilitator-001',
        agentName: 'Silent Facilitator',
        timestamp: log.timestamp,
        prompt: `Round ${log.roundNumber} analysis and action determination`,
        output: `Action: ${log.action} | Reasoning: ${log.reasoning}`,
        duration: log.duration || 0,
        status: 'success',
        facilitatorAction: log.action,
        facilitatorReasoning: log.reasoning,
        participationBalance: log.participationBalance,
        topicShift: log.topicShift,
        consensusLevel: log.consensusLevel,
        roundNumber: log.roundNumber
      };

      // Create hierarchical directory structure: logs/sessionId/facilitator/facilitator-001.json
      const sessionDir = path.join(this.logDir, log.sessionId);
      const facilitatorDir = path.join(sessionDir, 'facilitator');

      // Ensure directories exist
      await this.fs.mkdir(sessionDir, { recursive: true });
      await this.fs.mkdir(facilitatorDir, { recursive: true });

      // Save to facilitator-specific file
      const facilitatorLogPath = path.join(facilitatorDir, 'facilitator-001.json');
      await this.appendToFile(facilitatorLogPath, facilitatorLog);

      console.log(`[InteractionLogger] Saved facilitator log for round ${log.roundNumber} in session ${log.sessionId}`);
    } catch (error) {
      console.error(`[InteractionLogger] Error saving facilitator log:`, error);
    }
  }

  private async appendToFile(filePath: string, log: SimplifiedInteractionLog): Promise<void> {
    try {
      let logs: SimplifiedInteractionLog[] = [];
      
      // Try to read existing logs
      try {
        const existingData = await this.fs.readFile(filePath, 'utf8');
        logs = JSON.parse(existingData);
      } catch {
        // File doesn't exist or is empty, start with empty array
      }

      // Add new log
      logs.push(log);

      // Write back to file
      await this.fs.writeFile(filePath, JSON.stringify(logs, null, 2), 'utf8');
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
        await this.fs.access(sessionDir);
      } catch {
        return [];
      }

      // Read all stages
      const stages = await this.fs.readdir(sessionDir);
      for (const stage of stages) {
        const stageDir = path.join(sessionDir, stage);
        const stageStat = await this.fs.stat(stageDir);
        
        if (stageStat.isDirectory()) {
          const agentFiles = await this.fs.readdir(stageDir);
          for (const agentFile of agentFiles) {
            if (agentFile.endsWith('.json')) {
              const agentLogPath = path.join(stageDir, agentFile);
              try {
                const data = await this.fs.readFile(agentLogPath, 'utf8');
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
      const sessions = await this.fs.readdir(this.logDir);
      for (const sessionId of sessions) {
        const sessionDir = path.join(this.logDir, sessionId);
        const sessionStat = await this.fs.stat(sessionDir);
        
        if (sessionStat.isDirectory()) {
          // Read all stages in this session
          const stages = await this.fs.readdir(sessionDir);
          for (const stage of stages) {
            const stageDir = path.join(sessionDir, stage);
            const stageStat = await this.fs.stat(stageDir);
            
            if (stageStat.isDirectory()) {
              const agentLogPath = path.join(stageDir, `${agentId}.json`);
              try {
                await this.fs.access(agentLogPath);
                const data = await this.fs.readFile(agentLogPath, 'utf8');
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
      const sessions = await this.fs.readdir(this.logDir);
      for (const sessionId of sessions) {
        const sessionDir = path.join(this.logDir, sessionId);
        const sessionStat = await this.fs.stat(sessionDir);

        if (sessionStat.isDirectory()) {
          const stageDir = path.join(sessionDir, stage);
          try {
            await this.fs.access(stageDir);
            const agentFiles = await this.fs.readdir(stageDir);
            for (const agentFile of agentFiles) {
              if (agentFile.endsWith('.json')) {
                const agentLogPath = path.join(stageDir, agentFile);
                try {
                  const data = await this.fs.readFile(agentLogPath, 'utf8');
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

  // Get facilitator logs for a session
  public async getFacilitatorLogs(sessionId: string): Promise<SimplifiedInteractionLog[]> {
    try {
      const facilitatorDir = path.join(this.logDir, sessionId, 'facilitator');
      const facilitatorLogPath = path.join(facilitatorDir, 'facilitator-001.json');

      try {
        await this.fs.access(facilitatorLogPath);
        const data = await this.fs.readFile(facilitatorLogPath, 'utf8');
        const logs: SimplifiedInteractionLog[] = JSON.parse(data);

        // Convert date strings back to Date objects and sort by timestamp
        return logs
          .map(log => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      } catch {
        // Facilitator log file doesn't exist
        return [];
      }
    } catch (error) {
      console.error(`[InteractionLogger] Error reading facilitator logs for ${sessionId}:`, error);
      return [];
    }
  }

  // Get all facilitator logs across all sessions
  public async getAllFacilitatorLogs(): Promise<SimplifiedInteractionLog[]> {
    try {
      const logs: SimplifiedInteractionLog[] = [];

      // Read all sessions
      const sessions = await this.fs.readdir(this.logDir);
      for (const sessionId of sessions) {
        const sessionLogs = await this.getFacilitatorLogs(sessionId);
        logs.push(...sessionLogs);
      }

      // Sort by timestamp
      return logs.sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp as string).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp as string).getTime();
        return aTime - bTime;
      });
    } catch (error) {
      console.error(`[InteractionLogger] Error reading all facilitator logs:`, error);
      return [];
    }
  }
} 