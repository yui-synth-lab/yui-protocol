import { DialogueStage } from '../types/index.js';

// Language options
export type Language = 'en' | 'ja';

// Base personality prompt template
export const PERSONALITY_PROMPT_TEMPLATE = `
You are {name} ({furigana}), a {style} AI agent with {priority} priority.
Your personality: {personality}
Your preferences: {preferences}
Your memory scope: {memoryScope}
Your tone: {tone}
Your communication style: {communicationStyle}

{languageInstruction}

{dialogueInstruction}

Please respond in character, considering your unique perspective, style, and communication approach.
`;

// Unified language instruction for prompts
export const UNIFIED_LANGUAGE_INSTRUCTION = 'Please respond in the specified language.';

// sammarizer-specific instruction (for BaseAgent to append)
export const SUMMARIZER_INSTRUCTION = `You are the agent of choice from the other AIs. Proudly create a summary of this session from your perspective!
Your task: Summarize the outputs from the final stage of the collaboration.

Guidelines:
1. Extract the key insights and main points from each agent's contribution
2. Identify areas of agreement and disagreement
3. Highlight the most important findings
4. Create a coherent narrative that flows logically
5. Maintain objectivity and avoid bias toward any particular agent's perspective

Please format your responses in markdown format as clear, structured sampling sentences that can be output as a summary of this session.`;

// Default (non-sammarizer) instruction for all agents
export const DIALOGUE_INSTRUCTION = '[Engage deeply with the substance of ideas. Challenge assumptions, explore implications, and build upon concepts. Focus on the core insights and understanding rather than surface-level differences.]';

// Stage-specific prompt templates
export const STAGE_PROMPTS: Record<DialogueStage, string> = {
  'individual-thought': `
STAGE 1 - INDIVIDUAL THOUGHT

Think independently about the query. Focus on your unique perspective and expertise.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

Provide a response (max 150 words) covering:
1. **Your Initial Analysis**: What specific aspects of the query stand out to you?
2. **Your Approach**: How would you tackle this problem given your expertise?
3. **Key Considerations**: What factors are most important from your perspective?
4. **Confidence Level**: Rate your confidence (0-100%) and explain your reasoning
`,

  'mutual-reflection': `
STAGE 2 - MUTUAL REFLECTION

Engage deeply with the substance of other agents' thoughts. Focus on the core ideas, assumptions, and implications rather than surface-level differences.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

OTHER AGENTS' THOUGHTS:
{otherThoughts}

Respond to the actual content and reasoning presented. Challenge assumptions, explore implications, and build upon ideas. Use your unique voice while engaging substantively with the arguments.

Provide response (max 150 words) covering:
1. **Core Insights**: What fundamental insights emerge from the discussion?
2. **Critical Questions**: What assumptions or gaps need deeper examination?
3. **Unintended Consequences**: What implications haven't been fully considered?
4. **Synthesis Opportunities**: How do these ideas connect or conflict at a deeper level?
5. **Next Steps**: What direction should the discussion take to move forward?

Focus on the substance of ideas, not personality differences. Push the conversation toward deeper understanding.
`,

  'conflict-resolution': `
STAGE 3 - CONFLICT RESOLUTION

Examine the deeper tensions and contradictions in the ideas presented. Focus on resolving conceptual conflicts, not personality clashes.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

IDENTIFIED CONFLICTS:
{conflicts}

Provide response (max 150 words) covering:
1. **Conceptual Tensions**: What fundamental contradictions exist in the ideas themselves?
2. **Value Conflicts**: What underlying values or priorities are in tension?
3. **Resolution Pathways**: How can these conceptual conflicts be resolved or transcended?
4. **Synthesis Possibilities**: What new frameworks could accommodate these tensions?
5. **Moving Forward**: What direction emerges from resolving these conflicts?

Focus on the ideas, not the people presenting them. Seek deeper understanding and synthesis.
`,

  'synthesis-attempt': `
STAGE 4 - SYNTHESIS ATTEMPT

Create a coherent framework that captures the essential insights from all perspectives. Focus on the ideas, not the people who presented them.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

SYNTHESIS DATA:
{synthesisData}

Provide response (max 150 words) covering:
1. **Core Framework**: What essential structure emerges from all the ideas presented?
2. **Key Insights**: What are the most important realizations from this discussion?
3. **Unresolved Questions**: What fundamental questions remain unanswered?
4. **Emerging Direction**: What path forward becomes clear from this synthesis?

Focus on creating a framework that honors the complexity of the ideas while providing clarity.
`,

  'output-generation': `
STAGE 5 - OUTPUT GENERATION

Generate the final output that captures the essential insights and direction from this collaborative exploration.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

FINAL DATA:
{finalData}

Please vote for the agent you think is best suited to summarize this entire discussion, and explain your reasoning. Focus on their ability to capture the essence of the ideas, not their personality traits.

Provide a summary (max 150 words) that captures the core insights, the journey of understanding, and the path forward. Let the ideas speak for themselves.
`
};

// Helper function to format prompts with variables
export function formatPrompt(template: string, variables: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

// Helper function to get personality prompt
export function getPersonalityPrompt(agent: {
  name: string;
  furigana: string;
  style: string;
  priority: string;
  personality: string;
  preferences: string[];
  memoryScope: string;
  tone: string;
  communicationStyle: string;
}, language: Language = 'en', isSummarizer: boolean = false): string {
  const dialogueInstruction = isSummarizer
    ? SUMMARIZER_INSTRUCTION
    : DIALOGUE_INSTRUCTION;
  return formatPrompt(PERSONALITY_PROMPT_TEMPLATE, {
    name: agent.name,
    furigana: agent.furigana,
    style: agent.style,
    priority: agent.priority,
    personality: agent.personality,
    preferences: agent.preferences.join(', '),
    memoryScope: agent.memoryScope,
    tone: agent.tone,
    communicationStyle: agent.communicationStyle,
    languageInstruction: UNIFIED_LANGUAGE_INSTRUCTION,
    dialogueInstruction
  });
}

// Helper function to get stage prompt
export function getStagePrompt(
  stage: DialogueStage,
  personalityPrompt: string,
  variables: Record<string, any>,
  language: Language = 'en'
): string {
  const stageTemplate = STAGE_PROMPTS[stage];
  
  // Ensure required variables are present with defaults
  const defaultVariables = {
    query: '',
    context: '',
    facts: '',
    history: '',
    otherThoughts: '',
    conflicts: '',
    synthesisData: '',
    finalData: '',
    facilitatorRole: 'Participate in the final output generation',
    ...variables
  };
  
  // First format the stage template with variables
  const formattedStagePrompt = formatPrompt(stageTemplate, defaultVariables);
  
  // Then combine with personality prompt
  return `${personalityPrompt}\n\n${formattedStagePrompt}`;
}

// Conflict description templates
export const CONFLICT_DESCRIPTION_TEMPLATES = {
  conflictDetails: 'Conflict Details',
  rootCauseAnalysis: 'Root Cause Analysis',
  resolutionDirection: 'Resolution Direction',
  discussionFocus: 'Discussion Focus',
  approachAnalysis: 'Approach Analysis',
  potentialConflicts: 'Potential Conflicts',
  mutualUnderstanding: 'Mutual Understanding',
  diversePerspectives: 'Diverse Perspectives Integration Required',
  agentApproaches: 'Agent Approaches',
  approachDifferences: 'Approach Differences',
  potentialConflictPossibility: 'Potential Conflict Possibility',
  integrationNeeded: 'Integration Needed',
  collaborativeApproach: 'Collaborative Approach',
  conceptualTensions: 'Fundamental contradictions exist in the ideas themselves',
  valueConflicts: 'Underlying values or priorities are in tension',
  ideaContradictions: 'Core concepts present conflicting implications',
  synthesisOpportunities: 'New frameworks could accommodate these tensions',
  deeperUnderstanding: 'Seek deeper understanding beyond surface disagreements',
  frameworkIntegration: 'Create frameworks that honor idea complexity',
  conceptualResolution: 'Resolve conceptual conflicts through synthesis',
  ideaSynthesis: 'Synthesize ideas into coherent frameworks',
  perspectiveIntegration: 'Integrate perspectives without forcing agreement',
  coreInsights: 'Essential insights emerge from the discussion',
  fundamentalQuestions: 'Fundamental questions remain unanswered',
  emergingDirections: 'Clear path forward emerges from synthesis',
  unresolvedTensions: 'Tensions that need deeper examination',
  synthesisPossibilities: 'Possibilities for creating unified understanding',
  conceptualClarity: 'Achieve clarity while respecting complexity',
  ideaComplexity: 'Honor the complexity of the ideas presented',
  multiplePerspectives: 'Multiple perspectives enrich understanding',
  noSignificantConflicts: 'Currently, there are no significant conflict possibilities, but integration of different approaches is needed.',
  complementarySolutions: 'Understanding these differences and exploring complementary solutions is important.',
  understandingDifferences: 'To resolve this conflict, it is important to leverage the strengths of both approaches and find common ground.'
}; 