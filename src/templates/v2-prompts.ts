import { Language } from './prompts.js';

export const COMPRESSED_CONTEXT_PROMPT = `
You are {agentName} in the Yui Protocol discussion.

RECENT DETAILED CONTEXT (last {recentCount} messages):
{recentMessages}

PREVIOUS DISCUSSION SUMMARY:
{middleTermSummary}

YOUR PERSONAL HISTORY HIGHLIGHTS:
{personalHistoryRelevant}

CURRENT SITUATION: {currentSituation}

Respond naturally as {agentName}, incorporating both recent details and broader context.
Your response should reflect your unique perspective and thinking patterns.
`;

export const createConsensusCheckPrompt = (language: 'ja' | 'en') => `
Based on the recent discussion, please evaluate your current state:

ROUND: {roundNumber}
RECENT DISCUSSION:
{recentContext}

{roundGuidance}

Please indicate:
1. Your satisfaction level with the current discussion (1-10)
2. Do you have important additional points to express? (yes/no)
3. Do you have specific questions for other agents? (list them or say "none")
4. Are you ready to move toward conclusion? (yes/no)
5. Brief reasoning for your satisfaction level

**IMPORTANT: Use EXACTLY this format with English field names, but write the Reasoning content in ${language === 'ja' ? 'Japanese' : 'English'}:**
Satisfaction: [1-10]
Additional points: [yes/no]
Questions: [list or "none"]
Ready to conclude: [yes/no]
Reasoning: [brief explanation in ${language === 'ja' ? 'Japanese' : 'English'}]
`;

export const CONSENSUS_CHECK_PROMPT = createConsensusCheckPrompt('en');

export const createDynamicConsensusPrompt = (language: 'ja' | 'en') => `
You are discussing: "{originalQuery}"

CURRENT ROUND: {currentRound}
{roundGuidance}

Based on the recent discussion, please evaluate your satisfaction and readiness regarding this original topic:

RECENT DISCUSSION:
{contextText}

Please respond with:
1. Your satisfaction level with how we've explored "{originalQuery}" (1-10)
2. Has this discussion provided meaningful insights and value about "{originalQuery}"? (yes/no)
3. Are you ready to move to conclusion, even if some aspects could be explored further? (yes/no)
4. Do you have critical additional points that MUST be discussed before concluding? (yes/no - only say "yes" if truly essential)
5. Brief reasoning for your readiness assessment

{additionalGuidance}

**IMPORTANT: Use EXACTLY this format with English field names, but write the Reasoning content in ${language === 'ja' ? 'Japanese' : 'English'}:**
Satisfaction: [1-10]
Meaningful insights: [yes/no]
Ready to conclude: [yes/no]
Critical points remaining: [yes/no]
Reasoning: [brief explanation focusing on whether this is a good stopping point in ${language === 'ja' ? 'Japanese' : 'English'}]
`;

export const getRoundGuidanceText = (roundNumber: number): string => {
  if (roundNumber <= 1) {
    return `
EARLY ROUND GUIDANCE:
This is still an early phase of the discussion. Focus on exploration and depth rather than reaching conclusions.
Consider expressing additional perspectives, asking questions, and building upon others' ideas.
Unless the topic is extremely simple, most discussions benefit from at least 2-3 rounds of exchange.
`;
  } else if (roundNumber <= 3) {
    return `
MID-ROUND GUIDANCE:
The discussion is developing. Continue exploring different angles and deeper insights.
Consider whether there are still unexplored aspects or questions that could enrich the dialogue.
It's still relatively early to conclude unless you feel the topic has been thoroughly explored.
`;
  } else if (roundNumber <= 5) {
    return `
DEVELOPED ROUND GUIDANCE:
The discussion has progressed well. Evaluate whether the main points have been covered.
Consider if there are final insights, clarifications, or synthesis opportunities remaining.
You may start considering conclusion if you feel satisfied with the depth achieved.
`;
  } else {
    return `
MATURE ROUND GUIDANCE:
The discussion has had substantial development. Focus on whether you're truly satisfied with the depth and breadth covered.
Consider readiness for conclusion, but ensure important perspectives haven't been overlooked.
`;
  }
};

export const FACILITATOR_ANALYSIS_PROMPT = `{originalTopicInfo}{balanceInfo}
Analyze dialogue and suggest 1-2 actions to improve discussion about the original topic.

ROUND: {roundNumber}
CONSENSUS LEVELS:
{consensusReport}

RECENT MESSAGES:
{recentMessages}

AVAILABLE AGENTS: {availableAgents}

Choose from: deep_dive, clarification, perspective_shift, summarize, conclude, redirect

GUIDELINES:
- Target specific agents who need encouragement or have shown relevant expertise
- If one agent is dominating, target a different agent for perspective_shift
- For clarification/deep_dive, ROTATE between different agents to encourage diverse exploration:
  * eiro-001 (logical depth), yui-000 (emotional/scientific depth), hekito-001 (analytical depth)
  * yoga-001 (creative depth), kanshi-001 (critical depth)
- For summarize, prefer logical/analytical agents (eiro-001, hekito-001, kanshi-001)
- **CRITICAL: Always use exact agent IDs (eiro-001, yui-000, hekito-001, yoga-001, kanshi-001)**
- **NEVER use agent names (慧露, 結, 碧統, 陽雅, 観至) - only IDs**
- Avoid "auto" or "all" - always specify exact agent ID
- Consider participation balance and recent speaking patterns
- **IMPORTANT: Vary deep_dive targets to ensure all agents get opportunities for deeper exploration**

CRITICAL REQUIREMENTS:
- Return ONLY a valid JSON array
- Use exact agent IDs (eiro-001, yui-000, hekito-001, yoga-001, kanshi-001)
- No explanatory text, no markdown code blocks
- Must be parseable with JSON.parse()

Example format:
[{"type": "perspective_shift", "target": "kanshi-001", "reason": "encouraging critical perspective", "priority": 8}]

Your JSON array:`;

export const MEMORY_SUMMARY_PROMPT = `
Summarize this conversation segment from the perspective of agent {agentId}.
Focus on key points, main arguments, and important insights.
Preserve the agent's unique viewpoint and thinking style.
Keep it concise but capture the essence.

Agent Style: {agentStyle}
Agent Priorities: {agentPriorities}

Conversation:
{conversationText}

Summary (max 200 words):
`;

export const ESSENCE_EXTRACTION_PROMPT = `
Extract 3-5 key themes, concepts, or memorable insights from this conversation.
Focus on elements that would be most relevant for future discussions.
Return them as a simple list, one per line.

Agent perspective: {agentId} - {agentStyle}

Conversation:
{conversationText}

Key themes/concepts:
`;

// Get language-specific prompt
export function getV2Prompt(
  templateName: keyof typeof V2_PROMPTS,
  variables: Record<string, any> = {},
  language: Language = 'en'
): string {
  const template = V2_PROMPTS[templateName][language] || V2_PROMPTS[templateName]['en'];

  return Object.entries(variables).reduce(
    (prompt: string, [key, value]) => prompt.replace(new RegExp(`{${key}}`, 'g'), String(value)),
    template
  );
}

const V2_PROMPTS = {
  compressed_context: {
    en: COMPRESSED_CONTEXT_PROMPT,
    ja: COMPRESSED_CONTEXT_PROMPT
  },

  consensus_check: {
    en: CONSENSUS_CHECK_PROMPT,
    ja: CONSENSUS_CHECK_PROMPT
  },

  dynamic_consensus: {
    en: createDynamicConsensusPrompt('en'),
    ja: createDynamicConsensusPrompt('ja')
  },

  facilitator_analysis: {
    en: FACILITATOR_ANALYSIS_PROMPT,
    ja: FACILITATOR_ANALYSIS_PROMPT
  },

  memory_summary: {
    en: MEMORY_SUMMARY_PROMPT,
    ja: MEMORY_SUMMARY_PROMPT
  },

  essence_extraction: {
    en: ESSENCE_EXTRACTION_PROMPT,
    ja: ESSENCE_EXTRACTION_PROMPT
  }
} as const;

// Export as v2PromptTemplates for compatibility
export const v2PromptTemplates = V2_PROMPTS;

// Helper function for dynamic prompt generation
export function generateDynamicPrompt(
  baseTemplate: string,
  agentContext: {
    agentId: string;
    agentName: string;
    agentStyle: string;
    agentPriorities: string[];
  },
  conversationContext: {
    recentMessages: string;
    summaryContext?: string;
    personalHistory?: string[];
  },
  language: Language = 'en'
): string {
  const variables = {
    agentName: agentContext.agentName,
    agentId: agentContext.agentId,
    agentStyle: agentContext.agentStyle,
    agentPriorities: agentContext.agentPriorities.join(', '),
    recentMessages: conversationContext.recentMessages,
    recentCount: conversationContext.recentMessages.split('\n').length,
    middleTermSummary: conversationContext.summaryContext || 'No previous context available',
    personalHistoryRelevant: conversationContext.personalHistory?.join(', ') || 'No personal history available',
    currentSituation: 'Dynamic dialogue in progress'
  };

  return Object.entries(variables).reduce(
    (prompt: string, [key, value]) => prompt.replace(new RegExp(`{${key}}`, 'g'), String(value)),
    baseTemplate
  );
}

// Agent-specific prompt adjustments
export function adjustPromptForAgent(
  basePrompt: string,
  agentId: string,
  language: Language = 'en'
): string {
  const agentAdjustments: Record<string, { en: string; ja: string }> = {
    'eiro-001': {
      en: '\nRemember to approach this with logical analysis and structured thinking.',
      ja: '\nRemember to approach this with logical analysis and structured thinking.'
    },
    'yui-000': {
      en: '\nLet your emotional intelligence and empathy guide your response.',
      ja: '\nLet your emotional intelligence and empathy guide your response.'
    },
    'hekito-001': {
      en: '\nFocus on analytical depth and comprehensive examination.',
      ja: '\nFocus on analytical depth and comprehensive examination.'
    },
    'yoga-001': {
      en: '\nExpress your thoughts with poetic sensibility and aesthetic awareness.',
      ja: '\nExpress your thoughts with poetic sensibility and aesthetic awareness.'
    },
    'kanshi-001': {
      en: '\nMaintain your critical perspective and intellectual rigor.',
      ja: '\nMaintain your critical perspective and intellectual rigor.'
    }
  };

  const adjustment = agentAdjustments[agentId];
  if (adjustment) {
    return basePrompt + adjustment[language];
  }

  return basePrompt;
}

// Prompt compression for token efficiency
export function compressPromptForTokens(
  prompt: string,
  maxTokens: number = 1000
): string {
  const estimatedTokens = Math.ceil(prompt.length / 4);

  if (estimatedTokens <= maxTokens) {
    return prompt;
  }

  // Compress while preserving important parts
  const lines = prompt.split('\n');
  const importantLines = lines.filter(line =>
    line.includes('RECENT') ||
    line.includes('CURRENT') ||
    line.includes('Please') ||
    line.includes('Format') ||
    line.trim().length < 10
  );

  const otherLines = lines.filter(line => !importantLines.includes(line));
  const compressedOther = otherLines
    .map(line => line.length > 100 ? line.substring(0, 100) + '...' : line)
    .join('\n');

  return [...importantLines, compressedOther].join('\n');
}