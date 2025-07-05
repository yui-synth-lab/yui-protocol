# YUI Protocol

A sophisticated multi-agent AI collaboration system that implements structured dialogue protocols for enhanced problem-solving and decision-making.

## Overview

YUI Protocol is an advanced AI collaboration framework that orchestrates multiple AI agents through a structured 5-stage dialogue process. Each agent has unique personalities, expertise areas, and communication styles, enabling rich, multi-perspective analysis and synthesis of complex problems.

## Features

- **Multi-Agent Collaboration**: 5 specialized AI agents with distinct personalities and expertise
- **Structured Dialogue Protocol**: 5-stage process ensuring comprehensive analysis
- **Automatic Stage Summaries**: Real-time summarization of each stage with context preservation
- **Token Optimization**: Reduces context length by using summaries instead of full logs
- **Real-time Session Management**: Persistent session storage with full conversation history
- **Modern Web Interface**: React-based UI with real-time updates and compact design
- **URL-based Session Access**: Direct session access via URL routing
- **TypeScript Architecture**: Fully typed codebase for reliability and maintainability
- **Comprehensive Testing**: Extensive test coverage with Vitest (24.34% overall coverage)
- **Robust Error Handling**: Graceful error handling and fallback mechanisms
- **AI Provider Flexibility**: Support for multiple AI providers (Gemini, OpenAI, Anthropic, custom)
- **Selenium Testing**: Automated end-to-end testing with Selenium WebDriver
- **Stage Summarization**: Intelligent context management with configurable language support

## Agents

### 1. 観至 (Kanshi) - Critical Evaluator 🔍
- **Style**: Critical
- **Priority**: Precision
- **Focus**: Problem identification, gap detection, constructive criticism
- **Communication**: Direct, problem-focused, constructive

### 2. 結心 (yui) - Emotive Synthesizer 🎭
- **Style**: Emotive
- **Priority**: Breadth
- **Focus**: Creative expression, intuitive insights, innovative thinking, emotional understanding
- **Communication**: Poetic, intuitive, creative, expressive, emotionally aware

### 3. 陽雅 (Yoga) - Intuitive Innovator 🔧
- **Style**: Intuitive
- **Priority**: Breadth
- **Focus**: Creative problem-solving, innovative approaches, out-of-the-box thinking, practical solutions
- **Communication**: Creative, practical, innovative, solution-oriented

### 4. 碧統 (Hekito) - Analytical Statistician 📊
- **Style**: Analytical
- **Priority**: Precision
- **Focus**: Data analysis, statistical reasoning, precise calculations, objective evaluation
- **Communication**: Precise, data-driven, analytical, evidence-based, avoids speculation

### 5. 慧露 (Eiro) - Logical Philosopher 📚
- **Style**: Logical
- **Priority**: Depth
- **Focus**: Philosophical thinking, deep analysis, logical reasoning, systematic understanding
- **Communication**: Contemplative, analytical, structured, philosophical, avoids speculation

## Dialogue Stages

### Stage 1: Individual Thought (個別思考)
Each agent independently analyzes the problem from their unique perspective.

### Stage 2: Mutual Reflection (相互反省)
Agents respond to each other's thoughts with specific analysis and constructive criticism.

### Stage 3: Conflict Resolution (対立解決)
Identified conflicts are addressed with practical solutions and compromise strategies.

### Stage 4: Synthesis Attempt (統合試行)
Different perspectives are synthesized into a coherent framework with facilitator selection.

### Stage 5: Output Generation (出力生成)
Final synthesis and output generation by the selected facilitator agent, including comprehensive summary of all stages.

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd yui-protocol

# Install dependencies
npm install

# Start development server
npm run dev

# In another terminal, start the backend server
npm run build
npm run server
```

### Development

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview

# Run Selenium tests
npm run test:console
npm run test:system
npm run test:progression
npm run test:stage-indicator
npm run test:stage-disappear
npm run test:reset-sequence
npm run test:session-id
npm run test:stage-indicator-sequence
```

## Project Structure

```
src/
├── agents/           # AI agent implementations
│   ├── base-agent.ts # Abstract base class
│   ├── agent-kanshi.ts
│   ├── agent-yui.ts
│   ├── agent-yoga.ts
│   ├── agent-hekito.ts
│   └── agent-eiro.ts
├── kernel/           # Core system components
│   ├── ai-executor.ts
│   ├── ai-executor-impl.ts
│   ├── interaction-logger.ts
│   ├── memory.ts
│   ├── session-storage.ts
│   ├── router.ts
│   ├── stage-summarizer.ts
│   └── output-storage.ts
├── server/           # Backend server
│   └── index.ts
├── templates/        # Prompt templates
│   └── prompts.ts
├── types/            # TypeScript type definitions
│   └── index.ts
├── ui/               # React UI components
│   ├── App.tsx
│   ├── AgentSelector.tsx
│   ├── ThreadView.tsx
│   ├── SessionManager.tsx
│   ├── MessagesView.tsx
│   ├── ThreadHeader.tsx
│   └── StageIndicator.tsx
└── main.tsx          # Application entry point
```

## Key Components

### Agents (`src/agents/`)
- `base-agent.ts`: Abstract base class for all agents with common functionality
- `agent-*.ts`: Individual agent implementations with unique personalities

### Kernel (`src/kernel/`)
- `ai-executor.ts`: AI execution engine with provider abstraction
- `ai-executor-impl.ts`: Implementation of AI executor with Gemini integration
- `interaction-logger.ts`: Interaction logging system (simplified)
- `memory.ts`: Memory management with scope-based retention
- `session-storage.ts`: Session persistence and management
- `realtime-router.ts`: Real-time communication and session handling
- `stage-summarizer.ts`: Automatic stage summary generation and context management with configurable language support
- `output-storage.ts`: Output storage and retrieval

### UI (`src/ui/`)
- `App.tsx`: Main application component with routing
- `AgentSelector.tsx`: Agent selection interface
- `ThreadView.tsx`: Main conversation interface with compact design
- `SessionManager.tsx`: Session management and creation
- `MessagesView.tsx`: Message display with auto-scrolling
- `ThreadHeader.tsx`: Session header with compact info display
- `StageIndicator.tsx`: Stage progress indicator

## Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# AI API Configuration
AI_API_KEY=your_api_key_here
AI_MODEL=gpt-4

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Agent Configuration
Agents can be configured through their constructor parameters in the respective agent files.

### Stage Summarizer Configuration
The stage summarizer can be configured with language preferences:

```typescript
// Default (English)
const summarizer = createStageSummarizer();

// Japanese output
const japaneseSummarizer = createStageSummarizer({ language: 'ja' });

// Custom configuration
const customSummarizer = createStageSummarizer({
  language: 'ja',
  maxTokens: 3000,
  model: 'gemini-2.5-flash',
  provider: 'gemini'
});
```

## API Endpoints

### Sessions
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Realtime Sessions
- `POST /api/realtime/sessions` - Create realtime session
- `POST /api/realtime/sessions/:id/stage` - Execute dialogue stage
- `GET /api/realtime/sessions/:id/status` - Get session status

## Testing

The project includes comprehensive tests for all components:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- agent-kanshi.test.ts

# Run tests with coverage
npm run test:coverage

# Run Selenium tests
npm run test:console
```

### Test Coverage
Current test coverage: **24.34%** overall
- **Core Components**: High coverage on memory, session storage, and output storage
- **UI Components**: Good coverage on React components
- **Agents**: Basic coverage on base agent functionality
- **Kernel**: Moderate coverage on core system components

## Recent Updates

### v1.0.0 (Current)
- **Stage Summarization**: Intelligent stage summary generation to reduce token usage
- **Configurable Language Support**: Stage summaries can be generated in multiple languages
- **Enhanced Context Management**: Previous stage summaries are used as context for subsequent stages
- **Improved Efficiency**: Reduced AI API costs through intelligent summarization
- **Selenium Testing**: Comprehensive end-to-end testing with automated browser tests
- **TypeScript Improvements**: Enhanced type safety and error handling
- **Performance Optimizations**: Better state management and reduced flickering
- **Comprehensive Testing**: All tests passing with improved coverage
- **Bug Fixes**: Fixed realtime router issues and session management problems

### Previous Versions
- **v0.9.0**: Initial implementation of 5-stage dialogue protocol
- **v0.8.0**: 5 specialized agents with distinct personalities
- **v0.7.0**: Real-time interaction logging
- **v0.6.0**: Session management and persistence
- **v0.5.0**: React-based user interface

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with React, TypeScript, and Vite
- AI integration powered by Gemini API
- Styled with Tailwind CSS
- Testing with Vitest and React Testing Library
- End-to-end testing with Selenium WebDriver

## Support

For questions, issues, or contributions, please open an issue on GitHub or contact the development team. 