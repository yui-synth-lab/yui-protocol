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

v2 (v2.0) evolves the YUI system into a dynamic-dialogue model. In addition to the original fixed-stage flow, v2 adds a facilitator-style mediation layer, hierarchical memory management, asynchronous/delayed summarization, and finalizer selection driven by vote analysis.

Key changes (high level):

- Stage progression moves from a fixed sequence to a consensus-driven dynamic flow.
- A facilitator component is introduced to intervene, summarize, and shift perspectives where appropriate.
- Memory becomes hierarchical and applies compression/summarization to improve token efficiency.
- Vote analysis is used to select one or more finalizer agents and drive final output generation.

Representative implementation locations:

- Config: `config/v2-settings.json` and `config/README.md` (v2 notes and defaults)
- v2 settings type: `src/types/v2-config.ts`
- Router / facilitator hooks: `src/kernel/router.ts` (v2 hooks and comments)
- Memory manager: `src/kernel/memory-manager.ts` (v2 memory settings loader)
- Prompts: `src/templates/prompts.ts` (FACILITATOR STAGE notes) and `src/templates/v2-prompts.ts`
- UI: `src/ui/App.tsx` (v2 option available in version selector)

Enablement & verification:

- Check or edit `config/v2-settings.json` to tune v2 behavior. The UI version selector (`v2.0`) toggles v2 behavior in the application.
- Search (grep) the codebase for `FACILITATOR STAGE`, `dynamic-router`, or `memory-manager` to find v2-specific code paths and comments.

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

`YuiProtocolRouter` coordinates stage execution:
- Initializes agents via `AgentManager`.
- Ensures user message exists per sequence.
- Executes stage-specific methods on agent instances.
- Pushes agent messages with `stageData` back into the session.
- Triggers `StageSummarizer` after stages (except finalize/output-generation) with a configured delay.
- After `output-generation`, performs AI-based vote analysis and annotates messages with `voteFor` and `voteReasoning`.
- Selects finalizer agent(s) from votes (fallback to `yui-000` if none), runs `finalize`, marks session completed, saves final output (Markdown) per sequence.

Sequences: When a session is completed and Stage 1 is requested again, the router increments `sequenceNumber` and continues, referencing previous sequence’s user input and final conclusions when generating prompts.

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
- Default provider in the base class is `'openai'`; StageSummarizer defaults to `'gemini'` model `gemini-2.5-flash-lite-preview-06-17` with temperature 0.5.

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
│  ├─ base-agent.ts
│  ├─ agent-eiro.ts
│  ├─ agent-hekito.ts
│  ├─ agent-kanshi.ts
│  ├─ agent-yoga.ts
│  └─ agent-yui.ts
├─ kernel/
│  ├─ ai-executor.ts
+  ├─ interaction-logger.ts
  ├─ output-storage.ts
  ├─ router.ts
  ├─ session-storage.ts
  ├─ stage-summarizer.ts
  ├─ interfaces.ts
  └─ services/
     ├─ agent-manager.ts
     └─ session-manager.ts
├─ server/
│  └─ index.ts
├─ templates/
│  └─ prompts.ts
├─ types/
│  └─ index.ts
└─ ui/
   ├─ App.tsx
   ├─ MessagesView.tsx
   ├─ ThreadHeader.tsx
   ├─ ThreadView.tsx
   └─ StageIndicator.tsx
```

Build artifacts are in `dist/`, Selenium tests in `selenium-tests/`, and unit/integration tests in `tests/`.

## Testing & Coverage

- Unit/integration tests cover agents, prompts, router, stage summarizer, session storage, interaction logging, UI components, and vote analysis.
- E2E Selenium tests verify stage progression, indicators, session id, message counts, and UI flows.
- Coverage: run `npm run test:coverage`.

Recommended scenarios:
- Parameter auto-adjustment tests (`generation-parameters.test.ts`).
- Type fields presence and defaults (`types-extended.test.ts`).
- Router stage flows and summaries (`router.test.ts`, `stage-summarizer.test.ts`).

## Operations

- Start backend server: `npm run server` (serves REST, SSE and WebSocket) and exposes SPA from `dist/`.
- Health check: `GET /api/health`.
- Logs and sessions are plain files under `./logs` and `./sessions`.

Language policy: prompts are enforced in English or Japanese as specified; default generation and system messages prefer English unless the session language is set to `'ja'`.