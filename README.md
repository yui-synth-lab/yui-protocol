# YUI Protocol

A sophisticated multi-agent AI collaboration system that implements structured dialogue protocols for enhanced problem-solving and decision-making.

## Overview

YUI Protocol is an advanced AI collaboration framework that orchestrates multiple AI agents through a structured 5-stage dialogue process. Each agent has unique personalities, expertise areas, and communication styles, enabling rich, multi-perspective analysis and synthesis of complex problems.

## Features

- **Multi-Agent Collaboration**: 5 specialized AI agents with distinct personalities and expertise
- **Structured Dialogue Protocol**: 5-stage process ensuring comprehensive analysis
- **Real-time Session Management**: Persistent session storage with full conversation history
- **Modern Web Interface**: React-based UI with real-time updates and compact design
- **URL-based Session Access**: Direct session access via URL routing
- **TypeScript Architecture**: Fully typed codebase for reliability and maintainability
- **Comprehensive Testing**: Extensive test coverage with Vitest
- **Robust Error Handling**: Graceful error handling and fallback mechanisms
- **AI Provider Flexibility**: Support for multiple AI providers (Gemini, OpenAI, Anthropic, custom)

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
Final synthesis and output generation by the selected facilitator agent.

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

# Build for production
npm run build

# Preview production build
npm run preview
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
│   ├── interaction-logger.ts
│   ├── memory.ts
│   ├── session-storage.ts
│   ├── realtime-router.ts
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
- `interaction-logger.ts`: Interaction logging system (simplified)
- `memory.ts`: Memory management with scope-based retention
- `session-storage.ts`: Session persistence and management
- `realtime-router.ts`: Real-time communication and session handling
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
npm run test:run -- --coverage
```

## Recent Updates

### v1.1.0
- **UI Improvements**: Compact design for maximum message display area
- **URL Routing**: Direct session access via URL with React Router
- **Error Handling**: Enhanced error handling and fallback mechanisms
- **Simplified Logging**: Streamlined interaction logging system
- **Performance**: Optimized state management and reduced flickering
- **Testing**: Comprehensive test coverage with all tests passing

### v1.0.0
- Initial implementation of 5-stage dialogue protocol
- 5 specialized agents with distinct personalities
- Real-time interaction logging
- Session management and persistence
- React-based user interface

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

## Support

For questions, issues, or contributions, please open an issue on GitHub or contact the development team. 