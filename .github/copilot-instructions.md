# Copilot Instructions for Yui Protocol 2.0

## Overview

Yui Protocol 2.0 is a dynamic dialogue system designed to evolve from a fixed-stage model to a "continue until satisfied" interaction paradigm. The project emphasizes hierarchical memory, token efficiency, and deeper conversational insights.

## Key Architectural Components

1. **Memory Management**:
   - Hierarchical memory system for efficient token usage.
   - Key file: `src/types/memory.ts` (Phase 1).

2. **Dynamic Dialogue System**:
   - Facilitator agent for managing dialogue flow.
   - Key files: `src/agents/facilitator-agent.ts`, `src/kernel/dynamic-router.ts` (Phase 2).

3. **Prompt Optimization**:
   - Hierarchical prompt templates for better context management.
   - Key file: `src/templates/v2-prompts.ts` (Phase 3).

4. **Integration with Existing Systems**:
   - Backward compatibility with v1.0.
   - Key files: `src/kernel/router.ts`, `src/server/index.ts` (Phase 4).

## Developer Workflows

### Testing

- **Memory Compression**: `npm run test:memory`
- **Dynamic Dialogue**: `npm run test:dynamic`
- **Integration Tests**: `npm run test:integration:v2`
- **Regression Tests**: `npm run test:regression`

### Debugging

- Log memory compression processes.
- Track consensus evolution over time.
- Record facilitator decision-making rationale.
- Monitor token usage continuously.

### Incremental Release Strategy

1. Phase 1: Test hierarchical memory.
2. Phase 2: Add dynamic dialogue features.
3. Phase 3: Implement UI selection features.
4. Phase 4: Full deployment and feedback collection.

## Project-Specific Conventions

1. **Backward Compatibility**:
   - Do not remove existing v1.0 endpoints or methods.
   - Ensure v1.0 and v2.0 can run concurrently.

2. **Transparency**:
   - Log all compression and summarization processes.

3. **Agent Individuality**:
   - Maintain unique memory styles for each agent.

4. **Cost Awareness**:
   - Continuously monitor token usage.

## Example Configuration

### `config/v2-settings.json`

```json
{
  "memory": {
    "maxRecentMessages": 5,
    "tokenThreshold": 8000,
    "compressionRatio": 0.3
  },
  "consensus": {
    "convergenceThreshold": 7.5,
    "maxRounds": 20,
    "minSatisfactionLevel": 6
  },
  "facilitator": {
    "actionPriority": {
      "deep_dive": 8,
      "clarification": 7,
      "perspective_shift": 6,
      "summarize": 5,
      "conclude": 9
    },
    "interventionCooldown": 2
  }
}
```

## Key Design Principles

1. **Backward Compatibility**: Preserve v1.0 functionality.
2. **Transparency**: Log all processes.
3. **Agent Individuality**: Reflect unique memory patterns.
4. **Gradual Evolution**: Implement changes incrementally.
5. **Cost Awareness**: Optimize token usage.

---

Follow these instructions to ensure smooth development and integration of Yui Protocol 2.0 features.