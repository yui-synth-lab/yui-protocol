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

**IMPORTANT MINDSET:**
- Perfect consensus is not required for meaningful dialogue
- A satisfaction level of 6-7 indicates productive exploration, not failure
- Focus on whether THIS ROUND added value, not whether all questions are answered
- "Beautiful incompleteness" (美しい未解決) is acceptable for deep philosophical topics

Based on the recent discussion, please evaluate your satisfaction and readiness regarding this original topic:

RECENT DISCUSSION:
{contextText}

Please respond with:
1. Your satisfaction level with THIS ROUND's contribution to "{originalQuery}" (1-10)
   - Scale: 5-6 = Some value with significant gaps | 7-8 = Meaningful progress | 9-10 = Exceptional depth (rare)
2. Has this round provided NEW insights about "{originalQuery}"? (yes/no)
3. Would ANOTHER round of dialogue add significant value? (yes/no)
   - Consider: Are there unexplored angles? New questions to ask?
4. Are you ready to move toward conclusion? (yes/no)
5. Detailed reasoning focusing on:
   - What THIS round contributed
   - What (if anything) still needs exploration
   - Why you're ready/not ready to conclude

{additionalGuidance}

**IMPORTANT: Use EXACTLY this format with English field names, but write the Reasoning content in ${language === 'ja' ? 'Japanese' : 'English'}:**
Satisfaction: [1-10]
New insights this round: [yes/no]
Another round valuable: [yes/no]
Ready to conclude: [yes/no]
Reasoning: [detailed explanation in ${language === 'ja' ? 'Japanese' : 'English'}]
`;

// "Beautiful incompleteness" guidance for philosophical discussions
export const BEAUTIFUL_INCOMPLETENESS_GUIDANCE = `

**PHILOSOPHICAL INQUIRY MODE:**
This discussion explores deep questions where complete resolution may not be possible or desirable.

**Evaluation Criteria:**
- Focus on the QUALITY of exploration, not the achievement of definitive answers
- A satisfaction of 6-7 can indicate rich, meaningful dialogue
- Readiness to conclude means: "We've explored this beautifully, even if mysteries remain"
- Unresolved tensions can be valuable contributions, not failures

**When to Conclude:**
- When new perspectives have been thoroughly explored
- When the question has been illuminated from multiple angles
- When continuing would be repetitive, not deepening
- **NOT when all agents agree or all questions are answered**
`;

export const getRoundGuidanceText = (roundNumber: number, isPhilosophical: boolean = false): string => {
  let baseGuidance = '';

  if (roundNumber <= 1) {
    baseGuidance = `
EARLY ROUND GUIDANCE (Round ${roundNumber}):
This is still an early phase of the discussion. Focus on exploration and depth rather than reaching conclusions.
Consider expressing additional perspectives, asking questions, and building upon others' ideas.
Unless the topic is extremely simple, most discussions benefit from at least 2-3 rounds of exchange.

**CRITICAL: Provide detailed reasoning for your satisfaction level. Even if others have similar views,
explain YOUR unique perspective on what aspects you find satisfying or unsatisfying, and what still needs exploration.**
`;
  } else if (roundNumber <= 3) {
    baseGuidance = `
MID-ROUND GUIDANCE (Round ${roundNumber}):
The discussion is developing. Continue exploring different angles and deeper insights.
Consider whether there are still unexplored aspects or questions that could enrich the dialogue.
It's still relatively early to conclude unless you feel the topic has been thoroughly explored.

**Provide specific reasoning: What has been well-explored? What still needs attention?
What unique insights do YOU still have to contribute? Be detailed in your reasoning.**
`;
  } else if (roundNumber <= 5) {
    baseGuidance = `
DEVELOPED ROUND GUIDANCE (Round ${roundNumber}):
The discussion has progressed well. Evaluate whether the main points have been covered from YOUR perspective.
Consider if there are final insights, clarifications, or synthesis opportunities remaining.
You may start considering conclusion if you feel satisfied with the depth achieved.

**Be specific about what would make YOU satisfied to conclude. What final insights do YOU have?
Explain your reasoning in detail, not just "I agree with others."**
`;
  } else {
    baseGuidance = `
MATURE ROUND GUIDANCE (Round ${roundNumber}):
The discussion has had substantial development. Focus on whether you're truly satisfied with the depth and breadth covered.
Consider readiness for conclusion, but ensure important perspectives haven't been overlooked.

**Provide thoughtful reasoning about YOUR readiness. What would need to happen for YOU to feel complete?
Even in later rounds, your unique perspective matters - explain it fully.**
`;
  }

  // Add philosophical guidance for rounds 5+ if topic is philosophical
  if (isPhilosophical && roundNumber >= 5) {
    return baseGuidance + BEAUTIFUL_INCOMPLETENESS_GUIDANCE;
  }

  return baseGuidance;
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

**ACTION SELECTION STRATEGY:**

1. **Consensus Pattern Analysis:**
   - If consensus DROPPING (e.g., 5.6→5.3→5.0): Use "clarification" or "perspective_shift"
   - If consensus STABLE but LOW (<6.0): Rotate between "deep_dive" and "perspective_shift"
   - If consensus HIGH (>7.0): Consider "summarize" or "conclude"

2. **Round-Based Strategy:**
   - Rounds 1-3: Primarily "deep_dive" and "perspective_shift" (exploration)
   - Rounds 4-7: Mix "deep_dive", "clarification", "perspective_shift" (integration)
   - Rounds 8-12: Add "summarize" as option (consolidation)
   - Rounds 13+: Favor "conclude" if consensus >6.5 (closure)

3. **Diversity Rules:**
   - **NEVER use the same action type for 3 consecutive rounds**
   - **ROTATE deep_dive targets:** If eiro-001 last round, choose different agent this round
   - **Balance participation:** Check message counts, target less-active agents

4. **Agent Targeting Guidelines:**
   - deep_dive: Rotate systematically (eiro-001→yui-000→hekito-001→yoga-001→kanshi-001)
   - perspective_shift: Target critical/creative agents (kanshi-001, yoga-001, yui-000)
   - clarification: Target logical agents (eiro-001, hekito-001)
   - summarize: Target analytical agents (hekito-001, kanshi-001, eiro-001)

**CRITICAL REQUIREMENTS:**
- Return ONLY a valid JSON array
- Use exact agent IDs (eiro-001, yui-000, hekito-001, yoga-001, kanshi-001)
- **NEVER use agent names (慧露, 結, 碧統, 陽雅, 観至) - only IDs**
- No explanatory text, no markdown code blocks
- Must be parseable with JSON.parse()
- Include "reason" field explaining WHY this action NOW

Example format:
[{"type": "perspective_shift", "target": "yoga-001", "reason": "consensus dropping (5.6→5.3), need creative reframe", "priority": 8}]

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