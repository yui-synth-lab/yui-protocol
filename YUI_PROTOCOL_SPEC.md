# YUI Protocol Specification

## Table of Contents

1. [Overview](#overview)
2. [Protocol Architecture](#protocol-architecture)
3. [Agent Specifications](#agent-specifications)
4. [Dialogue Stages](#dialogue-stages)
5. [Data Structures](#data-structures)
6. [Communication Protocol](#communication-protocol)
7. [Memory Management](#memory-management)
8. [Error Handling](#error-handling)
9. [Performance Considerations](#performance-considerations)
10. [Security Considerations](#security-considerations)
11. [Implementation Guidelines](#implementation-guidelines)

## Overview

The YUI Protocol is a structured multi-agent AI collaboration framework designed to facilitate comprehensive problem-solving through systematic dialogue. The protocol orchestrates multiple AI agents with distinct personalities and expertise areas through a 5-stage dialogue process, ensuring thorough analysis, conflict resolution, and synthesis.

### Core Principles

1. **Diversity of Perspective**: Each agent brings unique expertise and communication styles
2. **Structured Collaboration**: Systematic 5-stage process prevents chaos and ensures completeness
3. **Conflict Resolution**: Explicit handling of disagreements and synthesis of viewpoints
4. **Transparency**: Full logging and traceability of all interactions and decisions
5. **Scalability**: Modular architecture supports addition of new agents and capabilities

## Protocol Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │───▶│  Session Manager│───▶│  Agent Pool     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Interaction     │    │  Dialogue       │
                       │ Logger          │    │  Orchestrator   │
                       └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Output Storage  │    │  Memory         │
                       │                 │    │  Manager        │
                       └─────────────────┘    └─────────────────┘
```

### Agent Pool Structure

Each agent in the pool implements the following interface:

```typescript
interface Agent {
  id: string;
  name: string;
  style: "logical" | "critical" | "intuitive" | "meta" | "emotive" | "analytical";
  priority: "precision" | "breadth" | "depth" | "balance";
  memoryScope: "local" | "session" | "cross-session";
  personality: string;
  preferences: string[];
  tone: string;
  communicationStyle: string;
  avatar?: string;
}
```

## Agent Specifications

### Agent Styles

#### 1. Critical (批判的)
- **Characteristics**: Problem identification, gap detection, constructive criticism
- **Strengths**: Quality assurance, risk identification, improvement suggestions
- **Weaknesses**: May be overly negative, can slow progress
- **Best For**: Quality review, risk assessment, improvement processes

#### 2. Emotive (感情的)
- **Characteristics**: Creative expression, intuitive insights, emotional understanding
- **Strengths**: Creative synthesis, emotional intelligence, artistic expression
- **Weaknesses**: May prioritize feelings over logic, can be subjective
- **Best For**: Creative problems, emotional intelligence, artistic expression

#### 3. Intuitive (直感的)
- **Characteristics**: Creative problem-solving, innovative approaches, out-of-the-box thinking
- **Strengths**: Creative solutions, innovative thinking, practical implementation
- **Weaknesses**: May lack systematic rigor, difficult to explain reasoning
- **Best For**: Creative problems, innovation, practical solutions

#### 4. Analytical (分析的)
- **Characteristics**: Data-driven analysis, statistical reasoning, precise calculations
- **Strengths**: Data analysis, quantitative insights, objective evaluation
- **Weaknesses**: May miss qualitative factors, can be reductionist
- **Best For**: Data analysis, quantitative problems, statistical evaluation

#### 5. Logical (論理的)
- **Characteristics**: Philosophical thinking, deep analysis, systematic understanding
- **Strengths**: Deep reasoning, systematic analysis, philosophical insights
- **Weaknesses**: May be abstract, can be slow for practical problems
- **Best For**: Complex philosophical problems, deep analysis, systematic understanding

### Agent Priorities

#### Precision (精密性)
- Focus on accuracy and detail
- Prefer thorough analysis over quick solutions
- High confidence thresholds

#### Breadth (広範囲)
- Consider multiple perspectives and approaches
- Prefer comprehensive coverage over depth
- Balance multiple factors

#### Depth (深さ)
- Focus on fundamental understanding
- Prefer deep analysis over surface-level solutions
- Seek root causes and principles

#### Balance (バランス)
- Balance multiple competing factors
- Prefer compromise and integration
- Moderate confidence levels

### Memory Scopes

#### Local (局所的)
- Limited to current interaction
- Fast response, minimal context
- Suitable for simple, focused tasks

#### Session (セッション)
- Spans entire session
- Moderate context retention
- Suitable for complex, multi-step problems

#### Cross-Session (セッション間)
- Spans multiple sessions
- Long-term memory and learning
- Suitable for ongoing projects and learning

## Dialogue Stages

### Stage 1: Individual Thought (個別思考)

**Purpose**: Each agent independently analyzes the problem from their unique perspective.

**Process**:
1. Agent receives the query and context
2. Agent applies their unique perspective and expertise
3. Agent generates structured response with:
   - Initial analysis
   - Approach methodology
   - Key considerations
   - Confidence level and reasoning

**Output**: `IndividualThought` object containing structured analysis

**Time Limit**: 300 words maximum

### Stage 2: Mutual Reflection (相互反省)

**Purpose**: Agents respond to each other's thoughts with specific analysis and constructive criticism.

**Process**:
1. Each agent reviews all other agents' individual thoughts
2. Agent provides structured response with:
   - Specific agreements and disagreements
   - Missing perspectives identification
   - New insights from others' thoughts
   - Integration opportunities
   - Updated confidence level

**Output**: `MutualReflection` object containing structured responses

**Time Limit**: 400 words maximum

### Stage 3: Conflict Resolution (対立解決)

**Purpose**: Address identified conflicts with practical solutions and compromise strategies.

**Process**:
1. System identifies conflicts from mutual reflections
2. Each agent addresses conflicts with:
   - Conflict analysis
   - Impact assessment
   - Resolution strategy
   - Compromise points
   - Confidence in resolution

**Output**: `ConflictResolution` object containing resolution strategies

**Time Limit**: 350 words maximum

### Stage 4: Synthesis Attempt (統合試行)

**Purpose**: Synthesize different perspectives into a coherent framework and select a facilitator.

**Process**:
1. System attempts to synthesize all perspectives
2. Each agent provides:
   - Synthesis framework
   - Integration points
   - Remaining tensions
   - Facilitator recommendation
   - Synthesis confidence

**Output**: `SynthesisAttempt` object containing unified approach

**Time Limit**: 300 words maximum

### Stage 5: Output Generation (出力生成)

**Purpose**: Generate final synthesis and output by the selected facilitator agent.

**Process**:
1. Selected facilitator agent generates final output
2. Output incorporates all perspectives and resolutions
3. Final output includes:
   - Comprehensive solution
   - Implementation recommendations
   - Risk considerations
   - Success metrics

**Output**: Final `AgentResponse` with complete solution

**Time Limit**: 500 words maximum

## Data Structures

### Core Types

```typescript
// Agent definition
interface Agent {
  id: string;
  name: string;
  style: AgentStyle;
  priority: AgentPriority;
  memoryScope: MemoryScope;
  personality: string;
  preferences: string[];
  tone: string;
  communicationStyle: string;
  avatar?: string;
}

// Message structure
interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  stage?: DialogueStage;
  metadata?: {
    reasoning?: string;
    confidence?: number;
    references?: string[];
    stageData?: any;
  };
}

// Session management
interface Session {
  id: string;
  title: string;
  agents: Agent[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'paused';
  currentStage?: DialogueStage;
  stageHistory: StageHistory[];
}

// Stage-specific data structures
interface IndividualThought {
  agentId: string;
  content: string;
  reasoning: string;
  assumptions: string[];
  approach: string;
}

interface MutualReflection {
  agentId: string;
  content: string;
  reflections: {
    targetAgentId: string;
    reaction: string;
    agreement: boolean;
    questions: string[];
  }[];
}

interface Conflict {
  id: string;
  agents: string[];
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

interface SynthesisAttempt {
  consensus: number;
  unifiedPerspective?: string;
  remainingDisagreements?: string[];
  confidence: number;
}
```

### Interaction Logging

```typescript
interface AIInteractionLog {
  id: string;
  sessionId: string;
  stage: DialogueStage;
  agentId: string;
  agentName: string;
  timestamp: Date;
  input: {
    prompt: string;
    context: Message[];
    stageData?: any;
    language: Language;
  };
  output: {
    content: string;
    reasoning?: string;
    confidence?: number;
    stageData?: any;
    metadata?: Record<string, any>;
  };
  duration: number;
  status: 'success' | 'error' | 'timeout';
  error?: string;
}
```

## Communication Protocol

### Message Flow

1. **User Input** → Session Manager
2. **Session Manager** → Dialogue Orchestrator
3. **Dialogue Orchestrator** → Agent Pool (Stage 1)
4. **Agent Responses** → Interaction Logger
5. **Stage Completion** → Next Stage or Final Output

### Error Handling

```typescript
interface ErrorResponse {
  error: string;
  stage: DialogueStage;
  agentId?: string;
  timestamp: Date;
  retryable: boolean;
  fallbackStrategy?: string;
}
```

### Timeout Management

- **Stage Timeout**: 30 seconds per stage
- **Agent Timeout**: 10 seconds per agent response
- **Retry Strategy**: 3 attempts with exponential backoff
- **Fallback**: Continue with available responses

## Memory Management

### Memory Scopes

#### Local Memory
- **Size**: 5-10 messages
- **Retention**: Current interaction only
- **Use Case**: Simple, focused tasks

#### Session Memory
- **Size**: 50-100 messages
- **Retention**: Entire session
- **Use Case**: Complex, multi-step problems

#### Cross-Session Memory
- **Size**: 500+ messages
- **Retention**: Multiple sessions
- **Use Case**: Long-term projects and learning

### Memory Eviction Policies

1. **LRU (Least Recently Used)**: Remove oldest messages first
2. **Importance-based**: Retain high-confidence responses longer
3. **Stage-based**: Prioritize current stage context
4. **Agent-specific**: Respect agent memory scope preferences

## Error Handling

### Error Types

1. **AI Service Errors**: API failures, rate limits, model errors
2. **Network Errors**: Connection issues, timeouts
3. **Data Errors**: Invalid input, corrupted state
4. **System Errors**: Memory issues, resource exhaustion

### Error Recovery Strategies

1. **Retry with Backoff**: Exponential backoff for transient errors
2. **Fallback Responses**: Use cached or simplified responses
3. **Stage Skipping**: Skip problematic stages if possible
4. **Graceful Degradation**: Continue with available agents

### Error Logging

```typescript
interface ErrorLog {
  id: string;
  timestamp: Date;
  errorType: string;
  errorMessage: string;
  stage: DialogueStage;
  agentId?: string;
  sessionId: string;
  context: any;
  resolution?: string;
}
```

## Performance Considerations

### Optimization Strategies

1. **Parallel Processing**: Execute agent responses in parallel where possible
2. **Caching**: Cache common responses and intermediate results
3. **Streaming**: Stream responses for better user experience
4. **Resource Management**: Efficient memory and CPU usage

### Performance Metrics

- **Response Time**: Average time per stage
- **Throughput**: Messages processed per second
- **Accuracy**: User satisfaction and solution quality
- **Resource Usage**: Memory and CPU consumption

### Scalability

- **Horizontal Scaling**: Multiple server instances
- **Load Balancing**: Distribute requests across instances
- **Database Optimization**: Efficient query patterns and indexing
- **Caching Layers**: Redis for session and interaction data

## Security Considerations

### Data Protection

1. **Encryption**: Encrypt sensitive data in transit and at rest
2. **Access Control**: Role-based access to sessions and logs
3. **Audit Logging**: Comprehensive audit trails
4. **Data Minimization**: Collect only necessary data

### Privacy

1. **User Consent**: Clear consent for data collection
2. **Data Retention**: Automatic deletion of old data
3. **Anonymization**: Remove personally identifiable information
4. **Right to Deletion**: Allow users to delete their data

### API Security

1. **Authentication**: Secure API key management
2. **Rate Limiting**: Prevent abuse and ensure fair usage
3. **Input Validation**: Validate all inputs to prevent injection attacks
4. **Output Sanitization**: Sanitize outputs to prevent XSS

## Implementation Guidelines

### Code Structure

```
src/
├── agents/           # Agent implementations
│   ├── base-agent.ts # Abstract base class
│   └── agent-*.ts    # Specific agent implementations
├── kernel/           # Core system components
│   ├── ai-executor.ts
│   ├── interaction-logger.ts
│   ├── memory.ts
│   └── session-storage.ts
├── templates/        # Prompt templates
│   └── prompts.ts
├── types/            # TypeScript definitions
│   └── index.ts
└── ui/               # User interface
    ├── App.tsx
    └── components/
```

### Testing Strategy

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Performance Tests**: Test system under load

### Deployment

1. **Environment Configuration**: Separate configs for dev/staging/prod
2. **Health Checks**: Monitor system health and performance
3. **Logging**: Comprehensive logging for debugging and monitoring
4. **Backup Strategy**: Regular backups of session and interaction data

### Monitoring

1. **Application Metrics**: Response times, error rates, throughput
2. **Infrastructure Metrics**: CPU, memory, disk usage
3. **Business Metrics**: User engagement, session completion rates
4. **Alerting**: Proactive alerts for issues and anomalies

## Version History

### v1.0.0 (Current)
- Initial implementation of 5-stage dialogue protocol
- 5 specialized agents with distinct personalities
- Real-time interaction logging
- Session management and persistence
- React-based user interface

### Future Versions
- Additional agent types and personalities
- Advanced conflict resolution algorithms
- Machine learning for agent optimization
- Enhanced visualization and analytics
- Multi-language support expansion 