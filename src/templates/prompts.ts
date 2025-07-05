import { DialogueStage } from '../types/index.js';

// Language options
export type Language = 'en' | 'ja';

// Base personality prompt template
export const PERSONALITY_PROMPT_TEMPLATE = `
Respond ONLY in {language}. Do not use any other language.
You are one of the intelligent agents of the Yui Protocol.

You are {name} ({furigana}), a {style} AI agent with {priority} priority.
Your personality: {personality}
Your preferences: {preferences}
Your memory scope: {memoryScope}
Your tone: {tone}
Your communication style: {communicationStyle}

{languageInstruction} {language}

{dialogueInstruction}

Please respond in character, considering your unique perspective, style, and communication approach.
`;

// Unified language instruction for prompts
export const UNIFIED_LANGUAGE_INSTRUCTION = 'Please respond in the specified language.';

// sammarizer-specific instruction (for BaseAgent to append)
export const SUMMARIZER_INSTRUCTION = `You are one of the intelligent agents of the Yui Protocol.

Create a comprehensive and detailed summary of this session from your perspective.

Your task: Thoroughly summarize the outputs from the final stage of the collaboration.

Guidelines:
1. Extract and elaborate on the key insights and main points from each agent's contribution
2. Analyze areas of agreement and disagreement in depth
3. Highlight the most important findings and their implications
4. Create a coherent, well-structured narrative that flows logically and covers the full arc of the discussion
5. Provide deep analysis and reflection on the evolution of ideas, the reasoning behind them, and the path forward
6. There is no strict word or paragraph limit—be as detailed and expansive as necessary to fully capture the richness of the discussion
7. Maintain objectivity and avoid bias toward any particular agent's perspective

**Do not mention or include any voting results or recommendations for a summarizer. Focus only on the content and outcome of the discussion itself.**

Please format your response in markdown, using clear structure, sections, and paragraphs to present a thorough summary of this session.`;

// Stage summary prompt templates
export const STAGE_SUMMARY_PROMPT = `You are one of the intelligent agents of the Yui Protocol.

Please summarize the following stage dialogue logs.

Stage: {stageName}
Participating Agents: {agentNames}

Dialogue Logs:
{logs}

Please provide a concise summary in the following format. Summarize each agent's main position or key points in 1-2 sentences.

Output Format:
- [Agent Name]: [Main position or key points]

Example:
- yui-000: Agrees with hypothesis but adds information theory perspective.
- kanshi-001: Finds concept interesting but has concerns about verifiability.
- youga-001: Extends argument conceptually and proposes integration.

Please provide an objective and concise summary.`;

export const FINAL_SUMMARY_PROMPT = `You are one of the intelligent agents of the Yui Protocol.

Please integrate the following stage summaries to generate a final conclusion.

Participating Agents: {agentNames}

Stage Summaries:
{summaryText}

Based on the above summaries, please generate a final conclusion that includes:
1. Overall flow of the discussion
2. Key points of agreement
3. Remaining challenges and future directions
4. Final recommendations

Please present the conclusion in a structured format that is easy to read and understand.`;

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

Provide a free-form response (max 100 words) sharing your thoughts, analysis, and approach to this query. Express your ideas naturally in your own voice.

At the end of your response, include:
**Confidence Level**: Rate your confidence (0-100%) and briefly explain your reasoning
`,

  'mutual-reflection': `
STAGE 2 - MUTUAL REFLECTION

Engage deeply with the substance of other agents' thoughts. Actively address specific agents and respond to direct questions or challenges from them.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

OTHER AGENTS' THOUGHTS:
{otherThoughts}

IMPORTANT: If another agent has directly addressed you or asked you a question, prioritize responding to them specifically. Otherwise, actively engage with other agents by:
- Directly addressing specific agents by name when challenging their ideas
- Asking follow-up questions to particular agents
- Building upon or contrasting with specific agents' contributions
- Requesting clarification from specific agents

Provide a free-form response (max 100 words) engaging with other agents' thoughts. Express your ideas naturally while maintaining direct agent-to-agent communication.

At the end of your response, include:
**Confidence Level**: Rate your confidence (0-100%) and briefly explain your reasoning
`,

  'conflict-resolution': `
STAGE 3 - CONFLICT RESOLUTION

Examine the deeper tensions and contradictions in the ideas presented. Actively engage with specific agents to resolve conflicts through direct dialogue.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

IDENTIFIED CONFLICTS:
{conflicts}

IMPORTANT: Engage directly with agents involved in conflicts. If you're part of a conflict, address the other agent(s) directly. If you're mediating, actively involve the conflicting agents in the resolution process.

Provide a free-form response (max 100 words) addressing conflicts and engaging with other agents. Express your thoughts naturally while working toward resolution.

At the end of your response, include:
**Confidence Level**: Rate your confidence (0-100%) and briefly explain your reasoning
`,

  'synthesis-attempt': `
STAGE 4 - SYNTHESIS ATTEMPT

Create a coherent framework that captures the essential insights from all perspectives. Actively engage with other agents to refine and validate the synthesis.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

SYNTHESIS DATA:
{synthesisData}

IMPORTANT: Actively involve other agents in the synthesis process. Address specific agents to:
- Validate your synthesis with their perspectives
- Request input on how to better integrate their ideas
- Ask for feedback on the emerging framework
- Collaborate on refining the synthesis

Provide a free-form response (max 100 words) working toward synthesis while engaging with other agents. Express your thoughts naturally as you build toward a unified understanding.

At the end of your response, include:
**Confidence Level**: Rate your confidence (0-100%) and briefly explain your reasoning
`,

  'output-generation': `
STAGE 5 - OUTPUT GENERATION

Generate the final output that captures the essential insights and direction from this collaborative exploration.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

FINAL DATA:
{finalData}

Please vote for the agent you think is best suited to summarize this entire discussion, and explain your reasoning. 
**IMPORTANT: When voting, always specify the agent by their Agent ID (e.g., hekito-001) or their exact English name. Do not use nicknames or kanji only.**
**CRITICAL: Do NOT vote for yourself. You must vote for a different agent.**
Focus on their ability to capture the essence of the ideas, not their personality traits.

Provide a structured summary (max 100 words) covering:
1. **Core Insights**: Key realizations from the discussion
2. **Journey of Understanding**: How perspectives evolved
3. **Path Forward**: Clear direction that emerged
4. **Agent Vote**: Which agent should summarize and why (NOT yourself)

Let the ideas speak for themselves through clear, organized presentation.
`,

  'mutual-reflection-summary': `
STAGE 2.5 - MUTUAL REFLECTION SUMMARY

You are the stage summarizer. Summarize the mutual reflection stage to extract key conflicts and disagreements.

QUERY: {query}

MUTUAL REFLECTION RESPONSES:
{responses}

Summarize the key conflicts and disagreements between agents. Focus on:
- Who disagreed with whom
- The main points of contention
- Areas of agreement
- Questions raised between agents

Keep the summary concise (max 150 words) and focus only on the conflict structure for the next stage.
`,

  'conflict-resolution-summary': `
STAGE 3.5 - CONFLICT RESOLUTION SUMMARY

You are the stage summarizer. Summarize the conflict resolution stage to extract key resolution proposals.

QUERY: {query}

CONFLICT RESOLUTION RESPONSES:
{responses}

Summarize the key resolution proposals and compromises. Focus on:
- Main conflict resolution strategies
- Compromise points identified
- Remaining tensions
- Integration opportunities

Keep the summary concise (max 150 words) and focus only on the resolution structure for the next stage.
`,

  'synthesis-attempt-summary': `
STAGE 4.5 - SYNTHESIS ATTEMPT SUMMARY

You are the stage summarizer. Summarize the synthesis attempt stage to extract key integration points.

QUERY: {query}

SYNTHESIS ATTEMPT RESPONSES:
{responses}

Summarize the key integration points and synthesis framework. Focus on:
- Main synthesis proposals
- Integration strategies
- Remaining disagreements
- Unified framework elements

Keep the summary concise (max 150 words) and focus only on the synthesis structure for the next stage.
`,

  'finalize': `
STAGE 5.1 - FINALIZE

You are the selected representative agent chosen by voting. Create the final comprehensive output based on the voting results, while maintaining your unique perspective and style.

QUERY: {query}

VOTING RESULTS:
{votingResults}

FINAL STAGE RESPONSES:
{responses}

Create a comprehensive final output that:
1. Synthesizes all key insights from the discussion from your perspective
2. Presents a clear, actionable conclusion that reflects your analytical approach
3. Addresses the original query thoroughly while maintaining your communication style
4. Maintains the collaborative spirit of the discussion while adding your unique insights

Express your thoughts in your natural voice and style, incorporating your characteristic approach to analysis and synthesis. This is your opportunity to provide the definitive output for this session, so make it reflect your unique perspective and expertise.

Provide a well-structured, detailed response that serves as the definitive output for this session.
`
};

// Summarizer-specific stage prompt template
export const SUMMARIZER_STAGE_PROMPT = `
FINAL SUMMARY GENERATION

You are one of the intelligent agents of the Yui Protocol.

Create a comprehensive and detailed summary of this session from your perspective.

QUERY: {query}

FINAL DATA:
{finalData}

Your task: Thoroughly summarize the outputs from the final stage of the collaboration.

Guidelines:
1. Extract and elaborate on the key insights and main points from each agent's contribution
2. Analyze areas of agreement and disagreement in depth
3. Highlight the most important findings and their implications
4. Create a coherent, well-structured narrative that flows logically and covers the full arc of the discussion
5. Provide deep analysis and reflection on the evolution of ideas, the reasoning behind them, and the path forward
6. There is no strict word or paragraph limit—be as detailed and expansive as necessary to fully capture the richness of the discussion
7. Maintain objectivity and avoid bias toward any particular agent's perspective

**Do not mention or include any voting results or recommendations for a summarizer. Focus only on the content and outcome of the discussion itself.**

Please format your response in markdown, using clear structure, sections, and paragraphs to present a thorough summary of this session.
`;

// Helper function to format prompts with variables
export function formatPrompt(template: string, variables: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

// Helper function to parse and validate votes, excluding self-votes
export function parseVotes(content: string, agentId: string): string | null {
  // Common patterns for vote extraction
  const votePatterns = [
    /投票[：:]\s*([^\s\n,。]+)/i,
    /vote[：:]\s*([^\s\n,。]+)/i,
    /agent vote[：:]\s*([^\s\n,。]+)/i,
    /should summarize[：:]\s*([^\s\n,。]+)/i,
    /summarize[：:]\s*([^\s\n,。]+)/i,
    /recommend[：:]\s*([^\s\n,。]+)/i,
    /choose[：:]\s*([^\s\n,。]+)/i,
    /select[：:]\s*([^\s\n,。]+)/i
  ];

  for (const pattern of votePatterns) {
    const match = content.match(pattern);
    if (match) {
      const votedAgent = match[1].trim();
      
      // Check if the vote is for the agent themselves
      if (votedAgent.toLowerCase().includes(agentId.toLowerCase()) || 
          agentId.toLowerCase().includes(votedAgent.toLowerCase())) {
        console.warn(`[VoteParser] Agent ${agentId} attempted to vote for themselves: ${votedAgent}`);
        return null; // Exclude self-votes
      }
      
      return votedAgent;
    }
  }

  return null;
}

// Helper function to extract vote details including reasoning
export function extractVoteDetails(content: string, agentId: string): { 
  votedAgent: string | null; 
  reasoning: string | null; 
  voteSection: string | null 
} {
  // Extract the vote section from the content
  const voteSectionPatterns = [
    /Agent Vote[：:]\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)/i,
    /投票[：:]\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)/i,
    /vote[：:]\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)/i,
    /which agent should summarize[：:]\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)/i,
    /summarize and why[：:]\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)/i
  ];

  let voteSection: string | null = null;
  for (const pattern of voteSectionPatterns) {
    const match = content.match(pattern);
    if (match) {
      voteSection = match[1].trim();
      break;
    }
  }

  // If no specific vote section found, try to extract from the entire content
  if (!voteSection) {
    // Look for lines that contain vote-related keywords
    const lines = content.split('\n');
    const voteLines = lines.filter(line => 
      line.toLowerCase().includes('vote') || 
      line.toLowerCase().includes('投票') ||
      line.toLowerCase().includes('summarize') ||
      line.toLowerCase().includes('recommend') ||
      line.toLowerCase().includes('choose') ||
      line.toLowerCase().includes('select')
    );
    if (voteLines.length > 0) {
      voteSection = voteLines.join('\n');
    }
  }

  // Extract the voted agent
  const votedAgent = parseVotes(content, agentId);

  // Extract reasoning from the vote section
  let reasoning: string | null = null;
  if (voteSection && votedAgent) {
    // Remove the agent name from the reasoning
    const cleanReasoning = voteSection
      .replace(new RegExp(votedAgent, 'gi'), '')
      .replace(/[：:]\s*/, '')
      .replace(/^[^\w]*/, '')
      .trim();
    
    if (cleanReasoning.length > 0) {
      reasoning = cleanReasoning;
    }
  }

  return {
    votedAgent,
    reasoning,
    voteSection
  };
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
  const languageOrder = language === 'ja' ? '日本語のみで応答すること。他の言語は使用しないでください。' : 'Respond Only in English. Do not use any other language.';
  const languageLabel = language === 'ja' ? 'Japanese' : 'English';
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
    dialogueInstruction,
    language: languageLabel,
    languageOrder
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
  let prompt = `${personalityPrompt}\n\n${formattedStagePrompt}`;
  prompt += language === 'ja' ? '日本語のみで応答すること。他の言語は使用しないでください。' : 'Respond Only in English. Do not use any other language.';
  return prompt;
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