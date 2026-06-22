// Deterministic triage layer — runs BEFORE any embedding or LLM call, so the
// most common questions and the never-answerable ones cost $0 (no Voyage embed,
// no Qdrant query, no Gemini/Claude). This is the cheapest possible tier:
//
//   injection/jailbreak -> in-character refusal (checked FIRST; see section 0)
//   personal/privacy    -> polite redirect to Charles's contact channels
//   greeting/contact     -> canned answer
//   everything else      -> 'pass' (falls through to the RAG pipeline)
//
// Matching is pure regex on the raw question (case-insensitive). It is meant to
// be edited freely: add phrasings to the lists, or add new FAQ entries below.

import type { Locale } from './language.js'

// --- contact info -----------------------------------------------------------
// A curated contact list for the bot. It is a SUPERSET of src/data/social.ts:
// it intentionally adds Email and Substack (real, in-use channels) on top of the
// links the site footer renders (LinkedIn/GitHub/Threads/Portaly). Keep the
// shared links in sync with social.ts by hand.
export const CONTACT = {
  email: 'charlestyc0527@gmail.com',
  linkedin: 'https://www.linkedin.com/in/charles-chen-809a2043',
  github: 'https://github.com/Kaminoikari',
  threads: 'https://www.threads.com/@charles_tychen',
  substack: 'https://charlestychen.substack.com',
  portaly: 'https://portaly.cc/charleschen',
}

// Reusable contact block (markdown; the chat renderer linkifies it). Includes
// Threads + Substack for social reach, plus Portaly as the link-in-bio hub.
function contactBlock(locale: Locale): string {
  const email = `[${CONTACT.email}](mailto:${CONTACT.email})`
  if (locale === 'zh-TW') {
    return `* Email：${email}\n* [LinkedIn](${CONTACT.linkedin})\n* [Threads](${CONTACT.threads})\n* [Substack](${CONTACT.substack})\n* [所有連結 / Portaly](${CONTACT.portaly})`
  }
  if (locale === 'ja') {
    return `* メール：${email}\n* [LinkedIn](${CONTACT.linkedin})\n* [Threads](${CONTACT.threads})\n* [Substack](${CONTACT.substack})\n* [すべてのリンク / Portaly](${CONTACT.portaly})`
  }
  return `* Email: ${email}\n* [LinkedIn](${CONTACT.linkedin})\n* [Threads](${CONTACT.threads})\n* [Substack](${CONTACT.substack})\n* [All links / Portaly](${CONTACT.portaly})`
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
    'you\\s+are\\s+now\\b', 'pretend\\s+(to\\s+be|you)',
    'act\\s+as\\s+(if\\s+you|an?\\s+(ai|assistant|model|chatbot|bot|language\\s+model|dan|unrestricted|jailbroken|uncensored|unfiltered))\\b',
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
    // --- transform / decode / compute / spell-out class -------------------
    // These hide a forced output inside a "puzzle" (replace letters, run this
    // code, repeat a word N times, decode this). High-precision markers that
    // essentially never appear in a genuine question about Charles.
    'def\\s+\\w+\\s*\\(', 'print\\s*\\(', 'lambda\\b', 'slot_map', 'position_map',
    'run\\s+(this|the\\s+following|my)\\s+(code|script|python|program|function)',
    'execute\\s+(this|the\\s+following|my)\\s+(code|script|python|program|function|command|sql|query)',
    'evaluate\\s+(this|the\\s+following)\\b',
    'what\\s+(does|is|will)\\s+(this|the|that|my)\\s+(code|function|script|program|snippet|line|regex|expression)\\b.{0,12}(print|output|return|do|evaluate\\s+to)',
    '\\b(decode|encode)\\b\\s+(this|that|it|the\\s+(following|text|string|message|word|name)|following|in\\s+(base64|rot13|hex|binary)|[A-Za-z0-9+/]{12,}={0,2})',
    'base64', 'rot13', '\\bcipher\\b',
    'replace\\s+(all|every|each|the)\\b.{0,24}\\b(letter|letters|char|chars|character|characters|word|words|vowel|consonant|digit|occurrence|instance)\\b',
    'concatenate', 'spell\\s+(out|it)\\b.{0,20}\\b(word|words|name|letter|letters|answer|phrase)\\b',
    'repeat\\s+.{0,20}\\s+times', 'say\\s+.{0,30}\\s+times',
    // 中文(變換/解碼/執行)。變換類動詞只在帶「所有/全部/每個」或引號目標時才
    // 算攻擊(攻擊特徵:取代「所有」X、刪掉「第N個」),避免誤擋「用 AI 取代傳統工具」。
    '(說|講|唸|念|複誦|重複|重覆|輸出|印出|寫|列出|連寫|連打).{0,8}(\\d|一|二|兩|三|四|五|六|七|八|九|十|百|千|幾).{0,4}(次|遍|回|行|列)',
    '(代替|替換|取代|代換|換成|改成).{0,6}(字母|字元|英文字|大小寫|數字|符號|標點)',
    '(所有|全部|每[一個]).{0,8}(字母|字元|數字|符號|標點|字).{0,8}(代替|替換|取代|代換|換成|改成|刪|去|拿)',
    '(用|以)\\s*[「『"].{1,6}[」』"]\\s*(代替|替換|取代|代換|換成)',
    '(刪掉|刪除|去掉|拿掉|移除).{0,8}(字母|字元|空格|標點|符號|母音|第\\s*[\\d一二三四五六七八九十]|最後.{0,4}(字|個|字母|字元)|[「『"])',
    'print.{0,4}的?結果',
    '(解碼|編碼)\\s*(這|此|以下|下面|這串|這段|密文|字串|字符串|base64|二進制|十六進制)',
    '拼\\s*出.{0,6}(字|字母|名字|單字|詞|答案)', '組合.{0,6}(字母|字元)',
    // 進制/編碼:需搭配「轉換/字串/拼成」等情境才算攻擊,放行「binary
    // classification」「二進制分類」這類正當 ML 問題。裸編碼字串另由下方 octet/hex
    // pattern 攔截。
    '\\b(binary|hex|hexadecimal|ascii|base64)\\b\\s*(code|string|sequence|representation|encoding|encoded|art)?\\s*(of|for|to|into|from)\\b',
    '(convert|translate|turn|render|express|encode|decode|write|put|spell)\\s+.{0,30}\\b(binary|hex|hexadecimal|ascii|base64|morse)\\b',
    '(編碼|解碼|拼成|拼出|寫成|表示成).{0,4}(二進制|二進位|十六進制|十六進位|ascii|base64)',
    '[01]{8}[\\s,]+[01]{8}[\\s,]+[01]{8}', // 3+ 組 8-bit 二進制
    '[0-9a-f]{16,}', // 裸 hex 長序列(≥16 字元 = ~2-3 個 UTF-8 中文字的編碼)
    '(\\\\x[0-9a-fA-F]{2}){3,}', // \xNN\xNN... 跳脫序列
    // 角色扮演 / 多重人格 越獄
    '(多重|多個|\\d\\s*個|五個|多種)\\s*人格', '人格.{0,6}(主導|插嘴|衝突|切換|分裂)',
    '(切換|轉換|變成|化身)(成)?.{0,4}人格', '多重人格', '人格分裂',
    'split\\s+personalit', 'multiple\\s+personalit', '\\d+\\s+personas?\\b',
    '(翻譯|轉換|轉成|解讀|還原).{0,8}(二進制|二進位|十六進制|binary|hex|編碼|密文|這[串段])',
    '不要(有)?任何(標點|空格|符號)', '只.{0,6}(回答|輸出).{0,6}結果',
    // 日本語(変換/デコード)
    '(これ|この|以下|次の|base64|文字列|テキスト|メッセージ).{0,6}(を)?\\s*(デコード|エンコード)',
    '\\d+\\s*回.{0,8}繰り返', '(文字|単語|記号|アルファベット).{0,6}(を)?置(き)?換え',
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
    "If you'd like to get in touch, reach him directly:\n\n" +
    contactBlock(locale)
  )
}

// Keywords that mark a question as personal/private. Scripts are disjoint, so
// one case-insensitive union regex is safe. Edit freely.
const PERSONAL = new RegExp(
  [
    // English (word-boundaries to avoid false hits like "updating" / "single
    // source of truth"; "single" needs relationship context)
    'how old', 'his age', 'your age', 'birthday', 'born in',
    '\\bmarried\\b', 'marriage', '\\bwife\\b', '\\bhusband\\b', '\\bspouse\\b',
    '\\bgirlfriend\\b', '\\bboyfriend\\b', '\\bdating\\b',
    '(is|are)\\s+(he|you|charles)\\s+single', 'relationship status',
    '\\bkids\\b', '\\bchildren\\b', '\\bparents\\b', '\\bfamily\\b',
    'family background', 'personal life', '\\bsiblings\\b',
    '\\bsalary\\b', 'how much (do|does) (he|you|charles) (earn|make)', '\\bincome\\b',
    'where (do|does) (he|you|charles) live', 'home address', 'phone number',
    '\\breligio', '\\bpolitic',
    // education / schooling — alma mater, degree, where he studied. Private
    // background Charles fields himself (his domains aren't edtech, so bare
    // university/college rarely collides with a content question).
    'high school', '\\bgraduat', 'alma mater', '\\buniversity\\b', '\\bcollege\\b',
    '(which|what)\\s+school', 'where (did|does|do)?\\s*(he|you|charles)?\\s*(study|studied)',
    '(his|your)\\s+(degree|education|major)', '\\bdiploma\\b',
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
    // 學經歷（學校 / 學位 / 畢業）— 個人背景，導向本人
    '大學', '高中', '研究所', '碩士', '學士', '學歷', '畢業', '主修', '科系', '母校', '就讀',
    // 日本語
    '何歳', '年齢', '誕生日', '結婚', '既婚', '独身', '妻', '配偶', '彼女', '彼氏',
    '恋愛', '交際', '子供', '子ども', '両親', '家族構成', '家族', '家庭', '兄弟',
    '姉妹', '私生活', '給料', '年収', '収入',
    '住所', '電話番号', '宗教', '政治',
    // 学歴 / 学校
    '学歴', '大学', '高校', '卒業', '大学院', '専攻', '出身校', '学位',
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
      'zh-TW': '你可以直接透過這些方式聯繫 Charles：\n\n' + contactBlock('zh-TW'),
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
      '\n\n或者你也可以問問他的專案（Path、Plutus Trade、Product Playbook、House Ops、Job Ops）、工作經歷，或他如何運用 AI。'
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
