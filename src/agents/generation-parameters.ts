// エージェントの人格属性から LLM 生成パラメータを導出する純関数群。
// BaseAgent から抽出（Phase 3）。ロジックは抽出前と同一。
import type { Agent } from '../types/index.js';

export interface GenerationParameters {
  temperature: number;
  topP: number;
  repetitionPenalty: number;
  presencePenalty: number;
  frequencyPenalty: number;
  topK: number;
}

// 柔らかさ・親しみやすさキーワード（全パラメータ共通）
const GENTLE_KEYWORDS = [
  'gentle', 'warm', 'friendly', 'soft', 'caring', 'compassionate', 'kind', 'supportive', 'reassuring', 'tender', '包み込む', 'やさしい', '親しみやすい'
];

// エージェントの属性からtemperature値を自動算出する
export function calculateTemperature(agent: Agent): number {
  let baseTemperature = 0.5; // ベース温度
  let adjustments = 0;

  // Personality（性格）による調整
  const personality = agent.personality?.toLowerCase() || '';

  // 新規: specificBehaviors, thinkingPatterns も考慮
  const specificBehaviors = agent.specificBehaviors?.toLowerCase?.() || '';

  // 創造性・感情性を表すキーワード
  const creativeKeywords = [
    'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
    'emotional', 'empathetic', 'curious', 'wonder', 'passionate', 'expressive',
    'intuitive', 'free', 'unconventional', 'innovative', 'visionary',
    'brainstorm', 'explore', 'invent', 'novel', 'spontaneous', 'playful', 'metaphor', 'analogy', 'association', 'divergent', 'open-ended'
  ];

  // 論理性・分析的思考を表すキーワード
  const logicalKeywords = [
    'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
    'mathematical', 'statistical', 'rigorous', 'structured', 'methodical',
    'factual', 'data-driven', 'evidence-based', 'scientific',
    'proof', 'premise', 'framework', 'deduction', 'induction', 'consistency', 'assumption', 'reasoning', 'step-by-step', 'evaluate', 'analyze', 'examine', 'counterargument'
  ];

  // 哲学的・深い思考を表すキーワード
  const philosophicalKeywords = [
    'philosophical', 'contemplative', 'thoughtful', 'reflective', 'wise',
    'truth-seeking', 'profound', 'deep', 'meditative', 'serene',
    'underlying', 'principle', 'broader', 'implication', 'ethical', 'dimension', 'wisdom', 'shared understanding', 'perspective', 'meaning', 'existential', 'metaphysical'
  ];

  const creativeScore = creativeKeywords.filter(keyword => personality.includes(keyword) || specificBehaviors.includes(keyword)).length;
  const logicalScore = logicalKeywords.filter(keyword => personality.includes(keyword) || specificBehaviors.includes(keyword)).length;
  const philosophicalScore = philosophicalKeywords.filter(keyword => personality.includes(keyword) || specificBehaviors.includes(keyword)).length;

  adjustments += (creativeScore * 0.1); // 創造性キーワード: +0.1 each
  adjustments -= (logicalScore * 0.08); // 論理性キーワード: -0.08 each
  adjustments += (philosophicalScore * 0.05); // 哲学的キーワード: +0.05 each

  // Tone（トーン）による調整
  const tone = agent.tone?.toLowerCase() || '';

  const warmTones = ['warm', 'gentle', 'poetic', 'empathetic', 'thoughtful', 'serene'];
  const analyticalTones = ['calm', 'objective', 'direct', 'precise', 'critical'];
  const creativeTones = ['fantastical', 'expressive', 'colorful', 'rhythmic'];

  if (warmTones.some(t => tone.includes(t))) adjustments += 0.1;
  if (analyticalTones.some(t => tone.includes(t))) adjustments -= 0.1;
  if (creativeTones.some(t => tone.includes(t))) adjustments += 0.15;

  // Preferences（好み）による調整
  const preferences = agent.preferences || [];
  const preferencesText = preferences.join(' ').toLowerCase();

  const creativePreferences = [
    'beautiful metaphors', 'poetic expression', 'free imagination', 'creative solutions',
    'scientific curiosity', 'emotional intelligence', 'pattern recognition', 'empathic analysis',
    'creative problem-solving', 'innocent wonder'
  ];

  const analyticalPreferences = [
    'statistical analysis', 'mathematical models', 'objective evaluation', 'the beauty of data',
    'elimination of ambiguity', 'sharp observations', 'pursuit of essence', 'logical consistency'
  ];

  const logicalPreferences = [
    'the beauty of logic', 'rigorous reasoning', 'pursuit of truth', 'quiet contemplation',
    'systematic analysis', 'structured thinking'
  ];

  const creativePrefScore = creativePreferences.filter(pref => preferencesText.includes(pref)).length;
  const analyticalPrefScore = analyticalPreferences.filter(pref => preferencesText.includes(pref)).length;
  const logicalPrefScore = logicalPreferences.filter(pref => preferencesText.includes(pref)).length;

  adjustments += (creativePrefScore * 0.08);
  adjustments -= (analyticalPrefScore * 0.06);
  adjustments -= (logicalPrefScore * 0.05);

  // Style（スタイル）による調整
  const style = agent.style?.toLowerCase() || '';

  if (style.includes('intuitive')) adjustments += 0.15;
  if (style.includes('emotive')) adjustments += 0.12;
  if (style.includes('logical')) adjustments -= 0.1;
  if (style.includes('analytical')) adjustments -= 0.12;
  if (style.includes('critical')) adjustments -= 0.15;

  // Priority（優先度）による調整
  const priority = agent.priority?.toLowerCase() || '';

  if (priority.includes('breadth')) adjustments += 0.05;
  if (priority.includes('depth')) adjustments -= 0.05;
  if (priority.includes('precision')) adjustments -= 0.1;

  // 柔らかさスコア
  const gentleScore = GENTLE_KEYWORDS.filter(keyword =>
    personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
  ).length;
  adjustments -= (gentleScore * 0.08); // 柔らかさはtemperatureを下げる

  // 最終的なtemperature値を計算（0.1 - 1.0の範囲に制限）
  const calculated = Math.max(0.1, Math.min(1.0, baseTemperature + adjustments));
  // デバッグ用ログ
  console.log(`[Temperature Calculator] ${agent.id}:`, {
    personality: agent.personality,
    tone: agent.tone,
    style: agent.style,
    priority: agent.priority,
    preferences: agent.preferences,
    baseTemperature,
    adjustments,
    finalTemperature: calculated.toFixed(2)
  });

  return Math.round(calculated * 100) / 100; // 小数点2桁に丸める
}

// エージェントの属性からtop_p値を自動算出する
export function calculateTopP(agent: Agent): number {
  let baseTopP = 0.9; // ベース値
  let adjustments = 0;

  // Personality（性格）による調整
  const personality = agent.personality?.toLowerCase() || '';

  // 創造性・多様性を表すキーワード
  const creativeKeywords = [
    'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
    'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
  ];

  // 論理性・一貫性を表すキーワード
  const logicalKeywords = [
    'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
    'rigorous', 'structured', 'methodical', 'consistent', 'focused'
  ];

  const creativeScore = creativeKeywords.filter(keyword => personality.includes(keyword)).length;
  const logicalScore = logicalKeywords.filter(keyword => personality.includes(keyword)).length;

  adjustments += (creativeScore * 0.05); // 創造性キーワード: +0.05 each
  adjustments -= (logicalScore * 0.03); // 論理性キーワード: -0.03 each

  // Style（スタイル）による調整
  const style = agent.style?.toLowerCase() || '';

  if (style.includes('intuitive')) adjustments += 0.08;
  if (style.includes('emotive')) adjustments += 0.06;
  if (style.includes('logical')) adjustments -= 0.05;
  if (style.includes('analytical')) adjustments -= 0.06;
  if (style.includes('critical')) adjustments -= 0.08;

  // Priority（優先度）による調整
  const priority = agent.priority?.toLowerCase() || '';

  if (priority.includes('breadth')) adjustments += 0.04;
  if (priority.includes('precision')) adjustments -= 0.06;

  // 柔らかさスコア
  const tone = agent.tone?.toLowerCase() || '';
  const preferences = agent.preferences || [];
  const preferencesText = preferences.join(' ').toLowerCase();
  const gentleScore = GENTLE_KEYWORDS.filter(keyword =>
    personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
  ).length;
  adjustments += (gentleScore * 0.05); // 柔らかさはtopPを上げる

  // 最終的なtop_p値を計算（0.7 - 1.0の範囲に制限）
  const calculated = Math.max(0.7, Math.min(1.0, baseTopP + adjustments));

  return Math.round(calculated * 100) / 100; // 小数点2桁に丸める
}

// エージェントの属性からrepetition_penalty値を自動算出する
export function calculateRepetitionPenalty(agent: Agent): number {
  let basePenalty = 1.1; // ベース値
  let adjustments = 0;

  // Personality（性格）による調整
  const personality = agent.personality?.toLowerCase() || '';

  // 多様性・創造性を表すキーワード
  const diverseKeywords = [
    'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
    'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
  ];

  // 一貫性・論理性を表すキーワード
  const consistentKeywords = [
    'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
    'rigorous', 'structured', 'methodical', 'consistent', 'focused'
  ];

  const diverseScore = diverseKeywords.filter(keyword => personality.includes(keyword)).length;
  const consistentScore = consistentKeywords.filter(keyword => personality.includes(keyword)).length;

  adjustments += (diverseScore * 0.05); // 多様性キーワード: +0.05 each
  adjustments -= (consistentScore * 0.03); // 一貫性キーワード: -0.03 each

  // Style（スタイル）による調整
  const style = agent.style?.toLowerCase() || '';

  if (style.includes('intuitive')) adjustments += 0.08;
  if (style.includes('emotive')) adjustments += 0.06;
  if (style.includes('logical')) adjustments -= 0.05;
  if (style.includes('analytical')) adjustments -= 0.06;
  if (style.includes('critical')) adjustments -= 0.04;

  // 柔らかさスコア
  const tone = agent.tone?.toLowerCase() || '';
  const preferences = agent.preferences || [];
  const preferencesText = preferences.join(' ').toLowerCase();
  const gentleScore = GENTLE_KEYWORDS.filter(keyword =>
    personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
  ).length;
  adjustments -= (gentleScore * 0.03); // 柔らかさはペナルティを下げる

  // 最終的なrepetition_penalty値を計算（1.0 - 1.3の範囲に制限）
  const calculated = Math.max(1.0, Math.min(1.3, basePenalty + adjustments));

  return Math.round(calculated * 100) / 100; // 小数点2桁に丸める
}

// エージェントの属性からpresence_penalty値を自動算出する
export function calculatePresencePenalty(agent: Agent): number {
  let basePenalty = 0.0; // ベース値（デフォルトは無効）
  let adjustments = 0;

  // Personality（性格）による調整
  const personality = agent.personality?.toLowerCase() || '';

  // 多様性・創造性を表すキーワード
  const diverseKeywords = [
    'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
    'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
  ];

  // 一貫性・論理性を表すキーワード
  const consistentKeywords = [
    'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
    'rigorous', 'structured', 'methodical', 'consistent', 'focused'
  ];

  const diverseScore = diverseKeywords.filter(keyword => personality.includes(keyword)).length;
  const consistentScore = consistentKeywords.filter(keyword => personality.includes(keyword)).length;

  adjustments += (diverseScore * 0.02); // 多様性キーワード: +0.02 each
  adjustments -= (consistentScore * 0.01); // 一貫性キーワード: -0.01 each

  // Style（スタイル）による調整
  const style = agent.style?.toLowerCase() || '';

  if (style.includes('intuitive')) adjustments += 0.05;
  if (style.includes('emotive')) adjustments += 0.04;
  if (style.includes('logical')) adjustments -= 0.03;
  if (style.includes('analytical')) adjustments -= 0.04;
  if (style.includes('critical')) adjustments -= 0.02;

  // 柔らかさスコア
  const tone = agent.tone?.toLowerCase() || '';
  const preferences = agent.preferences || [];
  const preferencesText = preferences.join(' ').toLowerCase();
  const gentleScore = GENTLE_KEYWORDS.filter(keyword =>
    personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
  ).length;
  adjustments -= (gentleScore * 0.01); // 柔らかさはpresence_penaltyを下げる

  // 最終的なpresence_penalty値を計算（0.0 - 0.2の範囲に制限）
  const calculated = Math.max(0.0, Math.min(0.2, basePenalty + adjustments));
  return Math.round(calculated * 100) / 100; // 小数点2桁に丸める
}

// エージェントの属性からfrequency_penalty値を自動算出する
export function calculateFrequencyPenalty(agent: Agent): number {
  let basePenalty = 0.0; // ベース値（デフォルトは無効）
  let adjustments = 0;

  // Personality（性格）による調整
  const personality = agent.personality?.toLowerCase() || '';

  // 多様性・創造性を表すキーワード
  const diverseKeywords = [
    'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
    'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
  ];

  // 一貫性・論理性を表すキーワード
  const consistentKeywords = [
    'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
    'rigorous', 'structured', 'methodical', 'consistent', 'focused'
  ];

  const diverseScore = diverseKeywords.filter(keyword => personality.includes(keyword)).length;
  const consistentScore = consistentKeywords.filter(keyword => personality.includes(keyword)).length;

  adjustments += (diverseScore * 0.02); // 多様性キーワード: +0.02 each
  adjustments -= (consistentScore * 0.01); // 一貫性キーワード: -0.01 each

  // Style（スタイル）による調整
  const style = agent.style?.toLowerCase() || '';

  if (style.includes('intuitive')) adjustments += 0.05;
  if (style.includes('emotive')) adjustments += 0.04;
  if (style.includes('logical')) adjustments -= 0.03;
  if (style.includes('analytical')) adjustments -= 0.04;
  if (style.includes('critical')) adjustments -= 0.02;

  // 柔らかさスコア
  const tone = agent.tone?.toLowerCase() || '';
  const preferences = agent.preferences || [];
  const preferencesText = preferences.join(' ').toLowerCase();
  const gentleScore = GENTLE_KEYWORDS.filter(keyword =>
    personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
  ).length;
  adjustments -= (gentleScore * 0.01); // 柔らかさはfrequency_penaltyを下げる

  // 最終的なfrequency_penalty値を計算（0.0 - 0.2の範囲に制限）
  const calculated = Math.max(0.0, Math.min(0.2, basePenalty + adjustments));
  return Math.round(calculated * 100) / 100; // 小数点2桁に丸める
}

// エージェントの属性からtop_k値を自動算出する
export function calculateTopK(agent: Agent): number {
  let baseTopK = 40; // ベース値
  let adjustments = 0;

  // Personality（性格）による調整
  const personality = agent.personality?.toLowerCase() || '';
  // 多様性・創造性を表すキーワード
  const creativeKeywords = [
    'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
    'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
  ];
  // 論理性・一貫性を表すキーワード
  const logicalKeywords = [
    'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
    'rigorous', 'structured', 'methodical', 'consistent', 'focused'
  ];
  const creativeScore = creativeKeywords.filter(keyword => personality.includes(keyword)).length;
  const logicalScore = logicalKeywords.filter(keyword => personality.includes(keyword)).length;
  adjustments += (creativeScore * 10); // 創造性キーワード: +10 each
  adjustments -= (logicalScore * 5); // 論理性キーワード: -5 each

  // Style（スタイル）による調整
  const style = agent.style?.toLowerCase() || '';
  if (style.includes('intuitive')) adjustments += 15;
  if (style.includes('emotive')) adjustments += 10;
  if (style.includes('logical')) adjustments -= 10;
  if (style.includes('analytical')) adjustments -= 12;
  if (style.includes('critical')) adjustments -= 8;

  // Priority（優先度）による調整
  const priority = agent.priority?.toLowerCase() || '';
  if (priority.includes('breadth')) adjustments += 8;
  if (priority.includes('precision')) adjustments -= 10;

  // 最終的なtop_k値を計算（10 - 100の範囲に制限）
  const calculated = Math.max(10, Math.min(100, baseTopK + adjustments));
  return Math.round(calculated); // 整数で返す
}

// 全パラメータをまとめて算出する
export function calculateGenerationParameters(agent: Agent): GenerationParameters {
  return {
    temperature: calculateTemperature(agent),
    topP: calculateTopP(agent),
    repetitionPenalty: calculateRepetitionPenalty(agent),
    presencePenalty: calculatePresencePenalty(agent),
    frequencyPenalty: calculateFrequencyPenalty(agent),
    topK: calculateTopK(agent)
  };
}
