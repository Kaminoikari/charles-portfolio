// Charles's working reference on agentic design patterns. This is a curated
// knowledge source for the portfolio chatbot, not visible site UI: it lets the
// bot answer "does Charles know agentic design patterns / how does he apply X"
// from his real engineering practice. Every `howCharles` note is grounded in a
// system he has actually shipped (this corrective-RAG chatbot, the Product
// Playbook multi-agent system, his Claude Code / Codex builder workflows) or
// stated in measured terms where the tie is genuine but lighter — never invented.
//
// Pattern set and definitions follow Antonio Gulli's "Agentic Design Patterns"
// (the 21 core chapters). `name` keeps the English term across all locales;
// `body` is localized per file. The RAG ingest emits one chunk per pattern.

export interface AgentPattern {
  id: string
  name: string
  chapter: number
  body: string
}

// One-paragraph intro that frames the whole set as Charles's expertise.
export const agentPatternsIntro =
  'Agentic design patterns 是 Charles 身為 AI Product Builder 所倚賴的可重複使用建構模組。' +
  '以下筆記都立基於他親手開發並上線的系統，包含這個 corrective-RAG chatbot ' +
  '以及他的 Product Playbook multi-agent 系統。每個 pattern 都會說明它是什麼、何時該動用，' +
  '以及他在實務上如何運用。'

export const agentPatterns: AgentPattern[] = [
  {
    id: 'prompt-chaining',
    name: 'Prompt Chaining',
    chapter: 1,
    body: '把一個對單一 prompt 來說太大的任務，拆成一連串步驟，讓每一步的輸出餵給下一步，狀態也一路帶著走。Charles 在 Product Playbook 裡運用它，把 discovery、strategy、spec 各階段串成一條 pipeline，將一個模糊的點子轉成可執行的 PRD。',
  },
  {
    id: 'routing',
    name: 'Routing',
    chapter: 2,
    body: '讓 agent 對進來的請求做分類，把它導向正確的 workflow、tool 或 sub-agent。這是這個 chatbot 的骨幹：一層 deterministic 的 triage 在任何 model 呼叫之前就先處理掉問候、聯絡與注入嘗試，下游的 grader 再把每個問題導向回答、改寫或婉拒。',
  },
  {
    id: 'parallelization',
    name: 'Parallelization',
    chapter: 3,
    body: '同時跑彼此獨立的 sub-task，再把結果整合起來，整體耗時就只落在最慢的那個分支上，省去把每個分支時間逐一累加。Charles 在 Product Playbook 與他的 Claude Code workflow 中並行派發多個 sub-agent 或 framework pass 時，就會用到這個做法。',
  },
  {
    id: 'reflection',
    name: 'Reflection',
    chapter: 4,
    body: '讓 agent 對照目標去批判自己的草稿並修正，最理想的做法是另外用一個獨立的 critic agent 來保持客觀。這在 Charles 的作品裡出現兩次：chatbot 的 self-correcting loop 會為自己取回的 context 評分，不足時就改寫 query；Product Playbook 的 strategy-critic 與 pre-mortem-runner 則是專責的 critic agent。',
  },
  {
    id: 'tool-use',
    name: 'Tool Use (Function Calling)',
    chapter: 5,
    body: '給 model 結構化的 function，讓它能伸手越過自己的訓練資料、進到實際運作的系統裡，去查詢資料庫、呼叫 API 或執行程式碼。Charles 身為 AI Product Builder 高度倚賴這一點，他的 Claude Code 與 Codex agent 會呼叫真實的 tool 去建構並上線整個技術棧，而這個 chatbot 也是靠它去查詢 Qdrant 做 retrieval。',
  },
  {
    id: 'planning',
    name: 'Planning',
    chapter: 6,
    body: '讓 agent 在動手之前，先把一個複雜目標拆解成一組有順序的步驟或子目標。Charles 整個 Product Playbook 就是圍繞這點打造的：系統把一句話的點子轉成一份依序排列、可執行、附帶 acceptance criteria 的 PRD，外加一份 CLAUDE.md 與 TASKS.md，方便乾淨地交接給開發。',
  },
  {
    id: 'multi-agent-collaboration',
    name: 'Multi-Agent Collaboration',
    chapter: 7,
    body: '把一個問題拆給多個各有專精的 agent，每個都在自己的 context 裡運作，再協調它們朝同一個成果前進。這是 Product Playbook 的招牌 pattern：三位專家 discovery-specialist、strategy-critic 與 pre-mortem-runner 各自在獨立的 context window 裡運作，由一個 main agent 整合它們結構化的輸出。',
  },
  {
    id: 'memory-management',
    name: 'Memory Management',
    chapter: 8,
    body: '保留短期的對話狀態與較長期的知識，讓 agent 在多輪對話與多個任務之間都能維持連貫。Charles 在他的 agent build 裡把 context 當成一種要被妥善管理的資源，會去界定每個 sub-agent 看得到什麼，好讓工作維持在事實基礎上，避免 context 變大後逐漸偏離。',
  },
  {
    id: 'learning-and-adaptation',
    name: 'Learning and Adaptation',
    chapter: 9,
    body: '讓 agent 能從經驗中改進，或去適應一個會變動的環境，持續演進，不會停在原地不動。Charles 透過 eval-driven 的迭代來處理這件事：他量測行為，把發現回饋進 prompt 與架構，每一輪都把系統收得更緊。',
  },
  {
    id: 'model-context-protocol',
    name: 'Model Context Protocol (MCP)',
    chapter: 10,
    body: '一套標準介面，讓 agent 能去發現並呼叫外部的 tool 與資料來源，不必為每個整合各寫一套膠水程式。Charles 在他的 Claude Code workflow 裡操作 MCP server，把 agent 接上它們需要的 tool 與資料，讓能力得以擴展，不必重寫底層管線。',
  },
  {
    id: 'goal-setting-and-monitoring',
    name: 'Goal Setting and Monitoring',
    chapter: 11,
    body: '給 agent 一個明確的目標，外加追蹤進度用的 metric，讓 autonomy 維持可問責。Charles 把這點落實成 Product Playbook 裡的 acceptance criteria，以及產品工作裡的 OKR 式目標，讓怎樣才算完成在一開始就定義清楚而且可量測。',
  },
  {
    id: 'exception-handling-and-recovery',
    name: 'Exception Handling and Recovery',
    chapter: 12,
    body: '假設 tool 會壞、網路會斷、輸入會出乎意料，然後就此建好 retry、fallback 與優雅降級。Charles 的 chatbot 正是這樣設計的：太慢的 grader 會降級成直接把 context 放行，免費的 Gemini tier 一旦失敗就 fallback 到 Claude，讓一個暫時性的錯誤不會變成死路。',
  },
  {
    id: 'human-in-the-loop',
    name: 'Human-in-the-Loop',
    chapter: 13,
    body: '在錯誤代價高昂的環節插入人工審查或核准，讓人始終留在關鍵路徑上。Charles 在他的 AI Product Builder loop 裡就扮演那個人，在任何東西上線之前，審查並引導 Claude Code 與 Codex 產出的成果。',
  },
  {
    id: 'knowledge-retrieval-rag',
    name: 'Knowledge Retrieval (RAG)',
    chapter: 14,
    body: '把答案立基在 model 從未訓練過的外部、最新或私有資料上，好產出可驗證、有事實根據的輸出。這個 chatbot 就是 Charles 自己的 RAG 系統：在 Qdrant 上做 hybrid retrieval，把 dense 的 Voyage embedding 與 BM25 sparse 透過 reciprocal rank fusion 融合，再經過 cross-encoder rerank，最後才做附帶 citation 的 grounded generation。',
  },
  {
    id: 'inter-agent-communication',
    name: 'Inter-Agent Communication (A2A)',
    chapter: 15,
    body: '定義 agent 之間如何交換請求與結果，讓各自獨立打造的專家也能協作。在 Product Playbook 裡，sub-agent 會回傳結構化的 YAML 給 main agent 消化，這是一份有型別的契約，讓 multi-agent 的交接維持可靠。',
  },
  {
    id: 'resource-aware-optimization',
    name: 'Resource-Aware Optimization',
    chapter: 16,
    body: '有意識地花用運算、延遲與金錢，挑出仍能達標的最便宜路徑。Charles 把這個 chatbot 設計成一條控制成本的 cascade：deterministic 的 triage 與語意式的 FAQ cache 不必呼叫 model 就能回答常見問題，generation 則先跑免費 tier，只有在必要時才為更強的 model 付費。',
  },
  {
    id: 'reasoning-techniques',
    name: 'Reasoning Techniques',
    chapter: 17,
    body: '當一個問題需要拆解與看得見的中間步驟時，運用 chain-of-thought、ReAct 或 tree-of-thought 這類結構化推理。Charles 在那些通往答案的路徑和答案本身一樣重要的 agent build 裡會動用這些技巧，並把推理與 tool 呼叫搭配在一起，讓每一步都站在事實基礎上。',
  },
  {
    id: 'guardrails-safety',
    name: 'Guardrails/Safety Patterns',
    chapter: 18,
    body: '約束一個 agent 會接受什麼、會輸出什麼，對輸入與輸出都做驗證，讓它維持安全且不離題。Charles 把這點層層疊進 chatbot：一個 prompt-injection deflector、一道把所有輸入都當成資料看待的嚴格 scope-lock，以及一個 output backstop，寧可丟掉一個答案也不讓任何冒犯內容浮上檯面。',
  },
  {
    id: 'evaluation-and-monitoring',
    name: 'Evaluation and Monitoring',
    chapter: 19,
    body: '在 production 裡量測品質並比較不同版本，讓每一次改進都由證據來驅動，憑數據說話，不靠感覺。Charles 為這個 chatbot 打造了一套 eval harness，含一組 golden question set、一個 LLM judge 與多項 metric，並透過 chat-log insights 追蹤線上的實際使用狀況。',
  },
  {
    id: 'prioritization',
    name: 'Prioritization',
    chapter: 20,
    body: '在真實限制下為彼此競爭的任務或目標排序，讓系統把力氣花在最要緊的地方。Charles 運用像 RICE 這樣的 prioritization framework，既用在他的產品工作裡，也用在 Product Playbook 決定先做什麼的排序方式上，他也用同一套東西去指導 mentee。',
  },
  {
    id: 'exploration-and-discovery',
    name: 'Exploration and Discovery',
    chapter: 21,
    body: '在開放式的問題空間裡運作，靠著不斷生成並驗證假設來推進，不被一份固定計畫綁住。Charles 把這點內建進 Product Playbook 的 discovery-specialist，以及他 opportunity-framing 的實務裡，在決定要投入哪個解法之前，先去探查問題空間。',
  },
]
