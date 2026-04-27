// Translation policy: short witty PM-skill names floating in the universe
// section. The English originals lean on humor (e.g. "SELECT * FROM problems",
// "Fake it till you ship it"). Aim for Taiwan-PM voice — keep playful tone,
// keep code/SQL jokes verbatim, mix Chinese with the standard English PM
// vocabulary (PRD / bug / context / production) the same way Taiwan PMs
// actually talk.

export interface Skill {
  name: string
  color: 'white' | 'cyan' | 'gray'
}

export const skills: Skill[] = [
  { name: '先問 why，再問 what', color: 'cyan' },
  { name: '混亂中的 GPS', color: 'white' },
  { name: '專業地跟人類聊天', color: 'cyan' },
  { name: '把試算表變成決策', color: 'white' },
  { name: '為了少開會的會議', color: 'gray' },
  { name: '打造不睡覺的大腦', color: 'cyan' },
  { name: '用資料吵架，不用意見', color: 'white' },
  { name: '沒人讀的 50 頁 PRD（誤）', color: 'cyan' },
  { name: '量得到才出得了貨', color: 'gray' },
  { name: '專業放牧貓咪', color: 'white' },
  { name: '身為使用者，我希望少一點 bug', color: 'cyan' },
  { name: '裝到上線為止', color: 'white' },
  { name: '從 2019 年起讓按鈕更明顯', color: 'gray' },
  { name: '對機器低語', color: 'cyan' },
  { name: '教 AI 忘掉壞習慣', color: 'white' },
  { name: '把 AI 拉進 production', color: 'cyan' },
  { name: 'SELECT * FROM problems', color: 'gray' },
  { name: '讓產品自己賣自己', color: 'cyan' },
  { name: '出貨、修 bug、再出貨', color: 'white' },
  { name: '餵 AI 對的 context', color: 'cyan' },
  { name: '幫機器人改作業', color: 'white' },
  { name: '市場研究，但有策略地做', color: 'gray' },
  { name: '把 AI 接進所有東西', color: 'cyan' },
  { name: '把問題拆到不能再拆', color: 'white' },
  { name: '把所有點連起來', color: 'cyan' },
]
