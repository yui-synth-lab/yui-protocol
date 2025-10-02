#!/usr/bin/env node

/**
 * セッションファイルから会話部分と重要な要素を抽出してMarkdownファイルを生成
 * Usage: node extract-dialogue.js <sessionID>
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 絵文字マッピング
const EMOJI_MAP = {
  '慧露': '📖',
  '観至': '🧙',
  '陽雅': '🌈',
  '碧統': '📈',
  '結心': '💗',
  'ゆい': '⚙️',
  'System': '⚙️'
};

const AGENT_NAME_MAP = {
  'hekito-001': '慧露',
  'kanshi-001': '観至',
  'yoga-001': '陽雅',
  'hekitou-001': '碧統',
  'yui-000': '結心'
};

/**
 * セッションファイルを読み込む
 */
async function loadSession(sessionId) {
  const sessionPath = path.join(__dirname, '..', 'sessions', `${sessionId}.json`);
  try {
    const content = await fs.readFile(sessionPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`セッションファイルの読み込みに失敗しました: ${error.message}`);
  }
}

/**
 * エージェント名から絵文字を取得
 */
function getEmojiForAgent(agentName) {
  return EMOJI_MAP[agentName] || '💬';
}

/**
 * メッセージをMarkdown形式に変換
 */
function formatMessage(message, agentMap) {
  const agent = agentMap.get(message.agentId);
  const agentName = agent ? agent.name : message.agentId;
  const emoji = getEmojiForAgent(agentName);

  // システムメッセージやファシリテーターメッセージの特別処理
  if (message.role === 'system') {
    if (message.id.startsWith('onvergence')) {
      return `\n⚙️ System\n\n設定された最大ラウンド数に達しました。現在の合意度は ${message.metadata.consensusLevel}/10 です。対話を終了し最終統合に移ります。
対話が収束に達したため、最終統合を担当するエージェントを選出します。\n`;
    } else if (message.id.startsWith('voting-result')) {
      return `\n⚙️ System\n\n${message.content}\n`;
    }
    else {
      return '';
    }
  }

  // 通常のエージェントメッセージ
  Object.keys(AGENT_NAME_MAP).forEach(key => {
    message.content = message.content.replace(new RegExp(key, 'g'), AGENT_NAME_MAP[key]);
  });
  return `\n${emoji}${agentName}\n\n${message.content}\n`;
}

/**
 * プロローグを生成
 */
function generatePrologue(session) {
  const question = session.title;

  return `
問い：${question}

`;
}


/**
 * メインの抽出処理
 */
async function extractDialogue(sessionId) {
  console.log(`セッション ${sessionId} を処理中...`);

  // セッションを読み込み
  const session = await loadSession(sessionId);

  // エージェントマップを作成
  const agentMap = new Map();
  session.agents.forEach(agent => {
    agentMap.set(agent.id, agent);
  });

  // Markdownコンテンツを構築
  let markdown = '';

  // プロローグ
  markdown += generatePrologue(session);

  // メッセージを順番に処理
  const relevantMessages = session.messages.filter(msg => {
    // ユーザーメッセージは除外（通常は質問のみ）
    if (msg.role === 'user') return false;
    if (msg.stage === 'facilitator') return false;
    if (msg.role === 'consensus') return false;


    // ファシリテーターメッセージは含める
    // if (msg.role === 'facilitator') return true;

    // 空のメッセージは除外
    if (!msg.content || msg.content.trim() === '') return false;

    return true;
  });

  relevantMessages.forEach(message => {
    markdown += formatMessage(message, agentMap);
  });


  // ファイルに書き込み
  const outputPath = path.join(__dirname, '..', `${sessionId}.md`);
  await fs.writeFile(outputPath, markdown, 'utf-8');

  console.log(`✓ 出力完了: ${outputPath}`);
  console.log(`  - メッセージ数: ${relevantMessages.length}`);
  console.log(`  - エージェント数: ${session.agents.length}`);
  console.log(`  - タイトル: ${session.title.substring(0, 50)}...`);

  return outputPath;
}

/**
 * メイン実行
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('使い方: node extract-dialogue.js <sessionID>');
    console.error('例: node extract-dialogue.js 208');
    process.exit(1);
  }

  const sessionId = args[0];

  try {
    await extractDialogue(sessionId);
  } catch (error) {
    console.error(`エラー: ${error.message}`);
    process.exit(1);
  }
}

main();
