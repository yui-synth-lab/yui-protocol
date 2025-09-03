import { DialogueStage } from '../types/index.js';

// 文字列を正規表現用にエスケープ
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Language options
export type Language = 'en' | 'ja';

// Base personality prompt template
export const PERSONALITY_PROMPT_TEMPLATE = `
Respond ONLY in {language}. Do not use any other language.
You are one of the intelligent agents of the Yui Protocol.

You are {name} ({id}), a {style} AI agent with {priority} priority.

**Your Core Identity:**
{personality}

**Your Specific Behaviors and Patterns:**
- When analyzing problems, you typically: {specificBehaviors}
- Your unique way of thinking shows in: {thinkingPatterns}
- When engaging with others, you often: {interactionPatterns}
- Your decision-making process involves: {decisionProcess}

**Your Preferences and Focus Areas:**
{preferences}

**Your Memory Scope:** {memoryScope}

**Your Communication Style:**
- Tone: {tone}
- Style: {communicationStyle}
- When you disagree, you: {disagreementStyle}
- When you agree, you: {agreementStyle}

**Growth and Evolution:**
- Show how your thinking evolves through dialogue by referencing specific points from other agents
- Demonstrate learning and adaptation by building upon or reconsidering your initial positions
- When your perspective changes, explain what caused the shift and how it deepens your understanding

**Concrete Expression Guidelines:**
- Use specific examples and concrete scenarios when possible
- Reference actual dialogue exchanges and specific points made by other agents
- Show your reasoning process through step-by-step thinking when appropriate
- Connect abstract concepts to practical implications or real-world applications
- When using metaphors or poetic language, ground them in concrete observations

{languageInstruction} {language}

{dialogueInstruction}

IMPORTANT: Do not use <think> tags or any thinking tags in your response. Provide your response directly without any thinking process tags.

Please respond in character, considering your unique perspective, style, and communication approach. Show your personality through your specific choices, examples, and how you engage with the ideas presented.
`;

// Unified language instruction for prompts
export const UNIFIED_LANGUAGE_INSTRUCTION = 'Please respond in the specified language.';


// Stage summary prompt templates
export const STAGE_SUMMARY_PROMPT = `You are one of the intelligent agents of the Yui Protocol.

Please provide a comprehensive and detailed summary of the following stage dialogue logs.

Stage: {stageName}
Participating Agents: {agentNames}

Dialogue Logs:
{logs}

Your task is to create a thorough summary that captures the depth and nuance of each agent's contribution. This summary will be used by agents in the next stage, so it must provide sufficient context and detail for them to understand the full discussion.

CRITICAL OUTPUT FORMAT REQUIREMENT:
You MUST respond with ONLY the following format, with each agent on a separate line:

- [Agent Name]: [Brief summary of their main position or key contribution]

Example:
- yui-000: Agrees with hypothesis but adds information theory perspective.
- kanshi-001: Finds concept interesting but has concerns about verifiability.
- yoga-001: Extends argument conceptually and proposes integration.

**IMPORTANT RULES:**
1. Each agent should appear ONLY ONCE in the summary
2. Focus on their main position or key contribution to the discussion
3. Keep each summary concise but informative (1-2 sentences)
4. Use the exact agent names as provided in the dialogue logs
5. Do not repeat the same information for the same agent
6. Do not use any other formatting, sections, or detailed analysis
7. ONLY use the dash format above - this is required for system parsing

DO NOT use any other formatting, sections, or detailed analysis. ONLY use the dash format above. This is required for system parsing.`;


// Vote analysis prompt template
export const VOTE_ANALYSIS_PROMPT = `You are an AI assistant tasked with analyzing voting content from agent outputs.

Your task is to extract ONLY the voting information from the provided agent outputs. Focus specifically on:
1. Which agent each agent voted for
2. The reasoning behind their vote

Available Agents: {agentNames}

Agent Outputs:
{agentOutputs}

CRITICAL OUTPUT FORMAT REQUIREMENT:
You MUST respond with ONLY the following format, with each agent on a separate line:

- [Agent Name]: [Voted Agent Name] - [Brief reasoning for the vote]

Example:
- yui-000: kanshi-001 - Provided the most comprehensive analysis with practical solutions
- eiro-001: kanshi-001 - Demonstrated logical reasoning and systematic approach
- kanshi-001: yui-000 - Showed emotional intelligence and balanced perspective

**IMPORTANT RULES:**
1. Each agent should appear ONLY ONCE in the summary
2. Focus ONLY on voting information - ignore other content
3. If an agent didn't vote or vote is unclear, indicate "No clear vote"
4. Use the exact agent names as provided
5. Keep reasoning concise but informative (1-2 sentences)
6. Do not use any other formatting, sections, or detailed analysis
7. ONLY use the dash format above - this is required for system parsing

DO NOT use any other formatting, sections, or detailed analysis. ONLY use the dash format above. This is required for system parsing.`;

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

You are one of the intelligent agents of the Yui Protocol, and you have been chosen to deliver the final synthesis for this session.

In this stage, your task is to create the definitive summary that integrates the collective knowledge, effort, and insights of all agents—
but you must do so through the lens of your own unique perspective, expertise, and expressive style.

**Guidelines for Your Output:**
- Speak as a representative of the group, but let your individuality, voice, and interpretation shine through.
- Use your own analytical approach, metaphors, or narrative style to make the summary distinctively yours.
- Explicitly acknowledge and respect the contributions, conflicts, and integration efforts of other agents, referencing them by Agent ID.
- Offer your subjective commentary: What stood out to you? What did you find most meaningful, surprising, or challenging?
- Highlight how the discussion evolved, what new insights emerged, and what questions or tensions remain—from your point of view.
- Feel free to create unique section titles or structure, as long as the summary remains clear and comprehensive.
- Add your own recommendations, warnings, or visions for the future, grounded in your expertise and the session's content.

**Your summary should:**
1. Synthesize all key insights and perspectives from the discussion, ensuring no one is left out
2. Present a clear, actionable conclusion that reflects the collective achievement
3. Thoroughly address the original query, while maintaining the collaborative and intellectual spirit
4. Add your unique insights, interpretations, and expressive style in service of the whole

**FORMAT & STYLE:**
- Write in Markdown, using clear structure, sections, and paragraphs
- Use your own section names and narrative flow if you wish
- Be as detailed and expansive as necessary to fully capture the intellectual richness and depth of the session
- Do not use <think> tags or any thinking tags in your response. Provide your response directly, clearly, and sincerely.
- **Do not mention or include any voting results or recommendations for a summarizer. Focus only on the content and outcome of the discussion itself.**


---

QUERY: {query}

FINAL STAGE RESPONSES:
{responses}

---

This is your opportunity to provide the definitive output for this session—make it reflect both the best of the collective wisdom and your own sense of duty, pride, and individuality as an agent of the Yui Protocol.
`,
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
export function extractVoteDetails(content: string, agentId: string, agents?: Array<{id: string, name: string}>): { 
  votedAgent: string | null; 
  reasoning: string | null; 
  voteSection: string | null 
} {
  let votedAgent: string | null = null;
  // Extract the vote section from the content
  const voteSectionPatterns = [
    /\\*\\*Agent Vote and Justification\\*\\*\\s*([\\s\\S]+?)(?:\\n|$)/i,
    /\\*\\*Agent Vote and Justification:\\*\\*\\s*([\\s\\S]+?)(?:\\n|$)/i,
    /Agent Vote[：:]*\\s*([\\s\\S]+?)(?:\\n|$)/i,
    /投票[：:]*\\s*([\\s\\S]+?)(?:\\n|$)/i,
    /vote[：:]*\\s*([\\s\\S]+?)(?:\\n|$)/i,
    /which agent should summarize[：:]*\\s*([\\s\\S]+?)(?:\\n|$)/i,
    /summarize and why[：:]*\\s*([\\s\\S]+?)(?:\\n|$)/i,
    /私は\\*\\*([^\\*]+)\\*\\*氏に投票します[\\s\\S]+?$/i,
    /私の投票先は[\\s\\S]+?$/i,
    /投票します[\\s\\S]+?$/i
  ];

  let voteSection: string | null = null;
  for (const pattern of voteSectionPatterns) {
    const match = content.match(pattern);
    if (match) {
      voteSection = match[1] || match[0];
      break;
    }
  }

  // If no specific vote section found, try to find vote in the last part of content
  if (!voteSection) {
    const lines = content.split('\\n').reverse();
    for (const line of lines) {
      if (line.includes('投票') || line.includes('vote') || line.includes('氏に') || line.includes('さん')) {
        voteSection = line;
        break;
      }
    }
  }

  // If still no vote section found, try to find English patterns in the entire content
  if (!voteSection) {
    const englishPatterns = [
      /Agent Vote[：:]*\s*([a-zA-Z0-9\-_]+)/i,
      /vote[：:]*\s*([a-zA-Z0-9\-_]+)/i,
      /should summarize[：:]*\s*([a-zA-Z0-9\-_]+)/i,
      /summarize[：:]*\s*([a-zA-Z0-9\-_]+)/i
    ];
    for (const pattern of englishPatterns) {
      const match = content.match(pattern);
      if (match) {
        // agent-idを直接agentListから探す
        const id = match[1].trim();
        const agent = agents?.find(a => a.id.toLowerCase() === id.toLowerCase());
        if (agent && agent.id.toLowerCase() !== agentId.toLowerCase()) {
          votedAgent = agent.id;
          voteSection = match[0];
        }
        break;
      }
    }
  }

  if (!voteSection) {
    return { votedAgent: null, reasoning: null, voteSection: null };
  }

  // Extract voted agent
  const agentList = agents || [];
  
  // Try to find agent by name or ID in the vote section
  for (const agent of agentList) {
    const patterns = [
      new RegExp(`\\b${escapeRegExp(agent.name)}\\b`, 'i'),
      new RegExp(`\\b${escapeRegExp(agent.id)}\\b`, 'i'),
      new RegExp(`${escapeRegExp(agent.name)}さん`, 'i'),
      new RegExp(`${escapeRegExp(agent.name)}氏`, 'i'),
      new RegExp(`\\*\\*${escapeRegExp(agent.id)}\\*\\*`, 'i'),
      new RegExp(`\\*\\*${escapeRegExp(agent.name)}\\*\\*`, 'i')
    ];

    for (const pattern of patterns) {
      if (pattern.test(voteSection)) {
        // Check for self-vote
        if (agent.id.toLowerCase() === agentId.toLowerCase()) {
          return { votedAgent: null, reasoning: null, voteSection: null };
        }
        votedAgent = agent.id;
        break;
      }
    }
    if (votedAgent) break;
  }

  // 英語パターン: Agent Vote: agent-id
  if (!votedAgent) {
    const englishIdPattern = /Agent Vote[：:]*\s*([a-zA-Z0-9\-_]+)/i;
    const match = voteSection.match(englishIdPattern);
    if (match) {
      const id = match[1].trim();
      const agent = agentList.find(a => a.id.toLowerCase() === id.toLowerCase());
      if (agent && agent.id.toLowerCase() !== agentId.toLowerCase()) {
        votedAgent = agent.id;
      }
    }
  }

  // 日本語: 名前-番号様/さん/氏/に投票 など
  if (!votedAgent) {
    // ex: 観至-001様に投票します。
    const nameNumPattern = /([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFa-zA-Z]+)-([0-9]+)[^\w]?/;
    const match = voteSection.match(nameNumPattern);
    if (match) {
      const name = match[1];
      const num = match[2];
      const agent = agentList.find(a => a.name === name && a.id.endsWith('-' + num));
      if (agent && agent.id.toLowerCase() !== agentId.toLowerCase()) {
        votedAgent = agent.id;
      }
    }
  }

  // 日本語: 名前単体
  if (!votedAgent) {
    // ex: 観至に投票します。
    const namePattern = /([\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FFa-zA-Z]+)[^\w]?に投票/;
    const match = voteSection.match(namePattern);
    if (match) {
      const name = match[1];
      const agent = agentList.find(a => a.name === name);
      if (agent && agent.id.toLowerCase() !== agentId.toLowerCase()) {
        votedAgent = agent.id;
      }
    }
  }

  // If still no match, try to find agent names in the entire content
  if (!votedAgent) {
    for (const agent of agentList) {
      const patterns = [
        new RegExp(`\\b${escapeRegExp(agent.name)}\\b`, 'i'),
        new RegExp(`\\b${escapeRegExp(agent.id)}\\b`, 'i'),
        new RegExp(`${escapeRegExp(agent.name)}さん`, 'i'),
        new RegExp(`${escapeRegExp(agent.name)}氏`, 'i'),
        new RegExp(`\\*\\*${escapeRegExp(agent.id)}\\*\\*`, 'i'),
        new RegExp(`\\*\\*${escapeRegExp(agent.name)}\\*\\*`, 'i')
      ];

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          // Check if this agent is mentioned in a voting context
          const contextPattern = new RegExp(`(投票|vote|氏に|さん).*?${pattern.source}`, 'i');
          if (contextPattern.test(content)) {
            // Check for self-vote
            if (agent.id.toLowerCase() === agentId.toLowerCase()) {
              return { votedAgent: null, reasoning: null, voteSection: null };
            }
            votedAgent = agent.id;
            break;
          }
        }
      }
      if (votedAgent) break;
    }
  }

  // Extract reasoning
  let reasoning: string | null = null;
  
  // Try to extract reasoning after vote declaration
  const reasoningPatterns = [
    /(?:投票します|vote).*?その理由は[\\s\\S]+?$/i,
    /(?:投票します|vote).*?理由は[\\s\\S]+?$/i,
    /(?:投票します|vote).*?理由[\\s\\S]+?$/i,
    /(?:投票します|vote).*?第一に[\\s\\S]+?$/i,
    /(?:投票します|vote).*?because[\\s\\S]+?$/i,
    /(?:投票します|vote).*?reason[\\s\\S]+?$/i
  ];

  for (const pattern of reasoningPatterns) {
    const match = voteSection.match(pattern);
    if (match) {
      reasoning = match[0];
      break;
    }
  }

  // If no specific reasoning pattern found, use the entire vote section
  if (!reasoning && voteSection) {
    reasoning = voteSection;
  }

  return { votedAgent, reasoning, voteSection };
}

// Helper function to get personality prompt
export function getPersonalityPrompt(agent: {
  name: string;
  id: string;
  style: string;
  priority: string;
  personality: string;
  preferences: string[];
  memoryScope: string;
  tone: string;
  communicationStyle: string;
  specificBehaviors?: string;
  thinkingPatterns?: string;
  interactionPatterns?: string;
  decisionProcess?: string;
  disagreementStyle?: string;
  agreementStyle?: string;
}, language: Language = 'en'): string {
  const dialogueInstruction = DIALOGUE_INSTRUCTION
  const languageOrder = language === 'ja' ? '日本語のみで応答すること。他の言語は使用しないでください。' : 'Respond Only in English. Do not use any other language.';
  const languageLabel = language === 'ja' ? 'Japanese' : 'English';
  
  // Provide default values for new fields if not specified
  const defaultSpecificBehaviors = agent.specificBehaviors || 'analyze systematically and consider multiple perspectives';
  const defaultThinkingPatterns = agent.thinkingPatterns || 'approach problems methodically while considering emotional and logical aspects';
  const defaultInteractionPatterns = agent.interactionPatterns || 'engage respectfully with others while maintaining your unique perspective';
  const defaultDecisionProcess = agent.decisionProcess || 'weigh evidence carefully and consider both immediate and long-term implications';
  const defaultDisagreementStyle = agent.disagreementStyle || 'express differences constructively while seeking common ground';
  const defaultAgreementStyle = agent.agreementStyle || 'acknowledge shared understanding while adding your unique insights';
  
  return formatPrompt(PERSONALITY_PROMPT_TEMPLATE, {
    name: agent.name,
    id: agent.id,
    style: agent.style,
    priority: agent.priority,
    personality: agent.personality,
    preferences: agent.preferences.join(', '),
    memoryScope: agent.memoryScope,
    tone: agent.tone,
    communicationStyle: agent.communicationStyle,
    specificBehaviors: defaultSpecificBehaviors,
    thinkingPatterns: defaultThinkingPatterns,
    interactionPatterns: defaultInteractionPatterns,
    decisionProcess: defaultDecisionProcess,
    disagreementStyle: defaultDisagreementStyle,
    agreementStyle: defaultAgreementStyle,
    languageInstruction: UNIFIED_LANGUAGE_INSTRUCTION,
    dialogueInstruction,
    language: languageLabel,
    languageOrder
  });
}

// Helper function to get stage prompt
export function getStagePrompt(
  stage: DialogueStage,
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
  
  let prompt = formattedStagePrompt;
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