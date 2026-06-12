# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What

Multi-agent philosophical dialogue system where multiple AI agents discuss themes and generate emergent insights. Two parallel routing systems coexist: v1.0 (fixed stage) and v2.0 (dynamic consensus-driven).

## Commands

```bash
npm run build          # Vite frontend + tsc server (must pass before merging)
npm run dev            # Frontend dev server (port 3000)
npm run dev:server     # Backend API server (port 3001) — requires built dist/
npm run test           # Run all Vitest tests (non-interactive)
npm run test:coverage  # With coverage report

# Run a single test file
npx vitest run tests/router.test.ts

# RAG index management
npm run rag:index-outputs   # Index dialogue outputs into LanceDB
npm run rag:index-sessions  # Index session data
npm run rag:stats           # Show vector store statistics
```

**Validation order**: `npm run build` → `npm run test`. Type errors are caught at build time.

## Architecture

### Dual Router System

- **v1.0** ([src/kernel/router.ts](src/kernel/router.ts)): `YuiProtocolRouter` — fixed dialogue stages: `individual_thought → mutual_reflection → conflict → synthesis → final`. Stages are executed sequentially via `executeStageRealtime()`.
- **v2.0** ([src/kernel/dynamic-router.ts](src/kernel/dynamic-router.ts)): `DynamicDialogueRouter` — round-based, continues until consensus threshold is reached (`convergenceThreshold` in `config/v2-settings.json`). Uses a `FacilitatorAgent` to direct each round.

Both routers share a `SessionStorage` instance and emit progress via WebSocket (Socket.IO).

### Agent System

Each agent in [src/agents/](src/agents/) extends `BaseAgent` ([src/agents/base-agent.ts](src/agents/base-agent.ts)) and declares a static config (`Agent` type) with personality, model config, and style. Agent model/provider can be overridden per-agent via env vars: `AGENT_YUI_000_PROVIDER`, `AGENT_YUI_000_MODEL`, `AGENT_YUI_000_FINALIZER_MODEL`.

Agents: **Yui** (emotive/breadth), **Eiro** (logical), **Kanshi** (critical), **Yoga** (intuitive), **Hekito** (analytical), **Facilitator** (meta, v2.0 only). The agent roster lives in [src/agents/registry.ts](src/agents/registry.ts) (single source of truth); construction is wired through [src/bootstrap/](src/bootstrap/index.ts).

`BaseAgent` implements the `DialogueAgent` port ([src/dialogue/contracts.ts](src/dialogue/contracts.ts)) and manages:

- `MemoryManager` — hierarchical memory compression, triggered above `memory.tokenThreshold` (recent messages kept verbatim, older messages compressed via the `summary` model tier)
- `RAGRetriever` — optional RAG context injection per agent turn
- `AIExecutor` instances obtained from a cached `ExecutorFactory`: normal turns, finalization (optionally a different model), and optional cheap-model task tiers (`modelTiers.mechanical` / `modelTiers.summary` in `config/v2-settings.json`)

Generation parameters are derived from personality by pure functions in [src/agents/generation-parameters.ts](src/agents/generation-parameters.ts); response-text parsing lives in [src/dialogue/parsing/response-parsers.ts](src/dialogue/parsing/response-parsers.ts); vote parsing in [src/dialogue/voting/vote-parser.ts](src/dialogue/voting/vote-parser.ts).

### AI Execution

[src/kernel/ai-executor.ts](src/kernel/ai-executor.ts) is an abstract class. [src/kernel/ai-executor-impl.ts](src/kernel/ai-executor-impl.ts) provides concrete implementations for: `openai`, `anthropic`, `gemini`, `gemini-cli`, `ollama`, `custom`. Provider is selected per-agent from `modelConfig.provider`.

### Server & API

[src/server/index.ts](src/server/index.ts) — Express 5 + Socket.IO server on port 3001. Serves built React frontend from `dist/`. WebSocket events broadcast per-message progress during dialogue execution. Sessions are identified by UUID and stored in `SessionStorage` (in-memory with file persistence via `OutputStorage`).

Key REST endpoints:

- `POST /api/sessions` — create session (v1.0 or v2.0)
- `POST /api/sessions/:id/stages/:stage` — execute a v1.0 stage
- `POST /api/sessions/:id/dynamic` — run v2.0 dynamic dialogue
- `GET /api/agents` — list available agents

### RAG System

[src/kernel/rag/](src/kernel/rag/) — LanceDB-backed vector store (`vectordb` package). Documents are embedded and retrieved to provide historical context during dialogue. Configured via `config/rag-config.json`. Agents with `memoryScope: 'cross-session'` can access RAG-retrieved context.

### Configuration

- `config/v2-settings.json` — consensus thresholds, memory limits, facilitator action priorities, collaborative finalization settings
- `config/rag-config.json` — RAG embedding and retrieval settings
- `src/config/v2-config-loader.ts` — singleton `V2ConfigLoader` for runtime config access

### Templates

- [src/templates/prompts.ts](src/templates/prompts.ts) — v1.0 stage prompts, personality formatting, vote extraction
- [src/templates/v2-prompts.ts](src/templates/v2-prompts.ts) — v2.0 round guidance, facilitator prompts

## Design Principles

1. **Backward compatibility**: v1.0 must never break. New features are added in parallel.
2. **Agent individuality**: Each agent's personality, memory style, and thinking patterns must be respected and not homogenized.
3. **Token cost awareness**: Monitor token usage; memory compression targets 30% of original token count.
4. **Transparency**: Compression and summarization processes are logged.

## Skills & Sub-agents

| Tool | Use for |
| ---- | ------- |
| `/create-agent` | Adding new agents |
| `/run-tests` | Running and fixing tests |
| `/rag-index` | Managing RAG indexes |
| `/implement-v2` | v2.0 feature work |
| `/gemini-analyze` | Large codebase analysis via Gemini CLI |
| `code-reviewer` agent | Code quality review |
| `v2-implementer` agent | Specialized v2.0 implementation |

## Key Docs

- [docs/v2-implementation-plan.md](docs/v2-implementation-plan.md) — v2.0 phased implementation plan
- [docs/RAG-GUIDE.md](docs/RAG-GUIDE.md) — RAG system guide
- [config/README.md](config/README.md) — configuration reference
