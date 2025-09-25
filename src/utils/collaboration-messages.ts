import { Message } from '../types/index.js';

export interface CollaborativeFinalizationInfo {
  sessionId: string;
  finalizers: { id: string; name: string; role: string }[];
  totalSteps: number;
  topic: string;
}

export function createCollaborationIntroMessage(
  info: CollaborativeFinalizationInfo,
  language: 'ja' | 'en' = 'en'
): Message {
  const content = language === 'ja'
    ? createJapaneseCollaborationIntro(info)
    : createEnglishCollaborationIntro(info);

  return {
    id: `collab-intro-${Date.now()}`,
    agentId: 'facilitator-001',
    content,
    timestamp: new Date(),
    role: 'facilitator',
    stage: 'finalize',
    metadata: {
      messageType: 'collaboration_introduction',
      collaborationType: 'multiple_finalizers',
      totalFinalizers: info.finalizers.length,
      expectedSteps: info.totalSteps
    }
  };
}

function createEnglishCollaborationIntro(info: CollaborativeFinalizationInfo): string {
  return `🎭 **COLLABORATIVE FINALIZATION BEGINS**

Following democratic voting, **${info.finalizers.length} finalizers** have been selected to work together in creating our comprehensive conclusion about:

> "${info.topic}"

**🎯 THE COLLABORATION PROCESS:**

${info.finalizers.map((f, index) => {
  const stepNumber = index + 1;
  const role = f.role === 'foundation' ? '🏗️ Foundation Builder' :
               f.role === 'integrator' ? '🌟 Synthesis Integrator' :
               '🔗 Perspective Enricher';

  return `**Step ${stepNumber}**: ${role}
   └ **${f.name}** will ${getRoleDescription(f.role, stepNumber, info.finalizers.length)}`;
}).join('\n\n')}

**🤝 WHY COLLABORATIVE FINALIZATION?**
Multiple perspectives ensure our conclusion honors the full depth and nuance of our exploration, creating something richer than any single viewpoint could achieve.

---
*Watch as each finalizer builds meaningfully upon the previous contributions...*`;
}

function createJapaneseCollaborationIntro(info: CollaborativeFinalizationInfo): string {
  return `🎭 **協力的ファイナライゼーション開始**

民主的投票の結果、**${info.finalizers.length}名のファイナライザー**が選出され、以下のテーマについて包括的な結論を協力して作成します：

> 「${info.topic}」

**🎯 協力プロセス：**

${info.finalizers.map((f, index) => {
  const stepNumber = index + 1;
  const role = f.role === 'foundation' ? '🏗️ 基盤構築者' :
               f.role === 'integrator' ? '🌟 統合責任者' :
               '🔗 視点拡張者';

  return `**ステップ ${stepNumber}**: ${role}
   └ **${f.name}** が ${getRoleDescriptionJa(f.role, stepNumber, info.finalizers.length)}`;
}).join('\n\n')}

**🤝 なぜ協力的ファイナライゼーション？**
複数の視点により、我々の結論は探求の全体的な深さと微妙さを尊重し、単一の視点では達成できないより豊かなものを創造します。

---
*各ファイナライザーが前の貢献を有意義に発展させる様子をご覧ください...*`;
}

function getRoleDescription(role: string, step: number, total: number): string {
  switch (role) {
    case 'foundation':
      return 'establish the analytical framework and key insights that others will build upon';
    case 'integrator':
      return 'weave together all previous analyses into a unified, comprehensive conclusion';
    case 'enricher':
    default:
      return `add complementary perspectives and deepen the collaborative synthesis (${step}/${total})`;
  }
}

function getRoleDescriptionJa(role: string, step: number, total: number): string {
  switch (role) {
    case 'foundation':
      return '他者が発展させる分析的枠組みと主要洞察を確立します';
    case 'integrator':
      return '全ての前の分析を統一的で包括的な結論に織り込みます';
    case 'enricher':
    default:
      return `補完的視点を追加し、協力的統合を深化させます (${step}/${total})`;
  }
}

export function createCollaborationProgressMessage(
  agentName: string,
  step: number,
  total: number,
  role: string,
  sessionId: string,
  language: 'ja' | 'en' = 'en'
): Message {
  const roleEmoji = role === 'foundation' ? '🏗️' : role === 'integrator' ? '🌟' : '🔗';
  const roleNameEn = role === 'foundation' ? 'Foundation Building' :
                     role === 'integrator' ? 'Synthesis Integration' : 'Perspective Enrichment';
  const roleNameJa = role === 'foundation' ? '基盤構築' :
                     role === 'integrator' ? '統合作業' : '視点拡張';

  const content = language === 'ja'
    ? `${roleEmoji} **ステップ ${step}/${total}: ${roleNameJa}**

**${agentName}** が協力的ファイナライゼーションに貢献しています...

${getProgressDescriptionJa(role, step, total)}`
    : `${roleEmoji} **Step ${step}/${total}: ${roleNameEn}**

**${agentName}** is contributing to our collaborative finalization...

${getProgressDescription(role, step, total)}`;

  return {
    id: `collab-progress-${step}-${Date.now()}`,
    agentId: 'facilitator-001',
    content,
    timestamp: new Date(),
    role: 'facilitator',
    stage: 'finalize',
    metadata: {
      messageType: 'collaboration_progress',
      currentStep: step,
      totalSteps: total,
      contributorName: agentName,
      contributorRole: role
    }
  };
}

function getProgressDescription(role: string, step: number, total: number): string {
  switch (role) {
    case 'foundation':
      return '*Building the analytical foundation upon which others will construct our collective understanding...*';
    case 'integrator':
      return '*Weaving together all perspectives into our final, unified conclusion...*';
    case 'enricher':
    default:
      return `*Adding unique insights and bridging different analytical approaches... (${step}/${total})*`;
  }
}

function getProgressDescriptionJa(role: string, step: number, total: number): string {
  switch (role) {
    case 'foundation':
      return '*他者が集合的理解を構築するための分析的基盤を築いています...*';
    case 'integrator':
      return '*全ての視点を最終的で統一的な結論に織り込んでいます...*';
    case 'enricher':
    default:
      return `*独自の洞察を追加し、異なる分析アプローチを橋渡ししています... (${step}/${total})*`;
  }
}

export function createCollaborationSummaryMessage(
  finalizers: string[],
  totalContributions: number,
  sessionId: string,
  topic: string,
  language: 'ja' | 'en' = 'en'
): Message {
  const content = language === 'ja'
    ? `✨ **協力的ファイナライゼーション完了**

**${finalizers.length}名のファイナライザー**（${finalizers.join('、')}）による協力が完了しました。

🎯 **成果:**
- **${totalContributions}個の統合的分析** が「${topic}」について作成されました
- **多角的視点** から包括的な理解が構築されました
- **集合知** により単一の視点を超えた洞察が実現されました

この協力的プロセスにより、我々の探求に相応しい深みのある結論が生まれました。

---
*協力的ファイナライゼーションが我々の対話に新たな次元をもたらしました*`
    : `✨ **COLLABORATIVE FINALIZATION COMPLETE**

The collaboration between **${finalizers.length} finalizers** (${finalizers.join(', ')}) has been completed.

🎯 **ACHIEVEMENTS:**
- **${totalContributions} integrated analyses** created about "${topic}"
- **Multi-perspective understanding** built from diverse viewpoints
- **Collective wisdom** achieved insights beyond any single perspective

This collaborative process has produced a conclusion worthy of the depth of our exploration.

---
*Collaborative finalization has brought new dimensions to our dialogue*`;

  return {
    id: `collab-summary-${Date.now()}`,
    agentId: 'facilitator-001',
    content,
    timestamp: new Date(),
    role: 'facilitator',
    stage: 'finalize',
    metadata: {
      messageType: 'collaboration_summary',
      collaborationType: 'multiple_finalizers_complete',
      participantCount: finalizers.length,
      participants: finalizers,
      totalContributions
    }
  };
}