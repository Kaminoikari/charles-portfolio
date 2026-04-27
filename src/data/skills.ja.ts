// Translation policy: short witty PM-skill names floating in the universe
// section. The English originals lean on humor (e.g. "SELECT * FROM problems",
// "Fake it till you ship it"). Aim for Japanese-PM voice — keep playful tone,
// keep code/SQL jokes verbatim, mix Japanese with the standard English PM
// vocabulary (PRD / bug / context / production / fake it / release) the same
// way Japanese tech PMs actually write.

export interface Skill {
  name: string
  color: 'white' | 'cyan' | 'gray'
}

export const skills: Skill[] = [
  { name: 'what より先に why', color: 'cyan' },
  { name: '混沌のための GPS', color: 'white' },
  { name: '人間とプロらしく話す', color: 'cyan' },
  { name: 'スプレッドシートを意思決定に変える', color: 'white' },
  { name: '会議を減らすための会議', color: 'gray' },
  { name: '眠らない頭脳を作る', color: 'cyan' },
  { name: '意見ではなく、データで議論する', color: 'white' },
  { name: '誰も読まない 50 ページの PRD（嘘です）', color: 'cyan' },
  { name: '測れるものはリリースされる', color: 'gray' },
  { name: 'プロの猫の放牧', color: 'white' },
  { name: 'ユーザーとして、bug を減らしたい', color: 'cyan' },
  { name: 'リリースするまで fake it', color: 'white' },
  { name: '2019 年からボタンを分かりやすく', color: 'gray' },
  { name: '機械にささやく', color: 'cyan' },
  { name: 'AI に悪い癖を忘れさせる', color: 'white' },
  { name: 'AI を production に押し込む', color: 'cyan' },
  { name: 'SELECT * FROM problems', color: 'gray' },
  { name: 'プロダクトに自分自身を売らせる', color: 'cyan' },
  { name: 'リリースして、直して、もう一度リリース', color: 'white' },
  { name: 'AI に正しい context を与える', color: 'cyan' },
  { name: 'ロボットの宿題を採点する', color: 'white' },
  { name: '市場調査、ただし戦略的に', color: 'gray' },
  { name: 'すべてに AI を差し込む', color: 'cyan' },
  { name: '問題を原子レベルまで分解する', color: 'white' },
  { name: 'すべての点を結びつける', color: 'cyan' },
]
