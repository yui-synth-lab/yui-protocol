// エージェント応答テキストの解析（リフレクション・同意判定・質問抽出）。
// BaseAgent から抽出した純関数群（Phase 3）。ロジックは抽出前と同一。
import type { Agent, IndividualThought } from '../../types/index.js';

export interface ParsedReflection {
  targetAgentId: string;
  reaction: string;
  agreement: boolean;
  questions: string[];
}

function toKatakana(hiragana: string): string {
  return hiragana.replace(/[ぁ-ん]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

// 同意/不同意を判定
export function detectAgreement(content: string, agentId: string, displayName?: string): boolean {
  const agreementPatterns = [
    /同意|賛成|同感|理解|共感|良い|素晴らしい|興味深い|説得力|妥当|適切/gi,
    /agree|support|understand|good|great|interesting|convincing|valid|appropriate/gi
  ];
  const disagreementPatterns = [
    /不同意|反対|異議|疑問|懸念|問題|不適切|違う|異なる|批判|否定|しかし|ただし|一方|but|however|disagree|oppose|question|concern|problem|inappropriate|different|criticize/gi
  ];
  const agentMention = new RegExp(`${agentId}${displayName ? `|${displayName}` : ''}`, 'gi');
  const lines = content.split('\n').filter(line => agentMention.test(line));
  if (lines.length === 0) return false;
  if (lines.some(line => disagreementPatterns.some(pattern => pattern.test(line)))) return false;
  if (lines.some(line => agreementPatterns.some(pattern => pattern.test(line)))) return true;
  return false;
}

// 質問を抽出
export function extractQuestions(content: string, agentId: string, displayName?: string): string[] {
  const questions: string[] = [];
  const agentPattern = new RegExp(`${agentId}${displayName ? `|${displayName}` : ''}`, 'gi');
  const questionPatterns = [
    /([^。！？]*[ですか？？？])/g,
    /([^.!?]*[?？])/g
  ];
  const lines = content.split('\n');
  for (const line of lines) {
    if (agentPattern.test(line)) {
      for (const pattern of questionPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          questions.push(...matches.map(q => q.trim()).filter(q => q.length > 5));
        }
      }
    }
  }
  return questions.slice(0, 3);
}

// 反応を抽出
export function extractReaction(content: string, agentId: string, displayName?: string): string {
  const agentPattern = new RegExp(`${agentId}${displayName ? `|${displayName}` : ''}`, 'gi');
  const lines = content.split('\n');
  for (const line of lines) {
    if (agentPattern.test(line)) {
      const reaction = line.trim();
      if (reaction.length > 10 && reaction.length < 200) {
        return reaction;
      }
    }
  }
  return 'No specific engagement detected';
}

// 相互リフレクション応答から、他エージェントへの言及・同意・質問を構造化する
export function parseReflectionsFromContent(
  content: string,
  otherThoughts: IndividualThought[],
  agents: Agent[]
): ParsedReflection[] {
  const reflections: ParsedReflection[] = [];
  // Fallback for undefined agents
  const agentList = agents || [];
  for (const thought of otherThoughts) {
    const agentId = thought.agentId;
    const agentObj = agentList.find(a => a.id === agentId);
    const displayName = agentObj?.name || agentId;
    const furigana = agentObj?.furigana || '';
    const katakana = furigana ? toKatakana(furigana) : '';
    const agentNamePatterns = [
      new RegExp(`${agentId}`, 'gi'),
      new RegExp(`${displayName}`, 'gi'),
      new RegExp(`${displayName.replace(/[^\u0000-\u007F\u3040-\u30FF\u4E00-\u9FFF]/g, '')}`, 'gi'),
    ];
    if (furigana) agentNamePatterns.push(new RegExp(`${furigana}`, 'gi'));
    if (katakana) agentNamePatterns.push(new RegExp(`${katakana}`, 'gi'));
    // エージェントへの言及があるかチェック
    const hasMention = agentNamePatterns.some(pattern => pattern.test(content));
    if (hasMention) {
      // 否定的・対立的な表現を優先的に検出
      const negativePatterns = [
        /異なります|疑問|しかし|反対|異議|批判|違う|問題|懸念|不適切|否定|ただし|一方|but|however|disagree|oppose|question|concern|problem|inappropriate|different|criticize/gi
      ];
      const agentMention = new RegExp(`${agentId}|${displayName}|${furigana}|${katakana}`, 'gi');
      // エージェント名を含む行だけ抽出
      const lines = content.split('\n').filter(line => agentMention.test(line));
      const negative = lines.some(line => negativePatterns.some(pattern => pattern.test(line)));
      const agreement = negative ? false : detectAgreement(content, agentId, displayName);
      const questions = extractQuestions(content, agentId, displayName);
      const reaction = extractReaction(content, agentId, displayName);
      reflections.push({
        targetAgentId: agentId,
        reaction: reaction || 'Engaged with the perspective',
        agreement,
        questions
      });
    } else {
      // エージェントへの言及がない場合は、より適切なデフォルト値を設定
      reflections.push({
        targetAgentId: agentId,
        reaction: 'No direct engagement with this agent\'s perspective',
        agreement: false,
        questions: []
      });
    }
  }
  return reflections;
}
