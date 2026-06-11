// 投票テキストの解析ロジック。templates/prompts.ts から分離（Phase 3）。
// プロンプト（データ）とパーサ（コード）の分離、および投票解析一本化（VoteParser）の置き場。

// 文字列を正規表現用にエスケープ
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
export function extractVoteDetails(content: string, agentId: string, agents?: Array<{ id: string, name: string }>): {
  votedAgent: string | null;
  reasoning: string | null;
  voteSection: string | null
} {
  let votedAgent: string | null = null;
  let reasoning: string | null = null;
  let voteSection: string | null = null;

  // 1. Try JSON parsing first
  try {
    // Extract JSON array
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      const jsonContent = JSON.parse(jsonMatch[0]);
      if (Array.isArray(jsonContent) && jsonContent.length > 0) {
        // Find the vote by this agent (assuming the array contains votes from multiple agents, or just one object if the prompt asked for it)
        // The prompt asks for an array of objects: { voterId, targetId, reason }

        // Find the entry where voterId matches current agentId
        const voteEntry = jsonContent.find((entry: any) =>
          entry.voterId && entry.voterId.toLowerCase() === agentId.toLowerCase()
        );

        if (voteEntry) {
          // Self-vote check
          if (voteEntry.targetId && voteEntry.targetId.toLowerCase() !== agentId.toLowerCase()) {
            return {
              votedAgent: voteEntry.targetId,
              reasoning: voteEntry.reason,
              voteSection: jsonMatch[0]
            };
          }
        }
      }
    }
  } catch (e) {
    // JSON parse failed, fall back to regex
    console.warn('[VoteParser] JSON parsing failed, falling back to regex', e);
  }

  // 1.5. Direct "{agentId/name}に投票" patterns (agent reference before 投票)
  if (agents) {
    for (const agent of agents) {
      if (agent.id.toLowerCase() === agentId.toLowerCase()) continue; // skip self
      const escapedId = escapeRegExp(agent.id);
      const escapedName = escapeRegExp(agent.name);
      const directPatterns = [
        new RegExp(`${escapedId}(?:氏|さん|様)?(?:\\s*\\([^)]*\\))?に投票`, 'i'),
        new RegExp(`${escapedName}(?:氏|さん|様)?(?:\\s*\\([^)]*\\))?に投票`, 'i'),
        // "名前-番号様に投票" format e.g. 観至-001様に投票
        new RegExp(`${escapedName}-[0-9]+(?:氏|さん|様)?に投票`, 'i'),
        // "(name)に投票" or "name (id)に投票"
        new RegExp(`\\(${escapedId}\\)に投票`, 'i'),
      ];
      for (const pat of directPatterns) {
        const m = content.match(pat);
        if (m) {
          // Return the line containing the match as voteSection for context
          const matchIndex = m.index ?? 0;
          const lineStart = content.lastIndexOf('\n', matchIndex - 1) + 1;
          const lineEnd = content.indexOf('\n', matchIndex);
          const voteLine = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
          // Extract reasoning: everything after 投票(します) on same and following lines
          const afterMatch = content.slice(matchIndex);
          const reasonMatch = afterMatch.match(/に投票(?:します)?[。.]*\s*([\s\S]+)/i);
          const extractedReasoning = reasonMatch ? reasonMatch[1].trim() : null;
          return {
            votedAgent: agent.id,
            reasoning: extractedReasoning || voteLine,
            voteSection: voteLine
          };
        }
      }
    }
  }

  // 2. Fallback to Regex patterns
  // Covers observed real-world patterns:
  //   **Agent Vote and Justification** / **Agent Vote and Justification:**
  //   **Agent Vote and Justification: agent-id**
  //   **Agent Vote**: id / **Agent Vote: id** / **Agent Vote:** id
  //   **Vote:** id / [Vote: id]
  //   **投票: id** / **投票：id** / 投票: id
  //   私の投票先は... / 私は**name**氏に投票します
  const voteSectionPatterns = [
    /\*\*Agent Vote and Justification[：:*]*\*\*\s*([\s\S]+)$/i,
    /\*\*Agent Vote[：:]\s*([^\n*]+)\*\*/i,
    /\*\*Agent Vote\*\*[：:]\s*([\s\S]+)$/i,
    /\*\*Agent Vote\*\*\s*([\s\S]+)$/i,
    /\*\*Vote[：:]\s*([^\n*]+)\*\*/i,
    /\[Vote[：:]\s*([^\]]+)\]/i,
    /Agent Vote[：:]*\s*([\s\S]+)$/i,
    /\*\*投票[：:：]\s*([^\n*]+)\*\*/i,
    /投票[：:：]*\s*([\s\S]+)$/i,
    /vote[：:]*\s*([\s\S]+)$/i,
    /which agent should summarize[：:]*\s*([\s\S]+)$/i,
    /summarize and why[：:]*\s*([\s\S]+)$/i,
    /私は\*\*([^*]+)\*\*氏に投票します[\s\S]+?$/i,
    /私の投票先は[\s\S]+?$/i,
    /投票します[\s\S]+?$/i
  ];

  for (const pattern of voteSectionPatterns) {
    const match = content.match(pattern);
    if (match) {
      voteSection = match[0]; // Use full match for context; agent extraction happens below
      break;
    }
  }

  // If no specific vote section found, try to find vote in the last part of content
  if (!voteSection) {
    const lines = content.split('\n').reverse();
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
  // Note: reasoning is declared at function scope

  // Try to extract reasoning after vote declaration
  const reasoningPatterns = [
    /(?:投票します|vote).*?その理由は[\s\S]+?$/i,
    /(?:投票します|vote).*?理由は[\s\S]+?$/i,
    /(?:投票します|vote).*?理由[\s\S]+?$/i,
    /(?:投票します|vote).*?第一に[\s\S]+?$/i,
    /(?:投票します|vote).*?because[\s\S]+?$/i,
    /(?:投票します|vote).*?reason[\s\S]+?$/i
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


// ========== M4: regex-first 投票解析 ==========

/** AIベース解析（stage-summarizer.analyzeVotes）と互換の解析結果1件分 */
export interface RegexVoteAnalysis {
  agentId: string;
  votedAgent: string | null;
  reasoning: string | null;
  timestamp: Date;
}

/**
 * 正規表現ベースで全エージェントの投票を解析する（無料・決定的）。
 * 全票が確定した場合のみ resolvedAll=true。確定しない票がある場合は AI 解析にフォールバックする想定。
 */
export function analyzeVotesByRegex(
  responses: Array<{ agentId: string; content: string }>,
  agents: Array<{ id: string; name: string }>
): { resolvedAll: boolean; analyses: RegexVoteAnalysis[] } {
  const analyses: RegexVoteAnalysis[] = responses.map(r => {
    const details = extractVoteDetails(r.content, r.agentId, agents);
    return {
      agentId: r.agentId,
      votedAgent: details.votedAgent ?? null,
      reasoning: details.reasoning ?? null,
      timestamp: new Date()
    };
  });
  return {
    resolvedAll: analyses.length > 0 && analyses.every(a => a.votedAgent !== null),
    analyses
  };
}

/** stage-summarizer.formatVoteAnalysisAsMarkdown と同一フォーマットの Markdown を生成する */
export function formatVoteAnalysisMarkdown(
  voteAnalysis: RegexVoteAnalysis[],
  agents: Array<{ id: string; name: string }>
): string {
  const agentMap = new Map<string, string>();
  agents.forEach(agent => {
    agentMap.set(agent.id, agent.name);
  });

  const lines = voteAnalysis
    .filter(vote => vote.votedAgent !== null)
    .map(vote => {
      const voterName = agentMap.get(vote.agentId) || vote.agentId;
      const votedName = agentMap.get(vote.votedAgent!) || vote.votedAgent;
      const reason = vote.reasoning || '理由なし';
      return `- ${voterName} (${vote.agentId}): ${votedName} (${vote.votedAgent}) - ${reason}`;
    });

  voteAnalysis
    .filter(vote => vote.votedAgent === null)
    .forEach(vote => {
      const voterName = agentMap.get(vote.agentId) || vote.agentId;
      lines.push(`- ${voterName} (${vote.agentId}): No clear vote - ${voterName} は投票を行っていません。`);
    });

  return lines.join('\n');
}
