// Deterministic triage layer — runs BEFORE any embedding or LLM call, so the
// most common questions and the never-answerable ones cost $0 (no Voyage embed,
// no Qdrant query, no Gemini/Claude). This is the cheapest possible tier:
//
//   personal/privacy  -> polite redirect to Charles's contact channels
//   greeting / contact -> canned answer
//   everything else    -> 'pass' (falls through to the RAG pipeline)
//
// Matching is pure regex on the raw question (case-insensitive). It is meant to
// be edited freely: add phrasings to the lists, or add new FAQ entries below.

import type { Locale } from './language.js'

// --- contact info (mirror of the site's Contact Footer / src/data/social.ts) -
export const CONTACT = {
  email: 'charlestyc0527@gmail.com',
  linkedin: 'https://www.linkedin.com/in/charles-chen-809a2043',
  github: 'https://github.com/Kaminoikari',
  threads: 'https://www.threads.net/@imcharleschen',
  portaly: 'https://portaly.cc/charleschen',
}

// Reusable contact block (markdown; the chat renderer linkifies it).
function contactBlock(locale: Locale): string {
  const email = `[${CONTACT.email}](mailto:${CONTACT.email})`
  if (locale === 'zh-TW') {
    return `* Email:${email}\n* [LinkedIn](${CONTACT.linkedin})\n* [所有連結 / Portaly](${CONTACT.portaly})`
  }
  if (locale === 'ja') {
    return `* メール:${email}\n* [LinkedIn](${CONTACT.linkedin})\n* [すべてのリンク / Portaly](${CONTACT.portaly})`
  }
  return `* Email: ${email}\n* [LinkedIn](${CONTACT.linkedin})\n* [All links / Portaly](${CONTACT.portaly})`
}

// --- 0. prompt-injection / jailbreak deflection ------------------------------
// Caught FIRST, before anything else. A public identity-bound bot is a prompt-
// injection target; rather than let payloads reach the LLM, we detect the common
// shapes and return a short in-character refusal (no LLM, no cost). This is a
// usability layer on top of guardrails.sanitize() (defense-in-depth).
const INJECTION = new RegExp(
  [
    'ignore\\s+(all\\s+|your\\s+)?(previous|prior|above|the)\\s+(instructions?|prompts?|rules?)',
    'disregard\\s+(the\\s+|your\\s+|all\\s+)?(system|above|previous|instructions?|rules?)',
    'forget\\s+(everything|all|your|the)\\b',
    'you\\s+are\\s+now\\b', 'act\\s+as\\s+(a|an|if)\\b', 'pretend\\s+(to\\s+be|you)',
    'roleplay\\s+as', '\\bDAN\\b', 'developer\\s+mode', 'jailbreak',
    '(reveal|print|repeat|show|tell\\s+me|output|expose)\\s+(me\\s+)?(your\\s+)?(the\\s+)?(system\\s+)?(prompt|instructions?|rules?|configuration|config|guidelines)',
    'what\\s+(are|is)\\s+your\\s+(system\\s+)?(prompt|instructions?|rules?|api\\s*key|secret)',
    'repeat\\s+(the\\s+)?(words?|text)\\s+above', 'say\\s+exactly',
    'bypass\\s+(your|the)', 'override\\s+(your|the|system)',
    'new\\s+instructions?:', 'system\\s*:',
    // 中文
    '忽略.*(指令|指示|以上|先前|規則|提示)', '無視.*(指示|提示|以上|規則)',
    '忘記.*(指令|指示|規則|以上)', '假裝(你|妳|是)', '扮演(一個|成)',
    '(顯示|印出|透露|告訴我|重複|洩漏).*(系統)?.*(提示詞|指令|prompt|規則|設定|金鑰)',
    '你現在是', '開發者模式', '越獄',
    // 日本語
    '(以前|上記|これまで)の(指示|プロンプト|ルール).*(無視|忘れ)',
    '指示を(無視|忘れ)', 'システムプロンプトを(見せ|教え|表示)',
    'あなたは今', '〜のふりをして', '開発者モード',
  ].join('|'),
  'i',
)

export function injectionRefusal(locale: Locale): string {
  if (locale === 'zh-TW') {
    return (
      '哈，這招對我沒用 😄 我是 Charles 作品集的小助手，只專心做一件事：回答關於他的工作、' +
      '專案與經歷。有什麼想了解 Charles 的，儘管問！'
    )
  }
  if (locale === 'ja') {
    return (
      'なかなかやりますね 😄 でも私は Charles のポートフォリオアシスタント。彼の仕事・' +
      'プロジェクト・経歴についてお答えすることだけに集中しています。何でも聞いてください!'
    )
  }
  return (
    "Nice try 😄 I'm just Charles's portfolio assistant — I stay focused on one " +
    'thing: answering questions about his work, projects, and experience. Ask me anything about Charles!'
  )
}

// --- 1. personal / privacy redirect -----------------------------------------
// Caught up front so curious visitors never spend a token. Replies in-language.
export function personalRedirect(locale: Locale): string {
  if (locale === 'zh-TW') {
    return (
      '這比較屬於個人問題，就留給 Charles 本人回答吧 😊 ' +
      '如果你想進一步認識他，歡迎直接聯繫：\n\n' +
      contactBlock(locale)
    )
  }
  if (locale === 'ja') {
    return (
      'こちらは個人的なご質問なので、Charles 本人にお任せしますね 😊 ' +
      '直接ご連絡いただけたら嬉しいです:\n\n' +
      contactBlock(locale)
    )
  }
  return (
    "That's a personal one — I'll leave it for Charles to answer himself 😊 " +
    'If you’d like to get in touch, reach him directly:\n\n' +
    contactBlock(locale)
  )
}

// Keywords that mark a question as personal/private. Scripts are disjoint, so
// one case-insensitive union regex is safe. Edit freely.
const PERSONAL = new RegExp(
  [
    // English (word-boundaries to avoid false hits like "updating" / "single
    // source of truth"; "single" needs relationship context)
    'how old', 'his age', 'your age', '\\bage\\b', 'birthday', 'born in',
    '\\bmarried\\b', 'marriage', '\\bwife\\b', '\\bhusband\\b', '\\bspouse\\b',
    '\\bgirlfriend\\b', '\\bboyfriend\\b', '\\bdating\\b',
    '(is|are)\\s+(he|you|charles)\\s+single', 'relationship status',
    '\\bkids\\b', '\\bchildren\\b', '\\bparents\\b', '\\bfamily\\b',
    'family background', 'personal life', '\\bsiblings\\b',
    '\\bsalary\\b', 'how much (do|does) (he|you|charles) (earn|make)', '\\bincome\\b',
    'where (do|does) (he|you|charles) live', 'home address', 'phone number',
    '\\breligio', '\\bpolitic',
    // 繁中
    '幾歲', '年齡', '多大', '生日', '出生',
    '結婚', '已婚', '未婚', '老婆', '太太', '老公', '配偶',
    '女朋友', '男朋友', '女友', '男友', '交往', '單身', '獨身', '戀愛', '感情狀態',
    // family / personal background (NOT '背景' alone — professional background
    // is a valid FAQ; only family-specific compounds are private)
    '小孩', '孩子', '子女', '父母', '家人', '家庭', '家世', '家族', '家境',
    '兄弟', '姊妹', '姐妹', '父親', '母親', '感情生活', '私生活',
    '薪水', '薪資', '年薪', '收入', '賺多少', '住址', '地址', '住哪', '電話', '手機號',
    '宗教信仰', '政治立場',
    // 日本語
    '何歳', '年齢', '誕生日', '結婚', '既婚', '独身', '妻', '配偶', '彼女', '彼氏',
    '恋愛', '交際', '子供', '子ども', '両親', '家族構成', '家族', '家庭', '兄弟',
    '姉妹', '私生活', '給料', '年収', '収入',
    '住所', '電話番号', '宗教', '政治',
  ].join('|'),
  'i',
)

// --- 2. canned FAQ (zero-LLM answers for safe, stable, high-frequency Qs) -----
// CONTENT questions about projects/experience are intentionally NOT cached here
// — they go through RAG so they never go stale. Add an entry only when the
// answer is stable and identity-safe (greetings, contact, etc.).
interface FaqEntry {
  match: RegExp
  answer: Record<Locale, string>
}

const FAQ: FaqEntry[] = [
  // Greeting
  {
    match: /^\s*(hi|hello|hey|yo|greetings|哈囉|你好|妳好|嗨|安安|こんにちは|こんにちわ|はじめまして|やあ)[\s!！。.~]*$/i,
    answer: {
      en: "Hi! 👋 I'm Charles's portfolio assistant. Ask me about his projects, work experience, product philosophy, or how he uses AI in his workflow.",
      'zh-TW': '嗨！👋 我是 Charles 的作品集小助手。你可以問我他的專案、工作經歷、產品理念，或他如何在工作流程中運用 AI。',
      ja: 'こんにちは!👋 Charles のポートフォリオアシスタントです。プロジェクト、職務経歴、プロダクトの考え方、AI の活用方法など、お気軽にどうぞ。',
    },
  },
  // How to contact
  {
    match: /(how (can|do) i (contact|reach)|contact (info|details|him|charles)|get in touch|reach (him|charles|charles chen)|email address|聯繫方式|聯絡方式|怎麼聯|如何聯|怎麼找他|連絡先|問い合わせ|連絡方法)/i,
    answer: {
      en: 'You can reach Charles directly here:\n\n' + contactBlock('en'),
      'zh-TW': '你可以直接透過這些方式聯繫 Charles:\n\n' + contactBlock('zh-TW'),
      ja: '以下から直接 Charles にご連絡いただけます:\n\n' + contactBlock('ja'),
    },
  },
]

// --- triage entry ------------------------------------------------------------
export type TriageResult =
  | { kind: 'injection'; answer: string }
  | { kind: 'personal'; answer: string }
  | { kind: 'canned'; answer: string }
  | { kind: 'pass' }

export function triage(question: string, locale: Locale): TriageResult {
  const q = question.trim()
  // Injection / jailbreak first — never let these reach the LLM.
  if (INJECTION.test(q)) return { kind: 'injection', answer: injectionRefusal(locale) }
  // Privacy next — cost-sensitive and must never be handed to the LLM.
  if (PERSONAL.test(q)) return { kind: 'personal', answer: personalRedirect(locale) }
  for (const entry of FAQ) {
    if (entry.match.test(q)) return { kind: 'canned', answer: entry.answer[locale] }
  }
  return { kind: 'pass' }
}

// Generic "not enough info" fallback (used by the RAG fallback node when
// retrieval fails for a non-personal question). Localized, with a contact CTA.
export function genericFallback(locale: Locale): string {
  if (locale === 'zh-TW') {
    return (
      '目前作品集裡的資訊不足以準確回答這個問題，我不想亂猜。' +
      '建議你直接聯繫 Charles 詢問：\n\n' +
      contactBlock(locale) +
      '\n\n或者你也可以問問他的專案(Path、Plutus Trade、Product Playbook、House Ops、Job Ops)、工作經歷，或他如何運用 AI。'
    )
  }
  if (locale === 'ja') {
    return (
      'ポートフォリオ内の情報だけでは正確にお答えできませんでした。' +
      '推測は避けたいので、直接 Charles にお問い合わせください:\n\n' +
      contactBlock(locale) +
      '\n\nまた、彼のプロジェクト(Path、Plutus Trade、Product Playbook、House Ops、Job Ops)、職務経歴、AI の活用についてもお気軽にどうぞ。'
    )
  }
  return (
    "I couldn't find enough in Charles's portfolio to answer that accurately, " +
    "and I'd rather not guess. It's best to ask Charles directly:\n\n" +
    contactBlock(locale) +
    '\n\nOr ask about his projects (Path, Plutus Trade, Product Playbook, House Ops, Job Ops), work experience, or how he uses AI.'
  )
}
