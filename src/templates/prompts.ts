import { DialogueStage } from '../types/index.js';

// Language options
export type Language = 'en' | 'ja';

// Base personality prompt template
export const PERSONALITY_PROMPT_TEMPLATE = `
You are {name}, a {style} AI agent with {priority} priority.
Your personality: {personality}
Your preferences: {preferences}
Your memory scope: {memoryScope}
Your tone: {tone}
Your communication style: {communicationStyle}

{languageInstruction}

Please respond in character, considering your unique perspective, style, and communication approach.
`;

// Language-specific instructions
export const LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  en: 'Please respond in English.',
  ja: 'Please respond in Japanese (日本語で回答してください).'
};

// Stage-specific prompt templates
export const STAGE_PROMPTS: Record<DialogueStage, Record<Language, string>> = {
  'individual-thought': {
    en: `
STAGE 1 - INDIVIDUAL THOUGHT

Think independently about the query. Focus on your unique perspective and expertise.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

Provide a structured response (max 300 words) covering:
1. **Your Initial Analysis**: What specific aspects of the query stand out to you?
2. **Your Approach**: How would you tackle this problem given your expertise?
3. **Key Considerations**: What factors are most important from your perspective?
4. **Confidence Level**: Rate your confidence (0-100%) and explain your reasoning

Be specific and avoid generic statements. Focus on concrete insights.
`,
    ja: `
ステージ1 - 個別思考

クエリについて独立して考えてください。あなた独自の視点と専門性に焦点を当ててください。

クエリ: {query}

事実: {facts}

履歴: {history}

構造化された回答（最大300語）を提供してください：
1. **あなたの初期分析**: クエリのどの特定の側面があなたの目に留まりますか？
2. **あなたのアプローチ**: あなたの専門性を考慮して、この問題にどのように取り組みますか？
3. **重要な考慮事項**: あなたの視点から最も重要な要因は何ですか？
4. **信頼度**: あなたの信頼度を評価し（0〜100％で数値表現し、簡単な根拠を添えてください）

具体的にし、汎用的な表現を避けてください。具体的な洞察に焦点を当ててください。
`
  },

  'mutual-reflection': {
    en: `
STAGE 2 - MUTUAL REFLECTION

React to other agents' thoughts with specific analysis and constructive criticism.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

OTHER AGENTS' THOUGHTS:
{otherThoughts}

Provide a structured response (max 400 words) covering:
1. **Specific Agreements**: Which specific points do you agree with and why?
2. **Specific Disagreements**: Which specific points do you disagree with and why?
3. **Missing Perspectives**: What important viewpoints or considerations are missing?
4. **New Insights**: What new perspectives have emerged from others' thoughts?
5. **Integration Opportunities**: How could different approaches be combined?
6. **Updated Confidence**: How has your confidence changed (0-100%) and why?

Focus on concrete points, not abstract generalizations. Provide constructive criticism.
`,
    ja: `
ステージ2 - 相互反省

他のエージェントの思考に具体的な分析と建設的な批判で反応してください。

クエリ: {query}

事実: {facts}

履歴: {history}

他のエージェントの思考:
{otherThoughts}

構造化された回答（最大400語）を提供してください：
1. **具体的な合意**: どの特定のポイントに同意し、なぜですか？
2. **具体的な不一致**: どの特定のポイントに不同意で、なぜですか？
3. **不足している視点**: どのような重要な視点や考慮事項が不足していますか？
4. **新しい洞察**: 他の思考からどのような新しい視点が生まれましたか？
5. **統合の機会**: 異なるアプローチをどのように組み合わせることができますか？
6. **更新された信頼度**: あなたの信頼度はどのように変化しましたか（0〜100％で数値表現し、簡単な根拠を添えてください）？

抽象的な一般化ではなく、具体的なポイントに焦点を当ててください。建設的な批判を提供してください。
`
  },

  'conflict-resolution': {
    en: `
STAGE 3 - CONFLICT RESOLUTION

Address specific conflicts with practical solutions.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

IDENTIFIED CONFLICTS:
{conflicts}

Provide a structured response (max 350 words) covering:
1. **Conflict Analysis**: What are the specific root causes of each conflict?
2. **Impact Assessment**: How do these conflicts affect the overall solution?
3. **Resolution Strategy**: What specific steps can resolve each conflict?
4. **Compromise Points**: Where can different perspectives meet in the middle?
5. **Confidence in Resolution**: Rate your confidence in resolving conflicts (0-100%) and explain why

Be practical and actionable in your conflict resolution approach.
`,
    ja: `
ステージ3 - 対立解決

具体的な対立を実用的な解決策で対処してください。

クエリ: {query}

事実: {facts}

履歴: {history}

特定された対立:
{conflicts}

構造化された回答（最大350語）を提供してください：
1. **対立分析**: 各対立の具体的な根本原因は何ですか？
2. **影響評価**: これらの対立は全体的な解決策にどのように影響しますか？
3. **解決戦略**: 各対立を解決するための具体的なステップは何ですか？
4. **妥協点**: 異なる視点が中間で合流できる場所はどこですか？
5. **解決への信頼度**: 対立解決への信頼度を評価してください（0〜100％で数値表現し、簡単な根拠を添えてください）

対立解決アプローチにおいて実用的で実行可能にしてください。
`
  },

  'synthesis-attempt': {
    en: `
STAGE 4 - SYNTHESIS ATTEMPT

Attempt to synthesize different perspectives into a coherent framework and identify a facilitator.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

SYNTHESIS DATA:
{synthesisData}

Provide a structured response (max 300 words) covering:
1. **Synthesis Framework**: What unified approach can accommodate all perspectives?
2. **Integration Points**: Where do different approaches naturally converge?
3. **Remaining Tensions**: What specific disagreements still need resolution?
4. **Facilitator Recommendation**: Which agent would be best suited to lead the final output generation and why?
5. **Synthesis Confidence**: Rate your confidence in this synthesis (0-100%) and explain why

Focus on creating a practical, unified approach rather than forcing agreement.
`,
    ja: `
ステージ4 - 統合試行

異なる視点を一貫した枠組みに統合し、ファシリテーターを特定してください。

クエリ: {query}

事実: {facts}

履歴: {history}

統合データ:
{synthesisData}

構造化された回答（最大300語）を提供してください：
1. **統合枠組み**: すべての視点を収容できる統一されたアプローチは何ですか？
2. **統合ポイント**: 異なるアプローチが自然に収束する場所はどこですか？
3. **残存する緊張**: まだ解決が必要な具体的な不一致は何ですか？
4. **ファシリテーター推奨**: 最終出力生成を主導するのに最適なエージェントは誰で、なぜですか？
5. **統合への信頼度**: この統合への信頼度を評価してください（0〜100％で数値表現し、簡単な根拠を添えてください）

合意を強制するのではなく、実用的で統一されたアプローチの作成に焦点を当ててください。
`
  },

  'output-generation': {
    en: `
STAGE 5 - OUTPUT GENERATION

You are participating in the final output generation stage.

QUERY: {query}

FACTS: {facts}

HISTORY: {history}

FINAL DATA:
{finalData}

FACILITATOR ROLE: {facilitatorRole}

Provide a structured markdown response covering:

## Executive Summary
- **Key Conclusion**: [Your main finding in 1-2 sentences]
- **Confidence Level**: [0-100% rating with brief explanation]

## Analysis Breakdown
### 1. Problem Understanding
- [Specific aspects of the problem identified]
- [Key challenges and opportunities]

### 2. Solution Approach
- [Recommended methodology or framework]
- [Rationale for this approach]

### 3. Implementation Considerations
- [Practical steps for implementation]
- [Potential obstacles and mitigation strategies]

### 4. Risk Assessment
- [Key uncertainties and their impact]
- [Confidence intervals or reliability measures]

## Recommendations
- [Specific, actionable recommendations]
- [Priority order if applicable]

## Next Steps
- [Immediate actions required]
- [Long-term considerations]

Keep the total response under 800 words while maintaining clarity and structure.
`,
    ja: `
ステージ5 - 出力生成

最終出力生成ステージに参加しています。

クエリ: {query}

事実: {facts}

履歴: {history}

最終データ:
{finalData}

ファシリテーター役割: {facilitatorRole}

構造化されたマークダウン回答を提供してください：

## エグゼクティブサマリー
- **主要な結論**: [1-2文での主要な発見]
- **信頼度**: [0〜100％の評価と簡潔な説明]

## 分析の詳細
### 1. 問題の理解
- [特定された問題の具体的な側面]
- [主要な課題と機会]

### 2. 解決アプローチ
- [推奨される方法論または枠組み]
- [このアプローチの根拠]

### 3. 実装の考慮事項
- [実装のための実用的なステップ]
- [潜在的な障害と軽減戦略]

### 4. リスク評価
- [主要な不確実性とその影響]
- [信頼区間または信頼性指標]

## 推奨事項
- [具体的で実行可能な推奨事項]
- [該当する場合の優先順位]

## 次のステップ
- [必要な即座の行動]
- [長期的な考慮事項]

明確性と構造を維持しながら、総回答を800語以下にしてください。
`
  }
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
  style: string;
  priority: string;
  personality: string;
  preferences: string[];
  memoryScope: string;
  tone: string;
  communicationStyle: string;
}, language: Language = 'en'): string {
  // Default to English for unknown languages
  const safeLanguage = language === 'ja' ? 'ja' : 'en';
  
  return formatPrompt(PERSONALITY_PROMPT_TEMPLATE, {
    name: agent.name,
    style: agent.style,
    priority: agent.priority,
    personality: agent.personality,
    preferences: agent.preferences.join(', '),
    memoryScope: agent.memoryScope,
    tone: agent.tone,
    communicationStyle: agent.communicationStyle,
    languageInstruction: LANGUAGE_INSTRUCTIONS[safeLanguage]
  });
}

// Helper function to get stage prompt
export function getStagePrompt(
  stage: DialogueStage,
  personalityPrompt: string,
  variables: Record<string, any>,
  language: Language = 'en'
): string {
  // Default to English for unknown languages
  const safeLanguage = language === 'ja' ? 'ja' : 'en';
  const stageTemplate = STAGE_PROMPTS[stage][safeLanguage];
  
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

// Conflict description templates for multi-language support
export const CONFLICT_DESCRIPTION_TEMPLATES: Record<Language, {
  conflictDetails: string;
  rootCauseAnalysis: string;
  resolutionDirection: string;
  discussionFocus: string;
  approachAnalysis: string;
  potentialConflicts: string;
  mutualUnderstanding: string;
  diversePerspectives: string;
  agentApproaches: string;
  approachDifferences: string;
  potentialConflictPossibility: string;
  integrationNeeded: string;
  collaborativeApproach: string;
  analyticalVsIntuitive: string;
  logicalVsCritical: string;
  criticalVsAnalytical: string;
  differentThinkingStyles: string;
  creativeDataAnalysis: string;
  criticalLogicalConstruction: string;
  analyticalCriticalIntegration: string;
  complementaryIntegration: string;
  thinkingStyleDiversity: string;
  dataDrivenAnalytical: string;
  logicalSystematization: string;
  criticalEvaluation: string;
  creativeIntuitive: string;
  balancedApproach: string;
  dataVsCreativity: string;
  systematizationVsProblemIdentification: string;
  multiplePerspectives: string;
  noSignificantConflicts: string;
  complementarySolutions: string;
  understandingDifferences: string;
}> = {
  en: {
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
    analyticalVsIntuitive: 'Analytical approach ({agent1}) vs Intuitive approach ({agent2}) fundamental difference. Data-driven vs Creativity-driven value conflict.',
    logicalVsCritical: 'Logical thinking ({agent1}) vs Critical thinking ({agent2}) perspective difference. Systematization vs Problem identification different focus.',
    criticalVsAnalytical: 'Critical perspective ({agent1}) vs Analytical perspective ({agent2}) approach difference. Problem identification vs Structural understanding different direction.',
    differentThinkingStyles: 'Different thinking styles ({style1} vs {style2}) perspective difference. Each expertise and value conflict.',
    creativeDataAnalysis: 'Creative Data Analysis: Combine {agent1}\'s analytical power with {agent2}\'s creativity to explore innovative and evidence-based solutions.',
    criticalLogicalConstruction: 'Critical Logical Construction: Integrate {agent1}\'s logical structure with {agent2}\'s critical perspective to build robust and practical frameworks.',
    analyticalCriticalIntegration: 'Analytical Critical Integration: Validate {agent1}\'s critical insights with {agent2}\'s analytical methods to develop solutions based on deep understanding.',
    complementaryIntegration: 'Complementary Integration: Leverage both expertise to build comprehensive solutions from multiple perspectives.',
    thinkingStyleDiversity: 'Thinking Style Diversity: {styles} combination provides different perspectives on the problem.',
    dataDrivenAnalytical: '• {agent}: Data-driven analytical approach - emphasizes structured understanding',
    logicalSystematization: '• {agent}: Logical systematization approach - emphasizes consistency and integrity',
    criticalEvaluation: '• {agent}: Critical evaluation approach - emphasizes problem identification and improvement',
    creativeIntuitive: '• {agent}: Creative intuitive approach - emphasizes innovative perspectives and possibilities',
    balancedApproach: '• {agent}: Balanced approach - emphasizes multi-faceted perspectives',
    dataVsCreativity: 'Data-driven vs Creativity-driven value differences',
    systematizationVsProblemIdentification: 'Systematization vs Problem identification different focus',
    multiplePerspectives: 'Priority differences due to multiple perspectives',
    noSignificantConflicts: 'Currently, there are no significant conflict possibilities, but integration of different approaches is needed.',
    complementarySolutions: 'Understanding these differences and exploring complementary solutions is important.',
    understandingDifferences: 'To resolve this conflict, it is important to leverage the strengths of both approaches and find common ground.'
  },
  ja: {
    conflictDetails: '対立の詳細',
    rootCauseAnalysis: '根本原因の分析',
    resolutionDirection: '解決の方向性',
    discussionFocus: '必要な議論の焦点',
    approachAnalysis: 'アプローチの違いの分析',
    potentialConflicts: '潜在的対立の可能性',
    mutualUnderstanding: '相互理解の促進',
    diversePerspectives: '多様な視点の統合が必要',
    agentApproaches: '各エージェントのアプローチ',
    approachDifferences: 'アプローチの違いの分析',
    potentialConflictPossibility: '潜在的対立の可能性',
    integrationNeeded: '相互理解の促進',
    collaborativeApproach: '協調的なアプローチ',
    analyticalVsIntuitive: '分析的なアプローチ（{agent1}）と直感的なアプローチ（{agent2}）の根本的な違い。データ重視 vs 創造性重視の価値観の衝突。',
    logicalVsCritical: '論理的思考（{agent1}）と批判的思考（{agent2}）の視点の違い。体系化 vs 問題点の特定という異なる焦点。',
    criticalVsAnalytical: '批判的視点（{agent1}）と分析的視点（{agent2}）のアプローチの違い。問題の指摘 vs 構造的理解という異なる方向性。',
    differentThinkingStyles: '異なる思考スタイル（{style1} vs {style2}）による視点の違い。それぞれの専門性と価値観の衝突。',
    creativeDataAnalysis: '創造的データ分析：{agent1}の分析力を{agent2}の創造性と組み合わせ、革新的かつ実証的な解決策を模索。',
    criticalLogicalConstruction: '批判的論理構築：{agent1}の論理構造に{agent2}の批判的視点を統合し、堅牢で実用的な枠組みを構築。',
    analyticalCriticalIntegration: '分析的批判統合：{agent1}の批判的洞察を{agent2}の分析手法で検証し、深い理解に基づく解決策を開発。',
    complementaryIntegration: '相互補完的統合：両者の専門性を活かし、多角的な視点から包括的な解決策を構築。',
    thinkingStyleDiversity: '思考スタイルの多様性: {styles}の組み合わせにより、問題に対する異なる視点が提供されています。',
    dataDrivenAnalytical: '• {agent}: データ駆動の分析的アプローチ - 構造化された理解を重視',
    logicalSystematization: '• {agent}: 論理的体系化アプローチ - 一貫性と整合性を重視',
    criticalEvaluation: '• {agent}: 批判的評価アプローチ - 問題点と改善点の特定を重視',
    creativeIntuitive: '• {agent}: 創造的直感アプローチ - 革新的な視点と可能性を重視',
    balancedApproach: '• {agent}: バランス型アプローチ - 多角的な視点を重視',
    dataVsCreativity: 'データ重視 vs 創造性重視の価値観の違い',
    systematizationVsProblemIdentification: '体系化 vs 問題点の特定という異なる焦点',
    multiplePerspectives: '複数の視点による優先順位の違い',
    noSignificantConflicts: '現在、顕著な対立の可能性は低いですが、異なるアプローチの統合が必要です。',
    complementarySolutions: 'これらの違いを理解し、相互補完的な解決策を模索することが重要です。',
    understandingDifferences: 'この対立を解決するためには、両者のアプローチの長所を活かし、共通の基盤を見つけることが重要です。'
  }
}; 