#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function usage() {
  console.log('Usage: node convert-session-to-md.js <input.json> [output.md]');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 1) usage();

const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1] || path.join(path.dirname(inputPath), '..', 'outputs', `${path.basename(inputPath, '.json')}.no-prologue.md`));

if (!fs.existsSync(inputPath)) {
  console.error('Input file not found:', inputPath);
  process.exit(2);
}

const raw = await fs.promises.readFile(inputPath, 'utf8');
let session;
try {
  session = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse JSON:', err.message);
  process.exit(3);
}

// Patterns to exclude (prologue/epilogue markers). You can extend this list if needed.
const excludePatterns = [
  'プロローグ',
  'エピローグ',
  'Prologue',
  'Epilogue',
  'EPILOGUE',
  'PROLOGUE'
];

function shouldExcludeMessage(msg) {
  if (!msg || !msg.content) return true;
  // Exclude messages that explicitly mention prologue/epilogue markers
  for (const p of excludePatterns) {
    if (msg.content.indexOf(p) !== -1) return true;
  }
  // Always exclude system-role messages (we treat them as internal summaries)
  if (msg.role === 'system') return true;
  return false;
}

// Build a simple agent map for nicer headings
// Build a map of agents including furigana (reading). We'll use it to append 《furigana》 after names.
const agents = {};
if (Array.isArray(session.agents)) {
  session.agents.forEach(a => {
    agents[a.id] = {
      name: a.name || a.id,
      furigana: a.furigana || ''
    };
  });
}

const lines = [];
const title = session.title || `Session ${session.id || ''}`;
lines.push(`# ${title}`);
if (session.id) lines.push(`_Session ID: ${session.id}_`);
lines.push('');
// Map stage keys to human-friendly section titles (English + Japanese)
const stageTitles = {
  'individual-thought': 'Individual Thought（個別思考）',
  'mutual-reflection': 'Mutual Reflection（相互省察）',
  'conflict-resolution': 'Conflict Resolution（対立解決）',
  'synthesis-attempt': 'Synthesis Attempt（統合試論）',
  'output-generation': 'Output Generation（最終統合）',
  'finalize': 'Finalize（最終総括）'
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (Array.isArray(session.messages)) {
  let currentStage = null;

  for (const m of session.messages) {
    if (shouldExcludeMessage(m)) continue; // skip system/prologue-like messages

    const stageKey = m.stage || 'ungrouped';
    // When we enter a new stage, emit the stage heading
    if (stageKey !== currentStage) {
      currentStage = stageKey;
      const stageTitle = stageTitles[stageKey] || stageKey.replace(/-/g, ' ');
      lines.push(`---`);
      lines.push('');
      lines.push(`### ${stageTitle}`);
      lines.push('');
    }

    const agentMeta = agents[m.agentId] || { name: m.agentId || (m.role || 'unknown'), furigana: '' };
    const furigana = agentMeta.furigana ? `《${agentMeta.furigana}》` : '';

    // Agent heading (just name + furigana)
    lines.push(`#### ${agentMeta.name}${furigana}`);
    lines.push('');

    // Replace agent IDs inside the content with name《furigana》 where present
    let content = m.content || '';
    for (const [aid, meta] of Object.entries(agents)) {
      if (!meta || !meta.name) continue;
      const rep = meta.furigana ? `${meta.name}《${meta.furigana}》` : meta.name;
      const re = new RegExp(`\\b${escapeRegExp(aid)}\\b`, 'g');
      content = content.replace(re, rep);
    }

    lines.push(content);
    lines.push('');
  }
} else {
  console.warn('No messages array found in session JSON');
}

// Write output
await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
await fs.promises.writeFile(outputPath, lines.join('\n'), 'utf8');
console.log('Wrote', outputPath);
