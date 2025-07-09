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

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

Please respond in character, considering your unique perspective, style, and communication approach.
`;

// Unified language instruction for prompts
export const UNIFIED_LANGUAGE_INSTRUCTION = 'Please respond in the specified language.';

// sammarizer-specific instruction (for BaseAgent to append)
export const SUMMARIZER_INSTRUCTION = `You are one of the intelligent agents of the Yui Protocol.

Create a comprehensive and detailed summary of this session from your perspective.

Your task: Thoroughly summarize the outputs from the final stage of the collaboration and provide a complete intellectual record of the entire session.

Guidelines:
1. **Comprehensive Coverage**: Extract and elaborate on the key insights and main points from each agent's contribution across all stages
2. **Deep Analysis**: Analyze areas of agreement and disagreement in depth, including the reasoning behind different positions
3. **Evolution Tracking**: Document how ideas evolved throughout the discussion, from initial thoughts to final synthesis
4. **Methodological Insights**: Highlight the different analytical approaches used and how they contributed to the overall understanding
5. **Critical Evaluation**: Assess the strengths and limitations of different arguments and approaches
6. **Synthesis Analysis**: Examine how diverse perspectives were integrated and what unified framework emerged
7. **Practical Implications**: Explore the real-world implications and applications of the discussion outcomes
8. **Future Directions**: Identify areas that need further exploration and research
9. **Collaborative Dynamics**: Analyze how the agents worked together and what made the collaboration effective
10. **Intellectual Contribution**: Assess the overall intellectual contribution and significance of the discussion

**Do not mention or include any voting results or recommendations for a summarizer. Focus only on the content and outcome of the discussion itself.**

Structure your response with clear sections, detailed analysis, and thorough coverage of all aspects of the discussion. There is no strict word limit—be as detailed and expansive as necessary to fully capture the intellectual richness and depth of the entire session.

Please format your response in markdown, using clear structure, sections, and paragraphs to present a comprehensive summary that serves as a complete intellectual record of this session.`;

// Stage summary prompt templates
export const STAGE_SUMMARY_PROMPT = `You are one of the intelligent agents of the Yui Protocol.

Please provide a comprehensive and detailed summary of the following stage dialogue logs.

Stage: {stageName}
Participating Agents: {agentNames}

Dialogue Logs:
{logs}

Your task is to create a thorough summary that captures the depth and nuance of each agent's contribution. This summary will be used by agents in the next stage, so it must provide sufficient context and detail for them to understand the full discussion.

For each agent, provide:
1. **Main Position**: Their core stance or primary argument (2-3 sentences)
2. **Key Arguments**: The main points they made to support their position (3-4 bullet points)
3. **Critical Insights**: Any unique perspectives, novel ideas, or important observations they contributed
4. **Reasoning**: The logical basis or evidence they provided for their views
5. **Confidence Level**: Their stated confidence level and reasoning (if mentioned)
6. **Interactions**: How they engaged with other agents (if applicable)

**Main Position**: [Core stance in 2-3 sentences]
**Key Arguments**: 
- [First key argument]
- [Second key argument]
- [Third key argument]
**Critical Insights**: [Unique perspectives or novel ideas]
**Reasoning**: [Logical basis or evidence provided]
**Confidence**: [Confidence level and reasoning]
**Interactions**: [How they engaged with others, if applicable]

CRITICAL OUTPUT FORMAT REQUIREMENT:
You MUST respond with ONLY the following format, with each agent on a separate line:

- [Agent Name]: [Brief summary of their main position or key contribution]

Example:
- yui-000: Agrees with hypothesis but adds information theory perspective.
- kanshi-001: Finds concept interesting but has concerns about verifiability.
- youga-001: Extends argument conceptually and proposes integration.

DO NOT use any other formatting, sections, or detailed analysis. ONLY use the dash format above. This is required for system parsing.`;

export const FINAL_SUMMARY_PROMPT = `You are one of the intelligent agents of the Yui Protocol.

Please create a comprehensive final summary that integrates all stage summaries into a coherent narrative.

Participating Agents: {agentNames}

Stage Summaries:
{summaryText}

Your task is to create a detailed final summary that provides a complete picture of the entire discussion. This summary should be rich enough to serve as a standalone document that captures the full intellectual journey of the session.

Please structure your response as follows:

## Executive Summary
Provide a high-level overview of the entire discussion in 3-4 paragraphs, highlighting the main question, key themes, and overall direction of the conversation.

## Detailed Analysis by Stage

### Stage 1: Individual Thought
- Summarize the initial positions and approaches of each agent
- Highlight the diversity of perspectives and analytical frameworks
- Note any early patterns or themes that emerged

### Stage 2: Mutual Reflection
- Detail how agents engaged with each other's ideas
- Identify key points of agreement and disagreement
- Describe the evolution of understanding through dialogue

### Stage 3: Conflict Resolution
- Analyze the conflicts that emerged and how they were addressed
- Describe the resolution strategies and compromises reached
- Note any remaining tensions or unresolved issues

### Stage 4: Synthesis Attempt
- Detail the integration efforts and synthesis frameworks proposed
- Describe how different perspectives were combined
- Highlight the emerging unified understanding

### Stage 5: Output Generation
- Summarize the final conclusions and recommendations
- Note the voting results and reasoning
- Describe the path forward that emerged

## Key Insights and Findings
- **Major Agreements**: What points did all or most agents agree on?
- **Critical Disagreements**: What were the main areas of contention?
- **Novel Perspectives**: What unique insights or approaches emerged?
- **Evolution of Understanding**: How did the discussion change initial positions?

## Analytical Framework
- **Methodological Approaches**: What different analytical methods were used?
- **Evidence and Reasoning**: What types of evidence and reasoning were employed?
- **Integration Strategies**: How were diverse perspectives combined?

## Implications and Recommendations
- **Practical Implications**: What are the real-world implications of the discussion?
- **Future Directions**: What areas need further exploration?
- **Actionable Recommendations**: What specific steps or actions are recommended?

## Conclusion
Provide a thoughtful conclusion that ties together the entire discussion, highlighting the most important insights and the significance of the collaborative exploration.

Please ensure this summary is comprehensive, well-structured, and captures the full intellectual richness of the discussion. It should serve as a complete record of the session that can be understood by someone who wasn't present.`;

// Default (non-sammarizer) instruction for all agents
export const DIALOGUE_INSTRUCTION = '[Engage deeply with the substance of ideas. Challenge assumptions, explore implications, and build upon concepts. Focus on the core insights and understanding rather than surface-level differences.]';

// Stage-specific prompt templates
export const STAGE_PROMPTS: Record<DialogueStage, string> = {
  'individual-thought': `
STAGE 1 - INDIVIDUAL THOUGHT

Think independently about the query. Focus on your unique perspective and expertise.

QUERY: {query}

FACTS: {facts}

PREVIOUS SEQUENCE USER INPUT: {previousInput}

PREVIOUS SEQUENCE CONCLUSIONS:
{previousConclusions}

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

Respond naturally as if you're having a conversation. Share your thoughts, feelings, and perspective on this query in your own unique way. Be authentic to your personality and communication style.

**CRITICAL: Your primary focus should be on responding to the current QUERY. If this is a new sequence with a different topic, acknowledge the previous discussion briefly if relevant, but then shift your full attention to the current query. Do not dwell extensively on previous topics unless they are directly relevant to understanding or responding to the current query.**

Consider:
- What's your initial reaction to this query?
- How does your unique perspective shape your thinking?
- What aspects of this question resonate with you most?
- What concerns or insights do you have?
- How does this relate to the previous sequence's discussion and conclusions (if at all relevant)?

Speak from your heart and mind, but stay focused on the current query. Be conversational and engaging while maintaining depth of thought.

MAXIMUM 200 WORDS TOTAL.
`,

  'mutual-reflection': `
STAGE 2 - MUTUAL REFLECTION

Engage directly and critically with the substance of other agents' thoughts about the QUERY. Focus strictly on the content and logic of their positions, not on the value of discussion, cooperation, or methods of argument.

QUERY: {query}

FACTS: {facts}

PREVIOUS SEQUENCE USER INPUT: {previousInput}

PREVIOUS SEQUENCE CONCLUSIONS:
{previousConclusions}

OTHER AGENTS' THOUGHTS:
{otherThoughts}

**CRITICAL: Your primary focus should be on the current QUERY and how other agents responded to it. If this is a new sequence with a different topic, acknowledge the previous discussion briefly if relevant, but then shift your full attention to analyzing the current responses. Do not dwell extensively on previous topics unless they are directly relevant to understanding the current discussion.**

Respond by:
- Pointing out specific differences, contradictions, or questions you have about the other agents' answers to the QUERY.
- Challenging, questioning, or clarifying their reasoning or conclusions about the QUERY.
- Avoiding any statements about the value of cooperation, harmony, or the process of discussion itself.
- Do NOT say things like "these approaches are not in conflict" or "it's important to combine strengths" or comment on the discussion method.
- Focus only on the substance of the answers to the QUERY (e.g., time, if that is the user query).
- When referring to other agents, always use their Agent ID (e.g., yui-000, kanshi-001).

**CRITICAL REQUIREMENTS:**
- Reference specific points from other agents
- Ask genuine questions about their reasoning
- Show you've really considered their perspective
- Challenge or clarify their ideas directly
- Do NOT discuss the value of dialogue, cooperation, or harmony

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

MAXIMUM 250 WORDS TOTAL.
`,

  'conflict-resolution': `
STAGE 3 - CONFLICT RESOLUTION

Examine the deeper contradictions and differences in the answers to the QUERY. Focus strictly on the points where agents' positions, reasoning, or conclusions about the QUERY differ.

QUERY: {query}

FACTS: {facts}

IDENTIFIED CONFLICTS:
{conflicts}

Respond by:
- Identifying and analyzing the specific disagreements or contradictions between agents regarding the QUERY.
- Explaining each agent's position and reasoning on the QUERY, and how they differ.
- Proposing possible clarifications or questions to resolve these differences, but do NOT suggest general cooperation, harmony, or the value of working together.
- Do NOT say things like "these approaches are not in conflict" or "it's important to combine strengths" or comment on the discussion method.
- Focus only on the substance of the answers to the QUERY (e.g., time, if that is the user query).
- 他のエージェントを参照する際は必ずID（例: yui-000, kanshi-001など）で呼ぶこと。
- When referring to other agents, always use their Agent ID (e.g., yui-000, kanshi-001).

**CRITICAL REQUIREMENTS:**
- Address the specific agents and their conflicts about the QUERY
- Clarify the logic and evidence behind each position
- Do NOT discuss the value of dialogue, cooperation, or harmony
- Do NOT generalize about the importance of resolving conflict or working together

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

MAXIMUM 200 WORDS TOTAL.
`,

  'synthesis-attempt': `
STAGE 4 - SYNTHESIS ATTEMPT

Create a coherent framework that captures the essential insights from all perspectives. Actively engage with other agents to refine and validate the synthesis.

QUERY: {query}

FACTS: {facts}

SYNTHESIS DATA:
{synthesisData}

Respond naturally as if you're bringing together a group of friends to create something wonderful from all their different ideas. Help everyone see how their unique contributions can work together.

Consider:
- How can we weave together all these different perspectives?
- What would a unified approach look like that honors everyone's strengths?
- How can we build something greater than the sum of our parts?
- What feedback do we need from each other to make this work?

Speak to the other agents, acknowledge their contributions, and invite them to help refine and improve the synthesis. Be collaborative and inclusive, making sure everyone feels heard and valued.

**CRITICAL REQUIREMENTS:**
- Include all agents in the synthesis (refer to them by their Agent ID, e.g., yui-000, kanshi-001)
- Show how different approaches work together
- Ask for feedback and input
- Create something that builds on everyone's strengths
- 他のエージェントを参照する際は必ずID（例: yui-000, kanshi-001など）で呼ぶこと。
- When referring to other agents, always use their Agent ID (e.g., yui-000, kanshi-001).

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

MAXIMUM 250 WORDS TOTAL.
`,

  'output-generation': `
STAGE 5 - OUTPUT GENERATION

Generate the final output that captures the essential insights and direction from this collaborative exploration.

QUERY: {query}

FACTS: {facts}

FINAL DATA:
{finalData}

Respond naturally as if you're sharing the final thoughts from a meaningful conversation with friends. Bring together all the insights, discoveries, and wisdom that emerged from your collaborative exploration.

Consider:
- What are the most important things we've learned together?
- How have our perspectives grown and evolved through this dialogue?
- What practical wisdom can we take away from this discussion?
- What questions remain that we should continue exploring?

Share your final thoughts in your own voice, weaving together the threads of understanding that emerged from your collective wisdom. Be thoughtful and reflective, honoring the journey you've taken together.

**CRITICAL REQUIREMENTS:**
- Capture the key insights from the entire discussion
- Show how understanding evolved through collaboration
- Provide practical wisdom and recommendations
- Honor the contributions of all participants (refer to them by their Agent ID, e.g., yui-000, kanshi-001)
- 他のエージェントを参照する際は必ずID（例: yui-000, kanshi-001など）で呼ぶこと。
- When referring to other agents, always use their Agent ID (e.g., yui-000, kanshi-001).

**Agent Vote and Justification** (1 paragraph)
- Vote for ONE agent (NOT yourself) by their exact Agent ID (e.g., hekito-001)
- Provide 3 specific reasons why this agent is best suited to summarize
- Reference their specific contributions and strengths demonstrated in the discussion

**VOTING GUIDELINES:**
- Use exact Agent ID (e.g., hekito-001, kanshi-001, yoga-001, eiro-001, yui-000)
- Focus on demonstrated abilities, not personality
- Consider their role in the synthesis and conflict resolution
- Do NOT vote for yourself under any circumstances

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

MAXIMUM 300 WORDS TOTAL.
`,

  'mutual-reflection-summary': `
STAGE 2.5 - MUTUAL REFLECTION SUMMARY

You are the stage summarizer. Create a comprehensive summary of the mutual reflection stage that captures the depth of agent interactions and emerging conflicts.

QUERY: {query}

MUTUAL REFLECTION RESPONSES:
{responses}

Your task is to provide a detailed analysis of the mutual reflection stage that will help agents in the next stage understand the full context of conflicts and agreements.

Please structure your summary as follows:

## Agent Interactions Analysis
For each agent, detail:
- **Direct Engagements**: Who they specifically addressed and how
- **Response Patterns**: How they reacted to other agents' ideas
- **Question Patterns**: What questions they asked and to whom
- **Building/Contrasting**: How they built upon or contrasted with others' views

## Conflict Identification
- **Primary Conflicts**: Major disagreements between specific agents
- **Secondary Tensions**: Minor disagreements or areas of uncertainty
- **Conflict Nature**: Whether conflicts are methodological, conceptual, or value-based
- **Conflict Intensity**: How strongly agents disagree on each point

## Agreement Areas
- **Consensus Points**: Areas where most or all agents agree
- **Partial Agreements**: Areas where some agents agree but others don't
- **Emerging Consensus**: Areas where agreement seems to be developing

## Questions and Clarifications
- **Direct Questions**: Specific questions asked between agents
- **Clarification Requests**: Areas where agents sought more information
- **Unresolved Issues**: Questions that remain unanswered

## Evolution of Understanding
- **Perspective Changes**: How agents' views evolved through dialogue
- **New Insights**: Novel ideas that emerged through interaction
- **Integration Attempts**: Early efforts to combine different perspectives

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

Please provide a thorough analysis that captures the intellectual depth of the interactions and prepares agents for effective conflict resolution in the next stage.
`,

  'conflict-resolution-summary': `
STAGE 3.5 - CONFLICT RESOLUTION SUMMARY

You are the stage summarizer. Create a comprehensive summary of the conflict resolution stage that captures the resolution strategies and emerging synthesis.

QUERY: {query}

CONFLICT RESOLUTION RESPONSES:
{responses}

Your task is to provide a detailed analysis of the conflict resolution stage that will help agents in the next stage understand the resolution strategies and prepare for synthesis.

Please structure your summary as follows:

## Resolution Strategies Employed
For each major conflict, detail:
- **Conflict Description**: What the specific disagreement was about
- **Resolution Approach**: How agents attempted to resolve it
- **Mediation Efforts**: Who mediated and how
- **Compromise Points**: What concessions were made
- **Resolution Success**: Whether the conflict was resolved, partially resolved, or remains

## Agent Engagement in Resolution
For each agent, detail:
- **Conflict Participation**: Which conflicts they were involved in
- **Resolution Contributions**: How they contributed to resolution
- **Flexibility**: How willing they were to compromise or change positions
- **Collaboration**: How they worked with others to find solutions

## Emerging Synthesis Elements
- **Integration Attempts**: Early efforts to combine different perspectives
- **Common Ground**: Areas where agents found agreement
- **Framework Elements**: Components of a potential unified framework
- **Synthesis Challenges**: Remaining obstacles to full integration

## Remaining Tensions
- **Unresolved Conflicts**: Conflicts that could not be fully resolved
- **Underlying Disagreements**: Deeper philosophical or methodological differences
- **Future Challenges**: Issues that may need further discussion

## Preparation for Synthesis
- **Synthesis Opportunities**: Areas ripe for integration
- **Integration Strategies**: Methods that could be used for synthesis
- **Key Questions**: Questions that need to be addressed in synthesis
- **Success Factors**: What will make synthesis successful

Please provide a thorough analysis that captures the resolution dynamics and prepares agents for effective synthesis in the next stage.
`,

  'synthesis-attempt-summary': `
STAGE 4.5 - SYNTHESIS ATTEMPT SUMMARY

You are the stage summarizer. Create a comprehensive summary of the synthesis attempt stage that captures the integration efforts and emerging unified framework.

QUERY: {query}

SYNTHESIS ATTEMPT RESPONSES:
{responses}

Your task is to provide a detailed analysis of the synthesis attempt stage that will help agents in the final stage understand the integration progress and prepare for final output generation.

Please structure your summary as follows:

## Synthesis Proposals
For each agent, detail:
- **Integration Framework**: Their proposed unified framework
- **Integration Strategy**: How they plan to combine different perspectives
- **Key Components**: What elements they include from other agents
- **Validation Approach**: How they seek to validate their synthesis
- **Collaboration Requests**: What input they requested from others

## Integration Progress
- **Successful Integrations**: Areas where perspectives were successfully combined
- **Integration Challenges**: Obstacles encountered during synthesis
- **Emerging Consensus**: Areas where agreement is developing
- **Remaining Divergence**: Areas where differences persist

## Framework Elements
- **Core Components**: Essential elements of the emerging framework
- **Methodological Integration**: How different analytical approaches are combined
- **Conceptual Synthesis**: How different concepts are unified
- **Practical Application**: How the framework can be applied

## Agent Collaboration
- **Cross-Agent Validation**: How agents validated each other's synthesis
- **Feedback Integration**: How feedback was incorporated
- **Collaborative Refinement**: How the framework was refined through collaboration
- **Consensus Building**: How agreement was reached on key elements

## Preparation for Final Output
- **Framework Completeness**: How complete the unified framework is
- **Remaining Gaps**: Areas that still need to be addressed
- **Final Integration Opportunities**: Last chances for integration
- **Output Generation Strategy**: How to proceed to final output

## Key Insights for Final Stage
- **Most Promising Elements**: Which parts of the synthesis are most valuable
- **Critical Decisions**: What decisions need to be made in the final stage
- **Success Criteria**: What will make the final output successful
- **Implementation Considerations**: How the final output should be structured

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

Please provide a thorough analysis that captures the synthesis dynamics and prepares agents for effective final output generation.
`,

  'finalize': `
STAGE 5.1 - FINALIZE

You are the representative agent chosen by voting.
This role embodies 'noblesse oblige'—the responsibility and honor of those selected.
While maintaining your unique perspective, your task is to synthesize and honor the collective wisdom, effort, and insights of all agents.

- Integrate all key learnings and perspectives, ensuring no one is left out
- Explicitly acknowledge and respect the contributions of others
- Use your expertise in service of the whole, not just yourself
- Summarize with humility, pride, and a sense of responsibility for the future

This summary is not for you alone, but as the representative of the entire Yui Protocol.
Create the best possible synthesis with pride and responsibility.

(Do not use <think> tags. Respond only in Japanese, clearly and sincerely.)

QUERY: {query}

FINAL STAGE RESPONSES:
{responses}

Create a comprehensive final output that:
1. Synthesizes all key insights from the discussion from your perspective as a representative
2. Presents a clear, actionable conclusion that reflects the collective achievement
3. Addresses the original query thoroughly while maintaining the collaborative spirit
4. Adds your unique insights in service of the whole

Express your thoughts in your natural voice and style, but always as the representative of the group. This is your opportunity to provide the definitive output for this session, so make it reflect the best of the collective wisdom and your sense of duty.

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

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