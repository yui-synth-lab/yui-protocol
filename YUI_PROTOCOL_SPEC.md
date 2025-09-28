# YUI Protocol Specification (Implementation-Aligned)

## Table of Contents

1. Overview
2. Architecture
3. Agents
4. Dialogue Stages
5. Core Types
6. Orchestration & Router
7. Server & Realtime IO
8. Prompts & Generation Parameters
9. Memory, Sessions, Outputs, and Logs
10. Error Handling & Timeouts
11. Performance & Scalability
12. Security & Privacy
13. Implementation Structure
14. Testing & Coverage
15. Operations

## Overview

The YUI Protocol is a multi-agent collaboration framework that runs a structured, multi-stage dialogue among diverse AI agents. The current implementation coordinates five main stages with three summary stages and a finalization stage, supports dynamic vote analysis, automatic stage summarization, multi-provider AI execution, and real-time updates via WebSocket and SSE.

Core principles: diversity, structure, explicit conflict handling, transparency, scalability, flexibility, efficiency, and context management.

## v2: Dynamic Dialogue (v2.0) — Overview

v2 (v2.0) evolves the YUI system into a dynamic-dialogue model that provides "dialogue until satisfaction" rather than fixed stages. The system includes consensus-driven flow, facilitator mediation, hierarchical memory management, robust JSON parsing, and high-cost LLM finalizers.

Key improvements implemented (current state):

- **Consensus-driven dynamics**: Agents continue dialogue until genuine satisfaction is reached, measured through round-by-round consensus analysis.
- **Intelligent facilitation**: AI facilitator provides diverse interventions (deep_dive, clarification, perspective_shift, summarize, conclude, redirect) with configuration-based action priorities.
- **Hierarchical memory**: Agent-specific memory contexts separate own contributions from others' to prevent attribution errors.
- **Robust JSON parsing**: Multiple pattern matching for AI response parsing with graceful fallback mechanisms.
- **High-cost finalizers**: Selected finalizers use premium LLMs (Claude Sonnet 4, GPT-4) via '-finalizer' agent ID suffix.
- **Collaborative finalization**: Multiple finalizers work in coordinated sequence with transparent progress tracking.
- **Round 0 optimization**: Eliminated redundant facilitator execution for improved efficiency.

Key implementation locations:

- **Dynamic Router**: `src/kernel/dynamic-router.ts` - Core v2.0 dialogue orchestration
- **Facilitator Agent**: `src/agents/facilitator-agent.ts` - Action generation and JSON parsing
- **Memory Manager**: `src/kernel/memory-manager.ts` - Hierarchical memory and compression
- **v2 Prompts**: `src/templates/v2-prompts.ts` - Optimized prompts for dynamic flow
- **High-cost AI Execution**: `src/agents/base-agent.ts` - `executeAIWithFinalizerModel` method
- **Collaboration Messages**: `src/utils/collaboration-messages.ts` - User experience transparency
- **Configuration**: `src/types/v2-config.ts`, `src/config/v2-config-loader.ts` - Dynamic settings

Enablement & verification:

- Use the UI version selector (`v2.0`) to enable dynamic dialogue mode in the application.
- Configure behavior via `config/v2-settings.json` - facilitator action priorities, consensus thresholds, memory settings.
- Monitor session logs in `./logs/{sessionId}/` to observe consensus progression, facilitator actions, and high-cost LLM usage.
- Search the codebase for `dynamic-router`, `facilitator-agent`, or `executeAIWithFinalizerModel` to explore v2-specific implementations.

Quickstart (developer):

Build and start the server (production-mode server serving `dist/`):

```powershell
npm run build
npm run server
```

Start the frontend development server only:

```powershell
npm run dev
```

For detailed enablement steps, examples, and configuration options, see the `v2: Dynamic Dialogue` section in the repository `README.md`.

This section can be expanded with design artifacts (prompt examples, state diagrams, API diffs) on request.

## Architecture

High-level data flow:

```
User → Server (REST/SSE/WebSocket) → YuiProtocolRouter → SessionManager
                                         │                │
                                         ▼                ▼
                                   AgentManager      SessionStorage (FS)
                                         │                │
                                         ▼                ▼
                                  Agents (BaseAgent)  OutputStorage (FS)
                                         │                │
                                         ▼                ▼
                                  AIExecutor (impl/mock)  InteractionLogger (FS)
                                         │
                                         ▼
                                   StageSummarizer (AI)
```

## Agents

Each agent implements behavior via `src/agents/base-agent.ts` and concrete classes in `src/agents/agent-*.ts`. Agents are registered in `AgentManager` and exposed to the router.

Agent interface (effective in code):

```typescript
export interface Agent {
  id: string;
  name: string;
  furigana: string;
  style: 'logical' | 'critical' | 'intuitive' | 'meta' | 'emotive' | 'analytical';
  priority: 'precision' | 'breadth' | 'depth' | 'balance';
  memoryScope: 'local' | 'session' | 'cross-session';
  personality: string;
  preferences: string[];
  tone: string;
  communicationStyle: string;
  avatar?: string;
  color?: string;
  isSummarizer?: boolean;
  references?: string[];
  reasoning?: string;
  assumptions?: string[];
  approach?: string;
  finalizerTargets?: {
    temperature?: number;
    topP?: number;
    repetitionPenalty?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    topK?: number;
    nudgeWeight?: number;
  };
  specificBehaviors?: string;
  thinkingPatterns?: string;
  interactionPatterns?: string;
  decisionProcess?: string;
  disagreementStyle?: string;
  agreementStyle?: string;
}
```

Notes:
- Extended personality/behavior fields are supported and used for generation parameter auto-adjustment.
- `finalizerTargets` exists for optional nudging targets in finalization-related generation.

## Dialogue Stages

Supported `DialogueStage` values:
- `individual-thought`
- `mutual-reflection`
- `mutual-reflection-summary`
- `conflict-resolution`
- `conflict-resolution-summary`
- `synthesis-attempt`
- `synthesis-attempt-summary`
- `output-generation`
- `finalize` (Stage 5.1)

Stage timing and tokens are governed by prompts; there is no hard-coded timeout per stage in code, but the server applies delays between operations and summary generation (configurable, default 30s delay for summaries).

Stage purposes (as implemented):
- Stage 1: Agents produce `IndividualThought` (with summary, reasoning, assumptions, approach). Prior sequence’s user input and conclusions are included when present.
- Stage 2: Agents generate `MutualReflection` engaging with other agents’ Stage 1 outputs; simple NLP extraction creates structured reflections.
- Stage 3: Router identifies conflicts from Stage 1 approaches; agents propose resolutions (returned as `AgentResponse` with `stageData`).
- Stage 4: Router prepares `SynthesisData` mostly from Stage 3 summary; agents attempt synthesis.
- Stage 5: Router prepares `FinalData`; agents generate outputs that include an “Agent Vote and Justification” section; vote analysis runs post-stage.
- Finalize (5.1): Selected agent(s) produce final comprehensive output (distinct from vote step; prompt forbids mentioning votes).

Summary stages (2.5, 3.5, 4.5): A dedicated `StageSummarizer` runs asynchronously after a stage completes (except finalize and output-generation), then adds a `system` message with normalized summary lines.

## Core Types

Key domain types (subset):

```typescript
export type DialogueStage =
  | 'individual-thought'
  | 'mutual-reflection'
  | 'mutual-reflection-summary'
  | 'conflict-resolution'
  | 'conflict-resolution-summary'
  | 'synthesis-attempt'
  | 'synthesis-attempt-summary'
  | 'output-generation'
  | 'finalize';

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  stage?: DialogueStage;
  sequenceNumber?: number;
  metadata?: {
    reasoning?: string;
    confidence?: number;
    references?: string[];
    stageData?: StageData;
    voteFor?: string;
    voteReasoning?: string;
    voteSection?: string;
    outputFileName?: string;
    sequenceOutputFiles?: { [sequenceNumber: number]: string };
  };
}

export interface Session {
  id: string;
  title: string;
  agents: Agent[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'paused';
  currentStage?: DialogueStage;
  stageHistory: StageHistory[];
  stageSummaries?: StageSummary[];
  outputFileName?: string;
  sequenceOutputFiles?: { [sequenceNumber: number]: string };
  sequenceNumber?: number;
  language: Language;
  messageCount?: number;
  agentCount?: number;
}
```

## Orchestration & Router

The system supports two operational modes:

### v1.0 Fixed Stages (`YuiProtocolRouter`)
- Initializes agents via `AgentManager`.
- Executes predefined stage sequence: individual-thought → mutual-reflection → conflict-resolution → synthesis-attempt → output-generation → finalize.
- Triggers `StageSummarizer` after stages (except finalize/output-generation) with configured delay.
- Performs AI-based vote analysis after output-generation and selects finalizer agent(s).
- Sequences: Increments `sequenceNumber` for continued sessions, referencing previous conclusions.

### v2.0 Dynamic Dialogue (`DynamicRouter`)
- **Consensus-driven progression**: Agents dialogue until satisfaction thresholds are met, measured through round-by-round consensus analysis.
- **Facilitator interventions**: AI facilitator provides diverse actions (deep_dive, clarification, perspective_shift, summarize, conclude, redirect) based on conversation state and configuration priorities.
- **Hierarchical memory management**: Agent-specific contexts separate own contributions from others' to prevent attribution errors.
- **Collaborative finalization**: Multiple finalizers selected via democratic voting, working in coordinated sequence with transparent progress tracking.
- **High-cost LLM execution**: Finalizers automatically use premium models (Claude Sonnet 4, GPT-4) via agent ID suffix detection.
- **Robust error handling**: JSON parsing with multiple patterns and graceful fallback, comprehensive logging for debugging.
- **Round 0 optimization**: Eliminated redundant facilitator execution between Round 0 and Round 1.

## Server & Realtime IO

Server: `src/server/index.ts` (Express + HTTP + Socket.IO)
- REST endpoints:
  - `GET /api/agents`
  - `GET /api/sessions`
  - `POST /api/sessions` (create session)
  - `GET /api/sessions/:sessionId`
  - `DELETE /api/sessions/:sessionId`
  - `POST /api/sessions/:sessionId/reset`
  - `POST /api/sessions/:sessionId/start-new-sequence`
  - `GET /api/sessions/:sessionId/last-summary`
  - Realtime equivalents under `/api/realtime/...` including `POST /api/realtime/sessions/:sessionId/stage` with SSE progress streaming
- WebSocket:
  - `join-session`, `leave-session`, `stage-start`, `stage-progress`, `stage-complete`, `stage-error`, `session-complete`

Static: serves `dist/` assets and a SPA `index.html` fallback.

## Prompts & Generation Parameters

Prompts live in `src/templates/prompts.ts` and include:
- Personality prompt builder `getPersonalityPrompt` using all Agent personality fields.
- Stage prompts `getStagePrompt` for all stages; `output-generation` includes mandatory “Agent Vote and Justification”.
- Summarizer prompts for 2.5/3.5/4.5 and a dedicated `SUMMARIZER_STAGE_PROMPT` for final summaries when an agent is summarizer.
- Vote parsing helpers `parseVotes` and `extractVoteDetails` robust to multiple formats and languages.

Generation parameter auto-adjustment lives in `BaseAgent`:
- Methods: `calculateTemperature`, `calculateTopP`, `calculateRepetitionPenalty`, `calculatePresencePenalty`, `calculateFrequencyPenalty`, `calculateTopK`.
- Inputs: agent style, priority, tone, personality, preferences, and behavior fields.
- Two executors per agent are lazily created (normal and finalize/output-generation specific).

AI Executor abstraction (`src/kernel/ai-executor.ts`):
- `createAIExecutor` dynamically imports `ai-executor-impl` if present; else falls back to a mock executor that synthesizes outputs and injects a vote during `output-generation`.
- **High-cost LLM support**: Agent IDs ending with `-finalizer` automatically trigger premium models (Claude Sonnet 4, GPT-4) in `ai-executor-impl.ts`.
- Default provider is `'openai'`; StageSummarizer defaults to `'gemini'` model `gemini-2.5-flash-lite-preview-06-17` with temperature 0.5.
- **Finalizer execution**: `BaseAgent.executeAIWithFinalizerModel` method creates temporary executors with `-finalizer` suffix for collaborative finalization.

Language: prompts enforce strict language (`'en'` or `'ja'`) at generation time.

## Memory, Sessions, Outputs, and Logs

- Session storage: `SessionStorage` persists sessions to `./sessions/{id}.json` with circular reference removal and date restoration.
- Output storage: final outputs are saved per sequence; latest filename also set on `session.outputFileName` (see `OutputStorage`).
- Interaction logs: `InteractionLogger` writes simplified logs to `./logs/{sessionId}/{stage}/{agentId}.json` and can read back by session/agent/stage. BaseAgent and StageSummarizer both log prompts/outputs/durations/provider/model (when available).
- Agent memory scope is emulated via how much recent context is used per scope in BaseAgent (`local`/`session`/`cross-session`).

## Error Handling & Timeouts

- Common AI execution is wrapped with try/catch; logs record success/error, and errors propagate to server which streams SSE error messages and emits WebSocket errors.
- Sanitization removes hidden thinking tags like `<think>`.
- Vote analysis stage has robust error logging and safe fallback to empty results.

## Performance & Scalability

- Staggered agent response delays to simulate/avoid contention, configurable delay for summarization and vote analysis.
- Summaries reduce downstream prompt size.
- File-backed stores are simple to scale to network storage; further horizontal scaling requires externalizing storage.

## Security & Privacy

- CORS is enabled for local dev.
- Output sanitization in AIExecutor; API validates required fields in critical endpoints.
- For production: add authentication, rate limiting, and stricter input validation.

## Implementation Structure

```
src/
├─ agents/
│  ├─ base-agent.ts                    # Core agent functionality + executeAIWithFinalizerModel
│  ├─ facilitator-agent.ts             # v2.0: AI facilitator with robust JSON parsing
│  ├─ agent-eiro.ts
│  ├─ agent-hekito.ts
│  ├─ agent-kanshi.ts
│  ├─ agent-yoga.ts
│  └─ agent-yui.ts
├─ kernel/
│  ├─ ai-executor.ts                   # AI abstraction + high-cost LLM detection
│  ├─ dynamic-router.ts                # v2.0: Consensus-driven dialogue orchestration
│  ├─ memory-manager.ts                # v2.0: Hierarchical memory + compression
│  ├─ interaction-logger.ts
│  ├─ output-storage.ts
│  ├─ router.ts                        # v1.0: Fixed stage progression
│  ├─ session-storage.ts
│  ├─ stage-summarizer.ts
│  ├─ interfaces.ts
│  └─ services/
     ├─ agent-manager.ts
     └─ session-manager.ts
├─ config/
│  ├─ v2-config-loader.ts              # v2.0: Dynamic configuration loading
│  └─ v2-settings.json                 # v2.0: Consensus thresholds, action priorities
├─ server/
│  └─ index.ts
├─ templates/
│  ├─ prompts.ts                       # v1.0: Fixed stage prompts
│  └─ v2-prompts.ts                    # v2.0: Dynamic dialogue prompts
├─ types/
│  ├─ index.ts                         # Core types
│  ├─ consensus.ts                     # v2.0: Consensus and facilitator types
│  ├─ memory.ts                        # v2.0: Hierarchical memory types
│  └─ v2-config.ts                     # v2.0: Configuration types
├─ utils/
│  └─ collaboration-messages.ts        # v2.0: User-facing progress messages
└─ ui/
   ├─ App.tsx                          # Version selector (v1.0 vs v2.0)
   ├─ MessagesView.tsx
   ├─ ThreadHeader.tsx
   ├─ ThreadView.tsx
   └─ StageIndicator.tsx
```

Build artifacts are in `dist/`, Selenium tests in `selenium-tests/`, and unit/integration tests in `tests/`.

## Testing & Coverage

- **Unit/integration tests**: Cover agents, prompts, both routers (v1.0 & v2.0), stage summarizer, session storage, interaction logging, UI components, and vote analysis.
- **v2.0 specific tests**:
  - `facilitator-json-parsing.test.ts`: Robust JSON parsing with various AI response formats
  - `dynamic-router.test.ts`: Consensus-driven dialogue progression
  - `memory-manager.test.ts`: Hierarchical memory and compression
  - `collaboration.test.ts`: Multiple finalizer coordination
- **E2E Selenium tests**: Verify stage progression, indicators, session flows, and UI version selection.
- **Coverage**: run `npm run test:coverage`.

Key test scenarios:
- Parameter auto-adjustment: `generation-parameters.test.ts`
- v2.0 consensus flow: `consensus-analysis.test.ts`
- Facilitator action diversity: `facilitator-actions.test.ts`
- High-cost LLM detection: `ai-executor-finalizer.test.ts`
- JSON parsing robustness: `facilitator-json-parsing.test.ts`

## Operations

- Start backend server: `npm run server` (serves REST, SSE and WebSocket) and exposes SPA from `dist/`.
- Health check: `GET /api/health`.
- Logs and sessions are plain files under `./logs` and `./sessions`.

Language policy: prompts are enforced in English or Japanese as specified; default generation and system messages prefer English unless the session language is set to `'ja'`.