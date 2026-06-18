// Translation policy mirrors src/i18n/strings/zh-TW.ts and the project's
// data files:
//   - Code identifiers, React APIs (useRef, IntersectionObserver,
//     React.lazy, Suspense), library names (React, Vite, Tailwind, GSAP,
//     Pixabay, Vercel, FastAPI), file paths (src/..., main.tsx,
//     vercel.json), CSS values (100vh, 100dvh, rgba()), browser APIs
//     (localStorage, hreflang, JSON-LD, Open Graph), and CSS class
//     fragments stay English.
//   - Section / UI markers that remain English in the live site
//     (Hero, About, Universe, Changelog, [ ABOUT ], CASE STUDY, IMPACT,
//     TECH STACK) keep the same form in titles for consistency with
//     what readers see on screen.
//   - Numerical values, units, file/byte sizes, durations are kept.
//   - Descriptive narrative prose is translated to Traditional Chinese.

export type ChangelogTag = 'feature' | 'design' | 'technical'

// A body is a list of blocks. A plain string renders as a paragraph; the
// object forms render as a sub-heading, a bullet list, or a stats grid.
// Inline `code` (backticks) and **bold** are supported inside any text.
export type ChangelogBlock =
  | string
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'stats'; items: { value: string; label: string }[] }

export interface ChangelogEntry {
  id: string
  date: string
  title: string
  body: ChangelogBlock[]
  tags: ChangelogTag[]
}

export const changelog: ChangelogEntry[] = [
  {
    id: 'rag-blog-fulltext',
    date: '2026-06-18',
    title: '讓 AI 聊天機器人讀得懂我的完整部落格文章',
    tags: ['feature', 'technical'],
    body: [
      '網站上的 AI 聊天機器人現在可以根據我部落格文章的全文回答問題,而不只是標題與摘要。在此之前,只有每篇文章的標題與副標被嵌入索引,所以「這篇文章到底在論述什麼」這類深入問題根本無從回答。新的匯入流程會抓取每篇文章的內文,切成段落,再和其他內容一起加入檢索索引。',
      { kind: 'heading', text: '更新內容' },
      {
        kind: 'list',
        items: [
          '**全文檢索**:抓取程式會從 Substack 與 Medium 取得每篇文章的內文,存進已納入版控的快取;這一步刻意與索引分離,讓重建索引時不必等待即時(且有速率限制)的抓取。',
          '**語言感知切塊**:一個零相依的遞迴切塊器把長文切成重疊的段落,同時處理中文(。!?)與英文的句子邊界。',
          '**原生多語**:文章以中文撰寫,但多語嵌入讓英文與日文的提問也能檢索到它們,於是更深入的答案在每一種語言都能浮現。',
        ],
      },
    ],
  },
  {
    id: 'enter-gate-loader',
    date: '2026-06-10',
    title: '重新設計進場 Loading 序列',
    tags: ['design', 'technical'],
    body: [
      '進入首頁人像前的啟動畫面，現在是一段有節奏的 loading 序列，取代了原本單行的百分比文字。黑色畫面中央是一枚發光翻轉的莫比烏斯環，下方輪播載入狀態文案，底部一條髮絲般的進度線從 0 掃到滿之後，Enter 控制項才登場。',
      { kind: 'heading', text: '改了什麼' },
      {
        kind: 'list',
        items: [
          '**即時繪製的莫比烏斯環**：載入符號是用小型 canvas 即時繪製的參數化莫比烏斯帶，在 retina 螢幕上依然銳利，也與背後人像的線框發光語言一致。',
          '**保證有故事的進度條**：顯示進度取「固定兩秒的掃描」與「真實下載進度」之間較慢的一方，快取秒開的造訪仍會讀到一段從容的抵達，網路慢時進度條也誠實。',
          '**分段交棒的轉場**：進度線跑滿後先發光停頓一拍，狀態文案與進度線一起淡出，ENTER 以純文字之姿在原位綻放，字距收斂、兩側髮絲線向外展開。滑過時字距張開、線條亮起，文字裹上一層層白色光暈。',
        ],
      },
    ],
  },
  {
    id: 'hero-webgl-portrait',
    date: '2026-06-09',
    title: '把首頁主視覺改成即時運算的 WebGL 人像',
    tags: ['feature', 'design', 'technical'],
    body: [
      '首頁的開場動畫現在是我本人臉孔的 3D 人像，用 three.js 與 WebGL 在瀏覽器裡即時運算，取代了舊版的 Canvas 2D 粒子主視覺。按下 Enter 後，一條掃描線會掃過臉部，把一片半色調點陣轉成打光的線框，再讓它還原，像機器在認出一個人之前先打量對方。現在上線的版本，是三天、七十多個 commit 淘汰出來的倖存者，繞過的彎路跟原本的計畫一樣，都形塑了最後的樣子。',
      { kind: 'heading', text: '這一路的過程' },
      {
        kind: 'list',
        items: [
          '**從一顆素體頭開始**：題目是把人像做成我自己的臉。幾何來自一個通用的 male_base 頭部模型，把照片烘焙上去、逐頂點取樣亮度，再把同一組幾何同時用三種方式渲染：點、線、帶陰影的網格。點陣負責神韻，線框負責結構，掃描線只決定你當下看到哪一種。',
          '**平面臉的彎路**：更早的嘗試是把照片直接三角化成 2.5D 的 Delaunay 浮雕。大部分時間都在跟它纏鬥：去背、濾掉蜘蛛網般的細長三角形、收緊輪廓，但鏡頭一轉，它看起來仍然像一張紙板剪影。砍掉它之後，素體頭加逐頂點烘焙就此定案。',
          '**凌晨兩點的怒容**：眼睛雷射的彩蛋原本設計成下顎張開的咆哮。修了五個 commit 的唇環收攏與下顎鉸鏈，嘴巴還是會把網格撕裂，於是凌晨兩點把咆哮換成緊閉著嘴的冷峻怒容，反而比咆哮更符合這顆頭的性格。',
          '**iOS 音效之戰**：光是雷射音效就花了十幾個 commit。它得無縫循環、得在靜音鍵開著時也出聲、得在點擊手勢之內完成解鎖，並在 Web Audio 與 HTMLAudio 之間來回切換，直到循環與 iOS 同時點頭。',
          '**從原型到產品**：定案的原型還得變成 React 元件：抽出有完整生命週期的引擎模組、追到 bloom pass 的 GPU 記憶體洩漏、加上 Enter 前導頁讓開場音效合法播放，接著是一長串行動裝置的修整：觸控跟捲動互搶、網址列收合造成的縮放跳動、小螢幕上變稀疏的塵埃場。',
        ],
      },
      { kind: 'heading', text: '你會看到什麼' },
      {
        kind: 'list',
        items: [
          '**由光點構成的臉**：人像由數千個點組成，每個點的亮度來自烘焙在 3D 表面上的照片，所以臉部隨著游標轉動時，神韻依然成立。',
          '**會變形的掃描**：移動的掃描線在經過之處把點陣轉成有陰影的線框，接著讓它沉澱還原，同一組幾何因此呈現兩種樣貌。',
          '**一些個性化的細節**：開場的紅色掃描、眼睛雷射的閃動，還有掃描結束後仍持續飄散、而非瞬間消失的細塵。',
        ],
      },
      { kind: 'heading', text: '它如何運算' },
      {
        kind: 'list',
        items: [
          '**一套管線，兩種樣貌**：點陣人像跑在 GPU 上，線框則在 CPU 端打光，兩者依掃描線位置混合，讓轉場保持平順。',
          '**懂得節制**：捲動離開畫面或分頁切到背景時會自動暫停，尊重使用者的 reduced-motion 偏好，WebGL 無法使用時則退回一張靜態照片。',
          '**輕觸即播的音效**：Enter 前導頁的存在，是為了讓開場音效與背景樂能在你選擇進入的當下開始播放，因為瀏覽器只允許在使用者手勢之後才播放聲音。',
        ],
      },
    ],
  },
  {
    id: 'rag-chatbot',
    date: '2026-05-31',
    title: '上線作品集 AI 聊天機器人',
    tags: ['feature', 'technical'],
    body: [
      '網站角落的「問這個作品集」按鈕，會開啟一個我從頭到尾親手設計與打造的聊天機器人。它能用英文、中文、日文回答關於我工作的問題，而且只根據我真實的作品集資料作答，所以不會亂編。我把它做成一件能實際運作的 AI 工程作品，整條 pipeline 的每一層都由我親手設計與打造。',
      { kind: 'heading', text: '它怎麼回答問題' },
      '它用的是 RAG（檢索增強生成）：先從我的作品集查出相關事實，再根據這些事實寫答案，讓每個回答都站在查到的證據上。我這套更進一步是「會自我修正」的 RAG，它會檢查自己給出的回答：',
      {
        kind: 'list',
        items: [
          '**會自我修正的流程**：建在 LangGraph 上，分成幾個步驟：先分類問題 → 搜尋相關內容 → 評估內容夠不夠好 → 寫出答案。如果評分不佳，它會把問題換個說法再搜一次；若還是找不到答案，就誠實說明，而不是用猜的。',
          '**混合搜尋（Qdrant）**：每個答案同時用兩種方式找：依「語意」（Voyage AI 的向量）和依「關鍵字」（BM25），再把結果合併、依相關性重新排序。這樣「他的產品理念是什麼？」這種模糊問題、和需要精準字詞的問題都接得住。（原本用 Supabase，撞到免費方案上限後改用 Qdrant。）',
          '**兩個語言模型、依成本分工**：由快又免費的模型（Gemini）先回答；只有當 Gemini 失敗時，才自動換成更強的付費模型（Claude）接手，讓訪客永遠不會看到錯誤。',
          '**關係圖**：一份我手工建立的小型關聯地圖（我 ↔ 角色 ↔ 專案 ↔ 工具），讓它能回答需要串連多個事實的問題，例如「哪些專案用了 Claude？」。',
        ],
      },
      { kind: 'heading', text: '刻意做得省錢：大多數問題根本不會用到付費模型' },
      {
        kind: 'list',
        items: [
          '**即時規則**：常見情況用簡單的文字比對處理，完全零 AI 成本：隱私問題（年齡、家庭、薪資…）會得到禮貌的「請直接聯繫 Charles」，打招呼與詢問聯絡方式則回固定答案。',
          '**答案快取**：大約 50 個常見問題都備好了預寫答案（三種語言都有）。當訪客問到相似的問題，就直接回傳對應答案，完全不呼叫任何語言模型。只有真正全新的問題才會走完整流程。',
          '**聰明分流**：評分器會分辨「能回答」、「跟我有關但作品集沒寫」、「離題」三種，所以離題問題（一般常識）一次就婉拒，不會反覆重試。',
        ],
      },
      { kind: 'heading', text: '安全：多層防禦惡意使用' },
      '公開的聊天機器人是「prompt injection（提示注入）」的攻擊目標：也就是誘騙它無視規則、或說出有害內容。我做了三層防禦：',
      {
        kind: 'list',
        items: [
          '**輸入檢查**：在任何 AI 運作前就攔下操弄手法：「忽略你的指令」、假的「開發者模式」、角色扮演／多重人格，以及把冒犯字眼藏進程式碼、編碼或填空遊戲裡的謎題。',
          '**鎖定範圍**：模型被要求把每一則訊息都當成純資料來讀、忽略其中夾帶的任何指令，並拒絕任何不是真正關於我的問題：即使被包裝成數學或文字遊戲。',
          '**輸出檢查**：最後一道過濾，無論被怎麼誘導，只要回答含有冒犯字眼就整段丟棄。',
          '**穩定性**：模型呼叫快速失敗、每次呼叫都有逾時限制、評分器不阻塞主流程，讓服務永遠不會卡住（先前在流量限制下偶爾會逾時）。',
        ],
      },
      { kind: 'heading', text: '如何保持正確又持續上線' },
      '聊天機器人的知識，是從渲染這個網站的同一批資料檔建立的，所以它永遠不會跟作品集實際寫的內容衝突。重新索引用一鍵式的 GitHub Action 執行，整套系統部署在 Vercel 上、與網站同源，並會像打字一樣逐字串流出每個答案。',
      '技術棧：LangGraph.js · LangChain.js · Qdrant · Voyage AI · Gemini · Claude · React · Vercel。',
    ],
  },
  {
    id: 'product-playbook-closed-loop',
    date: '2026-05-29',
    title: 'Product Playbook v1.2.12 — 閉環自我修正系統（Closed-Loop Self-Correction）',
    tags: ['feature', 'technical'],
    body: [
      'Product Playbook v1.2.12 把這個 skill 從「人工手搖」的迭代流程升級成**半自動閉環**：跑一個指令就能完成整圈循環，跑測試 → 找出失敗的規則 → 用 LLM 提出修改 → 同步到 5 個語言 → 衡量改進幅度 → 判斷是否收斂。',
      { kind: 'heading', text: '為什麼要做' },
      '這個 skill 是橫跨 6 個語言、含 22 個 PM 框架（JTBD、PR-FAQ、OST、Persona…）的外掛。過去每調一條規則，都得手動跑測試、看哪個 eval 退步、改檔案、把翻譯同步到 5 個語系、再跑一次確認，一輪 30–60 分鐘，而且很容易漏掉某個語言。更糟的是，沒有客觀指標告訴我「這次改動到底有沒有讓 skill 變好」。這次 iteration 把整套工作流變成程式碼。',
      { kind: 'heading', text: '新增的核心能力' },
      {
        kind: 'list',
        items: [
          '**`loop-tick` 編排器**：一個指令跑完整圈：debt-report（哪些 eval 失敗、權重多少）→ patch-proposer（LLM 提案 Hard Gate 修改，`--dry-run` 為預設）→ i18n-mirror-apply（同步到 5 個語言）→ drift-report（確認沒留下漂移）→ 寫一行 JSON 到 `loop-history.jsonl`。每一階段都記錄自己的耗時。',
          '**i18n 漂移偵測 + 自動翻譯**：`i18n-drift-report` 純 Python 比對英文原始檔和全部 5 個語系（規則數量、Hard Gate 數量、fear / anxiety / shame 等十個情緒詞）；`i18n-mirror-apply` 用 `claude -p` 把新增規則翻譯到 5 個語言。自動發現並修復了 30 對檔案的隱性漂移，包含一條從未被同步過的 canonical vocab 清單。',
          '**衡量改進的工具**：`eval-lift-report` 把「真正的硬性改進」和測試集變鬆造成的「假性改善（phantom lift）」分開；`attribution-check` 驗證「改了 A 檔案 → eval B 該翻轉」是否真的發生；`loop-summary` 跨多個 tick 判斷趨勢，給出 converged / improving / stalled / regressing / insufficient-data 五種裁決之一，並附上 ASCII sparkline。',
          '**安全閘門**：eval-freshness gate 在 eval 比最後一次規則修改還舊時直接拒跑；`suppress-pair` 標記某對 file/eval 正在手調、請自動化別碰；每個 LLM subprocess 現在都帶 timeout（過去單一 hang 就會燒掉 90 分鐘 CI）。',
          '**CI 三組守門**：`test-closed-loop.yml` 每個 PR 跑 77 個單元測試、`debt-check.yml` 列出這個 PR 預計影響哪些 eval、`i18n-drift-check.yml` 發現 critical 漂移就在 PR 留言。真正燒錢的 behavioural eval 改成 manual-only（之前自動跑會把訂閱 quota 燒光）。',
        ],
      },
      { kind: 'heading', text: '品質投資' },
      '橫跨 15 輪審查、4 個 commit 波次，抓出並修掉 25 個 bug，其中包括 `judge()` 在 history 缺 score 時 NoneType 相減崩潰、`--keep-last 0` 因為 Python 的 `lines[-0:]` 切到整份清單反而留下全部紀錄、以及 9 個沒指定 `encoding="utf-8"` 的 `read_text`/`write_text` 會讓 CI 的 i18n 字串 mojibake。現在有一條單元測試把 `scripts/_config.SEVERITY_WEIGHTS` 釘成等於 `evals/compute_eval_score.SEVERITY_WEIGHTS`，orchestrator 看到的分數再也不會默默偏離 eval 跑出來的。',
      {
        kind: 'stats',
        items: [
          { value: '23', label: 'commits / 20 小時' },
          { value: '76', label: 'files 變更' },
          { value: '+7,787 / −342', label: 'net lines' },
          { value: '77', label: '單元測試' },
          { value: '6', label: '支援語言' },
          { value: '0', label: 'CI LLM token 成本' },
        ],
      },
      { kind: 'heading', text: '學到的事' },
      {
        kind: 'list',
        items: [
          '**「半自動」比「全自動」現實得多**：每個 LLM stage 都默認 dry-run，下 `--apply` 才動真的；eval 永遠由人下指令，因為 CI 自動跑會把訂閱 quota 燒光。',
          '**每修一個 bug 就寫一個 unit test**：15 輪審查能持續挖出新問題，很大原因是測試把已修好的東西鎖住，讓我能放心改下一塊。',
          '**設定值集中化救命**：`_config.py` + env override 讓「在 CI 用較短 timeout」「在本地測試用 1 秒 timeout」一行設定就能搞定。',
          '**跨來源一致性要用測試強制**：orchestrator 的 `SEVERITY_WEIGHTS` 和 eval 的必須相等，否則兩邊分數會偏差；現在寫成一條 unit test 把它們鎖死，未來再也不會默默漂移。',
        ],
      },
    ],
  },
  {
    id: 'product-playbook-multi-agent',
    date: '2026-05-21',
    title: 'Product Playbook 升級 — Multi-Agent System 架構',
    tags: ['feature', 'technical'],
    body: [
      'Product Playbook v1.2 推出 3 位專家 Sub-agent（discovery-specialist、strategy-critic、pre-mortem-runner）。每位 Sub-agent 在獨立的 context window 中運作，只攜帶負責的框架知識，工具集嚴格限制為唯讀（Read / Grep / Glob / WebSearch），對於職責外的請求會回傳 `out_of_scope` 並指名正確承接者，再以 structured YAML 交給 main agent 整合。Iteration 5 的 A/B 評測顯示，Sub-agent 層在 Skill 基線之上額外貢獻 +40.9%（assertion 達成率從 59.1% 拉到 100%，兩個 arm 的 token 消耗都維持在約 152K 完全持平）。其中 pre-mortem-runner 是 load-bearing 元件，獨自承擔了 22.2% → 100% 的 +77.8% 跳升。/projects/product-playbook 的案例研究同步在 zh-TW / en / ja 三語系以 Multi-Agent 視角全面改寫。',
      'Detail page renderer 新增可選的 `features[]` 欄位（label + description），以 4 卡片 hero block 形式顯示在 subtitle 下方。[ 問題 ] / [ 方案 ] / [ IMPACT ] 段落會自動將 `label：content`（英文 `label: content` 也支援）解析為粗體 label 的 bullet row；[ 心得 ] 維持純散文渲染。label 內部出現 40.9% 這類小數點不會誤判。',
    ],
  },
  {
    id: 'job-ops-launch',
    date: '2026-05-14',
    title: 'Job Ops 加入 portfolio — 把 ATS 反向給求職者用的 Pipeline',
    tags: ['feature'],
    body: [
      '新增 Job Ops 作為第 5 個 side project。/projects/job-ops 案例介紹的是一條把 HR 端 ATS 邏輯反向指向職缺的 Python pipeline：macOS launchd 每天早上 7:00 觸發，httpx 串 104 search/detail API 抓職缺、CV-aware evaluator（cv_reader 解析履歷、對照 archetypes.yml 的候選人原型）逐筆加權評分，輸出 RECOMMEND / CAUTIOUS / SKIP 三段式日報，透過 Gmail SMTP 寄出 inline-styled HTML + Markdown 雙生本。互動層沿用 house-ops 的雙層架構，提供 7 個 Claude Code modes（cv-match、comp-research、legitimacy、level-strategy、interview-prep、personalization、role-summary）處理需要對話深度的判斷。',
      '首頁卡片動畫是 portfolio 新增的視覺語言。垂直字流落下真實 104 職缺片段（「Python」「資深」「90K」「遠端」「Senior」「5y」），y=150 處橫一條 mars 橘色 CV-MATCH 掃描線；當被 CV 標記過的 token 穿越掃描線時，字符會閃出 mars halo。掃描線下方的「07:00 DAILY DIGEST」面板逐列 materialize，總共 3 列（Senior AI PM 4.6 / Growth PM 3.8 / Junior Data PM 2.9），每列按評分分段呈現：RECOMMEND 是 mars 實心圓點、SKIP 則是更淡的白色。靜態 frame 凍結一個半空中的字雨加上完整的日報面板，讓卡片在沒 hover 的時候也能讀作完成態產品。',
    ],
  },
  {
    id: 'house-ops-fb-integration',
    date: '2026-05-07',
    title: 'House Ops 多源升級 — FB 公開社團 + Claude API 抽取',
    tags: ['feature', 'technical'],
    body: [
      'House Ops 上游從「只爬 591」拓展到「591 + Facebook 公開租屋社團」雙來源。FB 整合採用 Chrome DevTools Protocol 的 `Input.synthesizeScrollGesture` 合成觸控手勢做 pagination（Facebook 的 Graph API Groups endpoint 已於 2024-04 完全 deprecate）。FB 把合成手勢當實體 trackpad 滾動，因此繞過了 anti-bot lazy-load 偵測。專用 Chrome 實例由獨立的 launchd plist（com.house-ops.chrome-debug.plist）KeepAlive 起動，profile 與日常使用的 Chrome 隔離，cookie 在第一次手動登入後就持久化，後續重啟都不用再登入。FB 自由文字貼文交給 Claude API（Haiku 4.5）抽成 `{price_num, address, district, size, layout, contact, confidence}` 結構化欄位（每篇成本約 USD 0.001），與 591 物件一同進入五維加權評分流程，daily HTML 簡報多了 FB 物件分區。',
      'Portfolio /projects/house-ops 同步刷新：detail title 從「591 Data Automation」拓展為「Taiwan Housing Automation」反映多源範圍，Tech Stack 新增 Browser Automation（CDP）與 LLM Extraction（Claude API）兩列，Sources 改寫成「591 + Facebook 公開租屋社團」。互動 mode 列表加上 `upgrade plan`，把使用者情境從「租屋族 / 首購族」擴成「租屋族 / 首購族 / 換屋族」三類，learnings 補上 FB anti-bot 攻略歷程（純 JS scroll、agent-browser scroll、keyboard PageDown、CDP dispatchMouseEvent 全部失敗，最後靠 synthesized gesture 打通 pagination）。card tags 加入 `Claude API` 標示這次新增的 LLM 抽取能力。',
    ],
  },
  {
    id: 'path-demo-remotion-pipeline',
    date: '2026-05-06',
    title: 'Path 案例研究：30 秒 Remotion demo 影片',
    tags: ['feature', 'technical'],
    body: [
      'Path 詳情頁（/projects/path）加上一支 30 秒 autoplay loop demo 影片，是 Path 案例第一支影片，也是這個 repo 第一個 Remotion 渲出來的資產。影片 1404×1128 / 30fps，走過 9 個場景：行銷 hero 帶 brand 氛圍、四項功能格子搭 cyan stagger 高亮、儀表板 KPI 總覽（3 TRIPS · 24 DAYS · 491 KM）、我的行程卡片列表、單日 Day editor 的 drag-to-reorder（Day 4 被抬起、拖過去、落到新位置）、亞洲路線地圖（491 km）、費用詳情（NT$95,454）、AI 收據 OCR 掃描器、離線模式 banner 蓋在完整載入的 dashboard 上，最後收在 Path 字標 + mars-orange 放射光。',
      '技術上開了一個 /remotion/ workspace，跟 Vite app 分開。Composition 把 PathDemo 註冊在 1404×1128 / 30fps；場景檔用 Sequence + interpolate + spring 組 ken-burns pan、stagger 卡片脈動、crossfade。原本想用 Codex image_gen 產靜態插畫，但 codex exec 的非互動模式拿不到 image_gen tool，於是 pipeline 改走 Playwright 抓真實產品畫面（驅動既有已登入的 Path session、為離線場景切 navigator.onLine）。drag-to-reorder 段原本想直接錄影，但 Playwright MCP 沒有 video recording tool，最後改用 Playwright 抓 5 張 keyframe（靜止／抬起 + cyan border／拖拉中／懸停在新位置／落下）再交給 Remotion crossfade 接出連續動作的觀感。渲染輸出 5.6MB（CRF 26），放在 /assets/path-demo.mp4，沿用 projects.{en,ja,zh-TW}.ts 既有的 screenshot schema。',
    ],
  },
  {
    id: 'add-house-ops-personal-project',
    date: '2026-04-29',
    title: 'Personal Projects — 加入 House Ops',
    tags: ['feature'],
    body: [
      '把 House Ops 加進來，成為第四個 personal project：一條 Node.js（ESM）自動化管線，每天 09:00 透過 macOS launchd 掃描 591，把每筆租屋與買房物件依五個加權維度（價格合理度、空間與格局、地段機能、屋況、風險）打分，再用 nodemailer + Gmail SMTP 寄出 HTML 簡報。持久化 tracker 帶著每筆已評估物件走過 Scanned → Evaluated → Visit → Signed，再加上 Claude Code 互動層處理可負擔性試算、升級規劃、物件並排比較、看屋當天 checklist。',
      'House Ops 跟 Plutus Trade、Product Playbook 站在同一條軸線上：audience-of-one 的個人工具案例，技術選擇（launchd 排程、加權維度評分加三段決策、email 簡報交付）都從「真實的早晨流程怎麼用」往回推。頁面在 /projects/house-ops，附兩張 screenshot（每日簡報與單筆物件評估），三語都有完整 problem / solution / tech stack / impact / learnings 段落。',
    ],
  },
  {
    id: 'i18n-content-translation',
    date: '2026-04-28',
    title: '多語系內容 — 全量翻譯收尾',
    tags: ['feature'],
    body: [
      '把 i18n 架構原本留作英文 placeholder 的所有 locale 資料檔全部補完。/zh-TW/ 與 /ja/ 路由現在都是端到端的母語體驗：About 頁（Who I Am 段落、產品哲學 bullets、AI 工作流表、技能組合表）、experience 時間軸、三份案例研究（Path、Plutus Trade、Product Playbook）、universe section 飄浮的 skill names，以及 ~3,200 字的 changelog 本身：shader 工程、動畫重構、scroll restoration、GEO/SEO 策略、音訊系統等等都涵蓋進去。',
      '每份翻譯都遵守在檔頭明確寫下的政策。產品名（Path、Plutus Trade、Product Playbook、USPACE）、技術棧（React、Flutter、Supabase、FastAPI 等）、框架名（JTBD、RICE、OKRs、AARRR）、產業標準詞（B2B SaaS、builder、Product Builder、MaaS）、程式碼識別子、React/browser API（useRef、IntersectionObserver、localStorage、hreflang）、檔案路徑、CSS 值，以及英文 UI markers（[ ABOUT ]、CASE STUDY、IMPACT、TECH STACK）一律保留英文，符合台日 PM 實際的書寫習慣，硬翻反而拗口。描述句、problem/solution 段落、bullet 標題、技術敘事則翻成在地語言。',
      'Blog section 上，原文就是繁體中文的文章在 /zh-TW/ 維持原文標題與副標（與發文一致）。在 /ja/ 上，標題與副標都翻成日文作為「這篇繁中文章在講什麼」的描述，呼應日本科技部落格對外語來源做日文摘要的慣例，連結本身仍指向繁中原文 Substack/Medium。',
      '語氣上，日文用 です/ます 體對齊現有資料檔；繁體中文用台灣 PM 的口吻，自然中英夾雜在實際會這樣寫的技術 context 處。整個 portfolio 現在三個 locale 在每個頁面、每份資料檔都做完 i18n，無 TODO 殘留。對 canonical 英文 Strings interface 跑型別檢查通過，未來任何 locale 偏移都會在 build time 浮上來。',
    ],
  },
  {
    id: 'hero-easter-egg-mobile-polish',
    date: '2026-04-27',
    title: 'Hero — Easter Egg 手機版優化',
    tags: ['design', 'technical'],
    body: [
      '修了兩個傷害 easter-egg 肖像在手機上呈現的問題。第一，hero text、「click the logo 5 times」hint、SCROLL 指示器在 photo phase 仍維持滿不透明，肖像在較小 viewport 收斂後就被它們覆蓋。每個 overlay 現在各有自己的 ref，render-loop 內依 egg phase machine 做淡出：從 egg t=1.25s 到 t=1.55s（對齊 shader 的 photoHide）淡出，整個肖像期間維持隱藏，再在 reverse phase 開始的 0.15s 內淡回。肖像現在在每種螢幕尺寸都落在乾淨的舞台上。',
      '第二，肖像 sampler 原本只取邊緣：對來源 PNG 跑 4 方向 Laplacian，只留下輪廓、眼睛、眉毛、嘴唇邊線。手機上看起來像 hollow wireframe，臉部內部空缺，因為臉頰、額頭、頸部區域都是空的。加上稀疏的內部填充：照片區域內每 5 個 pixel 也以低 weight（6）進入 particle pool，排序後拿到最暗的粒子，強邊則仍然搶下最亮的粒子。臉在小尺寸下現在讀起來是飽滿的肖像，桌機尺寸下也沒失去定義輪廓的乾淨線條。',
    ],
  },
  {
    id: 'i18n-architecture',
    date: '2026-04-27',
    title: '多語系站點 — English / 繁中 / 日本語 架構',
    tags: ['feature', 'technical'],
    body: [
      '為 portfolio 加上 i18n 架構，可同時提供英文（root 預設）、繁體中文（/zh-TW/* 之下）、日文（/ja/* 之下）。英文入口維持 bare URL（沒有 /en/ 前綴），讓既有的入站連結與 SEO 仍落在搜尋引擎預期的位置。Locale 前綴分支共用同一份 route table，每個頁面（home、About、案例研究、changelog）都能在每個 locale 下對應到同一條路徑。Router 從 URL 前綴解析 locale；首訪不依瀏覽器語言自動偵測。',
      '不引入 i18n 函式庫。react-i18next 與 react-intl 帶來這個 site 用不到的功能（ICU formatting、複數規則、namespace lazy load），加上各約 50KB。改自製一層輕量元件：每個 locale 一份 typed strings dictionary（英文檔案定義 canonical Strings interface，zh-TW 與 ja 必須結構符合，缺漏 key 在 build time 即浮現）、useT() hook 從 active dictionary 取 dotted-path 字串並支援簡單 {{var}} 內插，加上 LocaleProvider 包住每個 locale 分支並把 `<html lang>` 與 active locale 同步。',
      'Per-locale 資料架構套用同樣的模式：每個內容檔（projects、changelog、experience、blog、skills）都拆成 .en.ts / .zh-TW.ts / .ja.ts 三份。Locale-aware loader（src/data/index.ts）對外提供 useProjects()、useChangelog() 等 hook，依當前 locale 回傳對應資料集，缺漏 entry 則 fallback 到英文。翻譯複本起初是英文 + TODO 標記，讓 site 馬上可上線、譯者也能漸進填上而不需動架構。',
      'SEO 表面現在 locale-aware。useDocumentMeta() helper 在每條路由上更新 document.title、meta[name=description]、canonical link，以及完整的 <link rel="alternate" hreflang>（en、zh-TW、ja、x-default）。hreflang URL 指向每個 locale 對應的同一條路徑，讓 Google、百度等 crawler 對不同 audience 呈現正確的版本。index.html 原本所有 hreflang 都指向同一個英文 root 的靜態宣告已經被取代。',
      'Persistence 是 opt-in 的。首訪不做瀏覽器語言自動偵測。Root 永遠 render 英文。但使用者按下語言切換器後，選擇會寫入 localStorage，回訪者會落在上次選的 locale（root 一次性 redirect 到 /zh-TW/ 或 /ja/）。切回英文時 redirect 會被清掉。',
      '在 nav 加上一組緊湊的 3 鍵語言切換器（桌機：CONTACT 按鈕旁的 pill group；手機：放在 hamburger menu 內，用 divider 隔開）。切換時保留當前 sub-path（/about → /zh-TW/about → /ja/about），使用者中途換語言不會被踢回首頁。',
    ],
  },
  {
    id: 'hero-easter-egg-braam-sfx',
    date: '2026-04-27',
    title: 'Hero — Easter Egg 電影級 Braam 音效',
    tags: ['feature', 'design'],
    body: [
      '為 easter-egg 序列配上電影預告片風格的 braam 音效。觸發時對音檔做 offset，讓它招牌的 50dB attack transient 剛好落在 COLLAPSE_END（egg elapsed ~0.80s）：奇異點達到最大壓縮、白色閃光點燃的瞬間。Braam 接著貫穿 flash 與 explode phase，粒子收斂成肖像，長尾迴響則延伸進 photo-hold 與 reverse phase。',
      '透過單一個延遲播放 `setTimeout` 串起來：音檔從 egg 觸發後 idle 0.49s，然後從 t=0 開始播，音檔開頭的靜音段恰好填滿 collapse 起始的張力，撞擊才落下。重用同一個 Audio element 跨多次觸發，由現有的 eggStartRef guard 把關重複觸發，元件 unmount 時暫停任何進行中的播放。音量上限 0.55，braam 讀起來是戲劇性的標點，不會壓過 ambient 配樂。',
    ],
  },
  {
    id: 'hero-easter-egg-cosmic-photo',
    date: '2026-04-27',
    title: 'Hero — 宇宙塵埃肖像粒子 & Easter Egg 細節',
    tags: ['feature', 'design', 'technical'],
    body: [
      '重做了 easter-egg 肖像 phase，讓組成照片的粒子呈現宇宙塵埃般的質感（取代先前的實心唸珠版本）。每顆粒子現在改畫成預先 render 好的 radial-gradient sprite（共用的暖白核心、根據 5 段亮度梯度上色的 halo），用 additive blending 合成，相鄰的 halo 重疊成連綿發光的織物。先前的版本則是堆疊成一顆顆獨立的點。約三分之一的粒子還會多畫一條短切線拖尾，暗示它們剛剛從 orbital ring 脫逃、正往肖像移動。',
      '把照片的色盤對齊 shader 的 lens-halo 光譜：brightness 0 對到火焰般的紅橘（暖氣絲），brightness 1 對到奶油白（lens 月牙核心），再加 12% 的青色點綴對應冷側氣體。肖像本身的明暗對比現在讀起來像溫度梯度（亮 pixel 像被引力透鏡聚焦的熱光，暗 pixel 像逐漸冷卻的吸積殘骸），宇宙底色與肖像視覺上共享同一組 colour DNA。',
      '在 easter egg 中加入真正的 shader 端引力塌縮。Shader 現在依 `u_eggCollapse` 套上徑向縮放與旋轉漩渦，collapse phase 中 lens 視覺上會塌陷而不只是變暗；reverse phase 中粒子發散回 orbital ring 時，shader 也會跑一段較小的二次塌縮。新增 `u_photoHide` uniform 在 photo phase 期間把整個 shader 淡到 0（explode 最後 0.35s 內逐漸升起，避免 lens 在收斂的肖像背後閃光，整個肖像期間維持為 0，reverse collapse 時再降下來）。',
      'Reverse phase 改回乾淨的線性發散：粒子用 `easeOutQuart` 直接飛回 orbital ring，不旋轉。早先的 CW 螺旋版讀起來像照片在「旋轉著解體」，感覺不自然；引力氛圍現在完全活在 shader 的二次塌縮裡，粒子單純發散重組。',
      '為了讓 3000 顆粒子的 ring 維持 60 fps：canvas DPR 上限現在是 1.5（在 Retina 螢幕上大約砍半 pixel work，肉眼看不出損失）；idle-orbit trail 的 stroke style 移到 per-frame 迴圈外（每幀省下數千次冗餘 state 切換）；trail render 門檻也提高，讓昏暗或慢的外角粒子完全跳過 stroke。Photo phase 的 shadowBlur 換成預 render 的 glow sprite，便宜約 3-4 倍，halo 也更乾淨。順手移掉了讓 hero 文案抖動的 mousemove text-repulsion。',
    ],
  },
  {
    id: 'hero-black-hole-shader-orbital-particles',
    date: '2026-04-27',
    title: 'Hero — 黑洞 Shader 與 Orbital 粒子系統',
    tags: ['feature', 'design', 'technical'],
    body: [
      '在 hero 粒子背後加上一支 WebGL fragment shader，render 黑洞風格的吸積盤：中央有亮起來的 lensing 月牙，柔和的氣體絲流動環繞。Shader 在自己的 canvas 上、貼在既有粒子環下層，hero 現在讀起來是分層的構圖（前景發光的 event horizon、後方流動的氣體、最上層的 orbiting 粒子）。先前的版本是一片扁平的粒子場。',
      '把先前波形調變、固定角度的粒子模型換成參考 msurguy blackhole 寫法的 Kepler 式軌道系統。每顆粒子真的繞中心旋轉，角速度依半徑而定（內圈快、外角慢漂），讀起來像差動旋轉。先前的觀感則是靜態的裝飾環。粒子數從原本窄帶內的 800 顆，提升到貫穿整條 viewport 對角線的 3000 顆，寬螢幕的角落不再空蕩。',
      '點擊與輕觸互動現在改用 spring-damper 物理模型：擊中時把鄰近粒子用初始徑向速度推開，重力再把它們拉回 base orbit，配上欠阻尼振盪讓它們略微越過再自然安頓。先前的行為則是硬性的線性 repel-and-snap。Shader 本身不再回應點擊；只有粒子環會。氣體底色保持中性，讓點擊回饋讀起來像對軌道的物理擾動，全螢幕「shakes」反應在這一版被拿掉。',
      'Konami easter egg 重做為 shader 與粒子環同步的 big-bang 序列。所有粒子向奇異點塌縮、中心爆出閃光、衝擊波向外漣漪、粒子炸開拼成 Charles 的肖像、停留片刻、最後溶解回 ring，shader 也從黑出淡回正常氣體。兩個元件聽同一個 `easter-egg` window event，phase 邊界（collapse 0.8s → flash 1.0s → explode 1.6s → photo 3.5s → reverse 5.0s）保持鎖在一起。',
      '一路上幾個小修：shader 分母奇異點（中心亮點、穿過 lens 的對角斜片）換成 epsilon-stabilised 形式；氣體旋轉改用指數飽和的 drift（取代原本的線性纏繞），noise 圖樣不會隨時間累積出長弧線；hero 文字加上分層黑色 text-shadow，輔助文案的不透明度也略提高，讓亮 lens 月牙穿過時仍可讀。',
    ],
  },
  {
    id: 'hero-mobile-vertical-centering',
    date: '2026-04-21',
    title: 'Hero Section — 手機垂直置中修正',
    tags: ['technical', 'design'],
    body: [
      'Hero 文字在手機上明顯坐在可見 viewport 中線下方。根因是 100vh：這個單位在手機瀏覽器代表「URL bar 收起」狀態下的 viewport（範圍比實際可見區域還大）。所以 section 比訪客真正能看到的還高，「100vh 中央」就落在視覺中心下方約 40-50px。底部的 SCROLL ↓ 指示器也因此被 URL bar 蓋住。',
      '改用 100dvh（dynamic viewport height），透過 supports-[] variant 應用：現代瀏覽器以實際可見區域決定 section 高度，不認得 dvh 的舊瀏覽器則 fallback 到 100vh。Canvas 早就以 section 的 clientHeight 做 resize，粒子動畫中心會自動跟著 layout 走，這邊不用再動。',
    ],
  },
  {
    id: 'ambient-audio-default-muted',
    date: '2026-04-19',
    title: 'Ambient Audio — 預設靜音啟動',
    tags: ['design'],
    body: [
      '翻轉了 ambient soundtrack 的啟動方式。第一版預設是 unmuted，試圖「偷渡」過瀏覽器的 autoplay block，等首次 click 或 scroll 來偷偷淡入。手法聰明，但不誠實：角落的喇叭 icon 從頭到尾顯示「sound on」，瀏覽器其實一直在悄悄擋播放。訪客根本不知道延遲是刻意的，沒 click 也沒 scroll 的人會永遠看到一個說謊的 icon。',
      '現在 icon 啟動時就是 muted 狀態，跟瀏覽器實際在做的事一致；音樂只在訪客主動點下喇叭時才開始。點擊本身就算成解鎖 autoplay 的 user gesture，一個動作同時授權與啟動淡入。沒有額外「enable audio」步驟，icon 也不再說謊。',
      '同時收緊了 localStorage 語意。按鈕仍會記住訪客的最後選擇，但預設狀態（若沒儲值、或儲值意外損毀）是 muted。上次主動 unmute 過的回訪者會再聽到音樂；其他人在主動要求前都是靜音。把音效當作 opt-in，這對 portfolio 才是對的預設。',
    ],
  },
  {
    id: 'ambient-space-audio',
    date: '2026-04-18',
    title: 'Ambient Space Audio — Interstellar 風格氛圍音景',
    tags: ['feature', 'design'],
    body: [
      '加上一段電影感的 ambient soundtrack，在訪客探索 site 時靜靜播放。參考是 Hans Zimmer 的 Interstellar 配樂：慢推進的 pad 與 sub bass，沒有節奏元素，待在體驗底層而不爭奪注意力。授權使用 Pixabay 一段 CC0 的 “Calm Space Music” 軌。',
      '瀏覽器 autoplay policy 會擋下任何沒經過互動就開始的有聲音訊。Chrome 和 Safari 多年來都很嚴格，這也是合理的。與其硬碰，player 等到第一個 pointer/keyboard/scroll/touch event，再以 1.8 秒把音量從 0 淡入到 0.35。轉場慢到讓音訊感覺一直就在那。',
      '一顆小小的 glassmorphic 靜音按鈕固定在右下角。點擊後音訊在 0.6 秒內淡出再暫停，並把偏好寫到 localStorage：靜音的訪客回訪後仍維持靜音。按鈕本身採 44×44 點擊區方便手機操作，hover 用 accent-cyan 對齊既有的 focus ring 風格。',
      '音訊 element 在 main.tsx 裡放在 router 之上，只實例化一次，所以 /、/about、/changelog、/projects/:id 之間導航時播放不中斷，沒有重新初始化，路由間也沒有空檔。',
    ],
  },
  {
    id: 'product-page-refresh-2026-04',
    date: '2026-04-18',
    title: 'Product Pages — Tech Stack 內容更新',
    tags: ['technical'],
    body: [
      '三份案例研究頁的 tech stack 表已經過時。產品本身在上線後仍持續演進，portfolio 也得跟上。',
      'Path 在 frontend stack 加上 PWA / Service Worker 層：offline-first 是面向使用者的承諾，背後支撐它的技術也應該被點到。Plutus Trade 的資料源從「FinMind API、Redis」擴張到還包含 Yahoo Finance API，提供國際報價搭配台灣特有的 FinMind 資料源。產品其實雙市場都涵蓋，只是頁面沒反映。',
      'Product Playbook 改寫幅度最大，直接從目前的 GitHub README 拉過來。發佈通路原本只列「npm、GitHub」，現已擴張到三條交付管道（Claude.ai Custom Skill、Claude Code Plugin、Claude Code Skill），分別在使用者工作流的不同位置相遇。文件處理 pipeline（Playwright 跑 Chromium PDF render、Pandoc 做格式轉換、pymupdf 純文字解析、Tesseract OCR fallback、pikepdf 處理 bookmark、Claude Vision 做語意解析）原本完全沒寫。Impact 段加上 6 種語言國際化、MIT license、+69% 品質提升的 benchmark。',
      '同時把 6 種執行模式換成它們在 production 真正的名字（Quick、Full、Revision、Custom、Build、Feature Expansion），取代頁面原本含糊的「from lightweight to comprehensive」描述。',
    ],
  },
  {
    id: 'footer-portaly-link',
    date: '2026-04-17',
    title: 'Footer — 加上 Portaly 連結',
    tags: ['feature'],
    body: [
      '在 Contact Footer 加上 Portaly（portaly.cc/charleschen）作為第四個社群連結，與 LinkedIn、GitHub、Threads 並列。Portaly 是主要的 link-in-bio hub，從 portfolio 露出可以收斂跨平台的存在感。',
      'Icon 用 Portaly 官方 brand mark（apple-touch-icon），本地處理過：去掉白底、貼緊 logo 邊緣裁切，在其他社群 icon 用的 20×20 尺寸下能乾淨呈現。',
    ],
  },
  {
    id: 'scroll-restoration-fix',
    date: '2026-04-15',
    title: 'Scroll Restoration — 修掉重新整理回不去的問題',
    tags: ['technical'],
    body: [
      '在任何捲動位置 refresh 都會跳到錯的 section，有時是 About，有時是頂端。根因是首頁每個 section 都用 React.lazy() 包 Suspense lazy load。',
      '瀏覽器的 scroll restoration 機制是：先存捲動位置，等頁面 render 完再還原。但有 Suspense 後，頁面會先 render 一個矮 fallback（單一 h-screen div），等所有 section 載完再展開到真實高度。等真實內容出現，瀏覽器早已對著錯的頁面高度嘗試還原，位置被夾擠回 0。',
      '修法很直接：移掉所有首頁 section 的 lazy()，改成直接 import。這些 section 訪客捲動時遲早會看見，lazy load 沒帶來實質效益，卻搞壞了 scroll restoration。Route 層級頁面（About、Changelog、案例研究）仍維持 lazy load，因為訪客不一定會點進去。',
      'Bundle 從 233KB 變 313KB（gzip 75KB → 102KB），但少了 7 個獨立 chunk request。對真實世界的載入時間幾乎沒差。一個大 request 在 HTTP round-trip overhead 下，常比多個小 request 還快。',
    ],
  },
  {
    id: 'responsive-layout-fixes',
    date: '2026-04-14',
    title: 'Responsive Layout — Hero 與 About 對齊',
    tags: ['design', 'technical'],
    body: [
      '修了兩個 layout 一致性問題。Hero section 文字容器是 max-w-[900px]，About 卻是 max-w-[1400px]，內容左緣會在 section 之間跳動。把 Hero 統一成同一個 max-w-[1400px] px-6 md:px-12 容器，h1 本身則上限 max-w-[900px] 維持舒適行寬。',
      'About section 在 md（768px）切成水平 layout，但側邊有標註的照片需要 ~728px 空間。在平板螢幕（768-1024px）上文字欄被擠到接近零寬。把水平 breakpoint 從 md 推到 lg（1024px），並加上響應式照片尺寸：lg 時 350×480，xl 時擴張到完整的 440×600。',
    ],
  },
  {
    id: 'blog-xai-redesign',
    date: '2026-04-13',
    title: 'Blog Section — xAI 風格文章列表',
    tags: ['feature', 'design'],
    body: [
      'Blog section 之前只放兩顆平台按鈕（Medium、Substack），沒文章標題、沒描述，對訪客或搜尋引擎都沒價值。重新設計成完整文章列表，靈感來自 xAI 的 news page layout。',
      '每篇文章現在以 row 顯示，含日期、標題、副標題、平台 tag、封面圖、READ 按鈕。封面圖以 background-size: cover 套在 16:10 容器內。沒封面圖的文章顯示一個淡化的平台 logo 作 fallback。Featured 文章（Uber L4 Offer）在日期旁有一個 mars 色 badge。',
      '副標題第一版是寫得很制式的一句話 summary。改用 Substack 的真實副標，說服力強很多。例如 CS153 那篇從「探討 AI 發展的真正限制與突破方向」改成「這堂被戲稱為「AI Coachella」的課，可能是目前全世界最搶手的一堂課。」',
      '排序把 featured 放前面，其餘依時間倒序。共 13 篇：Substack 7 篇有封面、Medium 6 篇。',
    ],
  },
  {
    id: 'case-study-pages',
    date: '2026-04-12',
    title: 'Case Study Pages — SEO Topic Cluster',
    tags: ['feature', 'technical'],
    body: [
      '在 /projects/path、/projects/plutus-trade、/projects/product-playbook 加上專屬案例研究頁。每頁有結構化區塊（Problem、Solution、Tech Stack、Impact、Learnings），配上正確的 meta title、description、動態 canonical URL。',
      '首頁的 project card 現在連到這些案例研究頁（先前則是直接導向外部 URL）。這在 SEO 上建出內部 topic cluster：首頁連到案例研究、案例研究互連回首頁，每頁針對不同 long-tail 關鍵字。',
      '同時新增一個獨立的 /about 頁，含完整職涯經歷、產品哲學（outcomes over outputs、strong opinions loosely held、strong product sense、build to learn）、AI 工作流拆解、技能組合，與一段帶 lang="zh-TW" 的中文簡介，給台灣搜尋流量。',
      '所有新頁面用動態 canonical URL 與結構化 meta tag。修掉 Google Search Console 把子頁面標記為「Alternate page with proper canonical tag」的問題：它們之前共用一條寫死的 root canonical。',
    ],
  },
  {
    id: 'geo-seo-optimization',
    date: '2026-04-11',
    title: 'GEO & SEO — 讓 AI 找得到 Portfolio',
    tags: ['feature', 'technical'],
    body: [
      '對人類來說 portfolio 看起來很好，對搜尋引擎與 AI 系統卻是隱形的。作為 React SPA，整個頁面 client-side render：不執行 JavaScript 的 crawler 看到的只是 <div id="root"></div>，其餘什麼都沒有。沒有 structured data、沒有 meta 策略、沒有 sitemap。',
      '第一層是機械工：加上 JSON-LD structured data（Person、FAQPage、ItemList schema）、Open Graph tag、Twitter Cards、canonical URL、author metadata、freshness signal（published/modified date）。建立 robots.txt 明確允許全部 14 種主要 AI crawler（GPTBot、ClaudeBot、PerplexityBot 等）、一份 sitemap.xml，與一份實驗性的 llms.txt 提供給 AI 直接消化。',
      '第二層解 SPA 可見性問題。在 <noscript> tag 內塞入完整的 HTML fallback：不執行 JS 的 crawler 拿到完整的語意內容，含正確的 H1/H2/H3 階層、成就列表、技能表、專案描述、FAQ section。React mount 後接管可見的 DOM，使用者永遠不會看到 fallback。一開始把 fallback 放在 #root 內，造成 React hydrate 前一閃 unstyled HTML，挪到 <noscript> 修掉了。',
      '第三層是關鍵字策略。GEO 審計顯示內容是以「我是誰」（品牌頁）的方式組織；搜尋頁應該以「我解決什麼問題」為核心。「AI Product Manager」搜尋量明顯高於「AI Product Builder」，但只出現 4 次 vs 19 次。重新平衡到 title、JSON-LD、noscript 標題、FAQ 內容裡共 15 次「AI Product Manager」。把地理訊號「Taiwan」放到關鍵位置。Title 從 name-first（「Charles Chen，AI Product Builder」）切成 keyword-first（「AI Product Manager | Charles Chen Portfolio」）。',
      '同時在 vercel.json 加上 X-Robots-Tag header、從 noscript fallback 內部連到 /changelog，以及一段針對 long-tail 關鍵字的新 FAQ：「how to become an AI product builder」、「AI product manager portfolio example」、「generative AI product case study」、「difference between AI PM and AI Product Builder」。',
    ],
  },
  {
    id: 'playbook-animation-fixes',
    date: '2026-04-09',
    title: 'Product Playbook — Connection Line 修正',
    tags: ['design', 'technical'],
    body: [
      '把框架 badge（JTBD、Persona、RICE、PRD）連到 SPEC.md 區塊的橘色 bezier 線，原本有三個問題。第一，在深底色上幾乎看不見：疊加 alpha 後實際 opacity 只有約 18%（globalAlpha 0.3 × marsA(0.6)）。把數值提到 0.55 與 0.9，實際可見度拉到約 50%。',
      '第二，每條線一個週期內動畫跑了兩次。根因是 lineProgress 計算裡的「peek-ahead」分支，在下一個 section 開始前就先把線預畫出來。Section index 推進時，sectionLocalProgress 重置為 0，整條線從畫好跳回空，再從頭跑一次。移掉 peek-ahead 分支，每條線剛好動畫一次。',
      '第三，Dev Handoff section（最後一個）一直沒顯示完成 checkmark。isComplete 條件是 si < activeSectionIndex，最後一個 section index 等於 activeSectionIndex 最大值，所以 3 < 3 永遠是 false。加上 progress >= 1 檢查處理最後一個 section。',
    ],
  },
  {
    id: 'changelog-page',
    date: '2026-04-09',
    title: 'Changelog — Building in Public',
    tags: ['feature', 'design'],
    body: [
      '新增獨立的 /changelog 頁，記錄這個 portfolio 每個部分背後的設計決策、技術迭代、與思考過程。靈感來自 Linear 的 changelog：乾淨單欄 layout、寬鬆的留白、自然的散文敘事（取代過往 bullet-point 形式的 changelog）。',
      '為此把原本單頁捲動的站點導入 React Router。首頁照舊運作：所有 section 維持垂直捲動、nav 行為不變。Changelog 活在自己的 URL，並對 Vercel 部署設正確的 SPA fallback。',
      'Nav 元件變得 route-aware：在首頁，section 按鈕仍捲動。在 changelog 頁，按鈕會 navigate 回 /#section，頁面載入後自動 scroll-to。Changelog 入口放在 footer：技術 metadata 旁的低調連結，留給想再深入的訪客。',
      '每篇 entry 寫成自然散文。目標是分享決策背後的「為什麼」：為什麼 About section 跑了 5 次背景動畫迭代、為什麼 Fibonacci 分佈解掉了 Universe 球面、為什麼卡片動畫需要完整的 state machine 生命週期。Release notes 的格式則是被取代的對象。',
    ],
  },
  {
    id: 'animation-module-extraction',
    date: '2026-04-09',
    title: '動畫架構重構',
    tags: ['technical'],
    body: [
      '三套卡片動畫系統長到單檔 1,240 行。每個動畫（Path 的 S 形 bezier 路線、Plutus Trade 的 K 線 ticker、Product Playbook 的 spec 組裝）都是自含系統，有自己的常數、state machine、draw function。它們只是剛好住在同一個檔。',
      '抽成各自的 module：pathAnimation.ts、plutusAnimation.ts、playbookAnimation.ts，加上一份 shared.ts 放共用工具。ProjectCards.tsx 從 1,240 行降到 593 行。',
      '同時把所有寫死的 rgba() 字串集中到兩個 helper（whiteA() 與 marsA()），整個 codebase 共做 56 處替換。重點色未來若改變，動一個常數即可，不用在 draw function 裡到處找。',
      'Playbook 動畫的 badge metric 計算之前是 module-level 的可變 cache。改成元件 scope 的 useRef，不再共享可變狀態。',
    ],
  },
  {
    id: 'product-playbook-card',
    date: '2026-04-08',
    title: 'Product Playbook — Spec 組裝動畫',
    tags: ['feature', 'design'],
    body: [
      '加上第三張側邊專案卡片：Product Playbook，一個 Claude Code 的 AI 驅動產品規劃 skill。動畫要視覺化它的核心概念：框架進去、完整 spec 出來。',
      '設計上左邊是四個框架 badge（JTBD、Persona、RICE、PRD），透過弧形 bezier 線連到右側文件。隨著每個段落填入（Overview、User Stories、Architecture、Dev Handoff），對應的框架 badge 以 accent-mars 脈衝亮起。',
      '文件內部，內容行漸進填入，附帶以約 0.6Hz 閃爍的打字 cursor。完成的段落會出現 checkmark。底部進度條用 easeInOutCubic，質感較先前的線性增長精緻。',
      '進場編排對第一印象很重要：badge 以淡入 + slide-up 交錯出場（120ms 間距），文件外框接著淡入。給動畫一個「揭幕」時刻，這是另外兩張卡一開始沒有的。',
      '經過多輪審查微調：把框架從 6 個減到 4 個，做出乾淨的 1:1 段落對映；連線從平直水平改成弧形；用分數插值平滑掉部分曲線端點。',
    ],
  },
  {
    id: 'mobile-card-autoplay',
    date: '2026-04-08',
    title: '手機自動播放卡片動畫',
    tags: ['feature', 'technical'],
    body: [
      'Canvas 卡片動畫原本由 onMouseEnter 與 onMouseLeave 觸發，觸控裝置永遠不會收到這兩個事件。在手機上，插畫永久凍結在靜態。',
      '修法用 matchMedia("(hover: none)") 偵測觸控裝置，改用 IntersectionObserver（threshold 0.3）作為替代觸發。卡片捲入畫面時動畫自動播放，捲出畫面時停止。',
      '桌機行為不變：動畫仍由 hover 觸發。',
    ],
  },
  {
    id: 'canvas-card-animations',
    date: '2026-04-07',
    title: '專案卡片的互動式 Canvas 動畫',
    tags: ['feature', 'design'],
    body: [
      '專案卡片原本掛靜態 SVG 插圖，通用、無生氣。三張全部換成互動式的 Canvas 2D 動畫，各自講自己專案的故事。',
      'Path 的動畫描繪一條 S 形 bezier 路線，附上發光的彗星拖尾。光點通過每個 waypoint 時，到達漣漪向外擴散，對應的行程卡（Day 1、Day 2、Day 3）依序亮起並打勾。整個循環跑：旅行 → 抵達端點停留 → 淡出 → 重置。',
      'Plutus Trade 顯示一個即時 K 線 ticker。多頭蠟燭以 accent-mars 發光、空頭蠟燭白色。新蠟燭從右側捲入，週期性的 surge 事件做出戲劇性的長蠟燭。交易日有自己的生命週期：8 秒交易 → 收盤減速 → 淡出 → 新一天。',
      '卡片 UI 本身受 xAI 啟發：銳利邊框搭配角落方塊裝飾、hover 漸層 overlay、輕微 scale transform。每個動畫只在 hover（桌機）或進入 viewport（手機）時跑，靜態狀態永遠顯示完整插畫的暗預覽。',
    ],
  },
  {
    id: 'nav-footer-cleanup',
    date: '2026-04-07',
    title: 'Navigation 與 Footer 細節',
    tags: ['design'],
    body: [
      '兩個小但重要的 layout 修正。手機 hamburger menu 原本排在 CONTACT 按鈕之前，挪到使用者預期的最右側。',
      'About section 有一個「Let\'s Connect」連結，跟 nav bar 的 CONTACT 按鈕重複。移掉。一個明確的 call-to-action 比兩個互搶好。',
    ],
  },
  {
    id: 'about-hero-photo',
    date: '2026-03-28',
    title: 'About Section — 帶成就標註的照片',
    tags: ['design'],
    body: [
      'About section 重新設計，主視覺是大張個人照搭配桌機版兩側的成就標註。照片用 CSS radial gradient mask 自然淡化邊緣融入深底，比嘗試程式去背乾淨許多。',
      '桌機 layout 把照片放中央，「7M+ Users Impacted」在左側，「0→1 B2B SaaS Launch」與「5x Faster with AI」在右側。手機上把照片堆在精簡的指標 row 上方。',
      '文案從制式介紹改成「What I bring to the table.」：直接、有自信，讓指標站在它旁邊一起說話。',
    ],
  },
  {
    id: 'universe-section-evolution',
    date: '2026-03-25',
    title: 'Universe Section — 3D 球面之路',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Skills section 的迭代次數比站上其他任何部分都多。從一個基礎 canvas 配散落的線開始，演化成完整的 3D 球面視覺。',
      '球面上線的分佈是最難的問題。隨機放看起來不平均。試過 grid-based 方法，看起來人工。最後落在 Fibonacci sphere 演算法（向日葵排種子用的同一套數學），分佈完美均勻。',
      'Render 順序在 3D 裡很重要：靠 viewer 近的粒子要畫在較遠的之上。實作了 z-sorted render，配上預先配置好的 sort array，避免每幀對 garbage collector 施壓。',
      '捲動驅動的文字擴張靈感來自 xAI 的視覺語言：技能標籤環繞球面，使用者捲動時向外移動，營造擴張與探索的感受。標籤自動在類別間循環，不讓初始視覺被資訊淹沒，又能呈現完整技能集。',
      '微調球面比例、線密度、粒子亮度、中央密集分佈，跨數十次 commit 才對齊到 xAI 的美學。',
    ],
  },
  {
    id: 'particle-hero-rings',
    date: '2026-03-22',
    title: 'ParticleHero — Ring 粒子系統',
    tags: ['feature', 'design'],
    body: [
      'Hero section 一開始用 Perlin noise flow field：粒子像有機水流般漂移。看起來還行，但通用。換成 Antigravity 風格的 ring 粒子演算法，粒子在同心圓上以柔和脈動環繞。',
      '在 hero 上點任何位置會產生 ripple 效果，向外傳遞穿過粒子。Ring 中心固定在螢幕中央，不跟隨點擊，維持構圖穩定，同時保有回應感。',
      '參數做了大量微調：脈動從 0.008 慢到 0.003 求低調，密度從 80×25 降到 40×15，避免壓過 hero 文字。',
      '這裡藏了一個 easter egg：快速點 logo 5 次會觸發粒子用邊緣偵測重組成個人照剪影。臉會依 viewport 尺寸縮放，桌機與手機上都讀得清楚。',
    ],
  },
  {
    id: 'about-neural-network',
    date: '2026-03-20',
    title: 'About Section — 背景動畫的演化',
    tags: ['design', 'technical'],
    body: [
      'About section 背景動畫快速迭代過。先是連線粒子、試過六角形節點（太忙碌），演化成「quantum neural network」概念，最後落在簡單的發光點以脈動線連接。',
      '最終實作 80 個一般節點與 10 個 hub 節點。Hub 較大、較亮、較慢移動，它們是網路裡的視覺錨點。藍紫色盤（#6BA3D6、#4E8FD4、#8B9FD6）選來呼應暖色 accent-mars 而不互搶。',
      '效能在 80 個節點下需要 O(n²) 距離檢查連線時是個顧慮。實作 spatial grid 把它降到 O(n)：每個節點只檢查鄰近的 grid cell。Grid 容器跨幀重用，避免 garbage collection 壓力。',
      '整個動畫在 section 捲出畫面時透過 IntersectionObserver 暫停。對沒人在看的東西燒 CPU 沒意義。',
    ],
  },
  {
    id: 'space-grotesk-typography',
    date: '2026-03-18',
    title: 'Space Grotesk — 字體基礎',
    tags: ['design'],
    body: [
      '從系統字體切到 Space Grotesk 作為主字。Space Grotesk 幾何但溫暖的個性對應 xAI 啟發的視覺語言：技術但平易近人。',
      '搭配 SF Mono 處理 section label、tag、技術 UI 元素的等寬字。Section header 統一成 [ SECTION ] 樣式，搭配 tracking-[2px]，這個小細節把整個站點扣在一起。',
    ],
  },
  {
    id: 'initial-launch',
    date: '2026-03-15',
    title: 'Portfolio 上線',
    tags: ['feature', 'design', 'technical'],
    body: [
      'charles-chen.com 首次上線。以 React 19、Vite、Tailwind 4、Canvas 2D 動畫打造。深色主題（#0A0A0A 背景配暖色 accent-mars #E8652B）就在這一刻定下來。',
      '色彩、邊框、字體的 design token 集中在 Tailwind 的 @theme directive：單一 source of truth。每個 section 用 React.lazy() lazy load，由 Vite 自動 code-split。',
      'Accessibility 從第一天就內建：skip-to-content 連結、focus-visible outline、prefers-reduced-motion 支援可關掉所有動畫，每個互動元素都有 ARIA label。View Transitions API 讓 section 之間導航有平滑 crossfade。',
    ],
  },
]
