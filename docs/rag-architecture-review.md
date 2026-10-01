# Portfolio RAG — 架構評審

> 對 `rag/` + `api/chat.ts` 的一次完整架構評審與評分。
> 評審日期：2026-09-15。評審基準 commit：`ceafc7a`。
>
> 姊妹文件：[設計文件](./rag-chatbot-design.md)（架構本身）·
> [改進路線圖](./portfolio-rag-roadmap.md)（要做什麼）·
> [ablation 報告](./rag-ablation-report.md)（檢索層數據）·
> [contextual retrieval A/B](../rag/evals/contextual-retrieval-ab.md)（一次負面結果的決策記錄）
>
> 本文與路線圖的分工：路線圖談「下一步做什麼」，本文談「現在這套值幾分、
> 風險排在哪裡」。兩者結論不衝突時以路線圖為執行依據。

## 1. 評審方法與範圍

- **讀過的範圍**：`rag/` 全部 72 個檔案、`api/chat.ts`、`api/geo.ts`、
  `src/components/chat/useChatStream.ts`、`.github/workflows/rag-*.yml` 與
  `chat-insights.yml`、`vercel.json`、`docs/` 既有四份 RAG 文件。
- **沒有做的事**：沒有跑 eval、沒有連線生產 Qdrant、沒有實測延遲。
  所有數字均引自 repo 內既有報告（最後一次 ablation：2026-06-19）或程式碼本身。
- **評分基準**：拿業界公開的 RAG 工程實踐當尺，而非拿「portfolio 專案」
  的標準放寬。扣分項一律附可驗證的檔案位置。

## 2. 總評

| 評分視角 | 分數 |
|---|---|
| 作為 portfolio 技術展示品（專案自己宣告的目標） | **9.5 / 10** |
| 作為生產級 RAG 系統（一般工程標準） | **8.6 / 10** |
| 作為可規模化到企業語料的架構 | **6.5 / 10**（適用範圍描述，非扣分，見 §6） |

一句話總結：**檢索與成本兩層已達業界水準以上，失效設計的成熟度超出這個
規模該有的程度；風險集中在「唯一沒有 grounding 檢查的那條路徑」與
「檢索層沒有任何備援」這兩處，而兩者的修補成本都極低。**

## 3. 分項評分

| 面向 | 分數 | 依據 |
|---|---|---|
| 檢索架構 | **9.5** | hybrid dense+sparse、伺服器端 RRF、cross-encoder rerank、asymmetric embedding、parent/child chunking、locale payload index — 業界 baseline 一項不缺。且是原生打 Qdrant Query API 拿伺服器端融合（`rag/retrieval.ts`），不是包一層 LangChain retriever 抽象了事 |
| 編排與控制流 | **9.0** | CRAG 三方裁決而非二元（`rag/nodes.ts:gradeDocuments`）、off-topic 直接跳過 rewrite 迴圈（`rag/graph.ts:routeAfterGrade`）、gated decompose fan-out、condense-question 記憶、converse 分支。每個節點都有明確的 degrade 路徑 |
| 成本工程 | **10** | 全案最強。regex triage ($0) → 語意 FAQ cache ($0) → Gemini 免費層 → Claude backstop；decompose 有便宜 heuristic 閘門；ingest 用 content-hash 增量（`rag/ingest/reconcile.ts`）。成本控制是設計出來的，不是事後省出來的 |
| 失效設計 | **9.5** | `rag/llm.ts` 的 first-token gate：fallback 只允許發生在「畫面上還沒有字」的時候，一旦 commit 就寧可回 partial。且 `stalled` 旗標一路傳到 chat_logs — 因為 partial answer 下一輪會變成 history，模型會讀到自己沒寫完的句子。這種二階效應被想到並寫成程式碼 |
| 評估體系 | **9.0** | golden set + ablation arms + recall@k/MRR/correctness + LLM judge。最加分的是願意 ship 一個負面結果：contextual retrieval 做完 A/B 得到 production arm 只 +0.003 MRR，於是不上線、留在 flag 後面、寫下決策記錄與重啟條件 |
| 工程紀律 | **9.0** | `rag/` 23 個測試檔 / 254 個 test case；純函式與 I/O 分離（metrics、reconcile、chunk 全可離線單測）；依賴可注入（`resolveTiers` / `resolveGenerator` 還特地防了 LangGraph 傳 RunnableConfig 進來的誤植）；config 全部集中且 env-overridable |
| 安全 | **8.0** | 三層注入防禦 + 輸出端過濾 + citation/link 剝除 + 輸入上限 + 區域封鎖（API 層也擋，不只 widget）。對單租戶公開 bot 足夠 |
| 可觀測性 | **8.0** | LangSmith 選配 + 自建 chat_logs BI（route/loops/latency/country）+ 前端即時 pipeline trace。自建那套其實比掛 LangSmith 更貼合這個產品 |
| 韌性（可用性） | **6.5** | 見 §4.2 |
| 維運可持續性 | **6.0** | 見 §4.5 |

## 4. 扣分項（依實際風險排序）

### 4.1 FAQ cache 是全管線唯一「無 grounding 檢查就直達使用者」的路徑

**風險等級：高（正確性）**

`rag/qdrant.ts:faqLookup` 的行為是：dense-only、`limit: 1`、單一全域閾值
`config.faqCacheThreshold = 0.7`、命中即 return，**不經 grade、不經 generate、
不帶 sources**。

問題在於語料的語意密度：755 個 paraphrase 覆蓋 52 個主題，其中大量問題結構
同構而事實不同（「他在 USPACE 做什麼」vs「他在 NUEIP 做什麼」對 embedding
而言幾乎是同一個向量方向）。一次誤命中等於一個**自信、流暢、完全錯誤、
且無來源可供訪客察覺**的答案。0.7 cosine 對 `voyage-3-large` 並不是保守門檻。

**建議修補**：`limit: 2` 並加 margin check — `top1.score - top2.score > δ`
才採信。兩者都高且接近，代表問題落在兩個 FAQ 主題之間，正是最該 fall
through 到 RAG 的情況。這比單純調高閾值精準，因為它擋的是「像但不是」
而不是「不夠像」。

### 4.2 檢索層是單點故障，且與 LLM 層的精緻度嚴重不對稱

**風險等級：高（可用性）**

LLM 層做了雙供應商、雙層 timeout、first-token gate、逐節點 degrade。
檢索層則是：**Voyage 同時是 embedding 與 rerank 的唯一供應商，單次請求
（`AbortSignal.timeout(10s)`）失敗即失敗，無重試、無備援、無快取。**

Voyage 中斷時的實際行為：

1. `triage` 的 FAQ probe 失敗 → 有 catch，fall through ✅
2. `retrieve` 的單一查詢路徑 **沒有 catch**（`rag/nodes.ts:retrieve` 只在
   多子問題 fan-out 分支有 `.catch`）→ 例外冒到 `streamAnswer`
3. → `api/chat.ts` 的 catch → 一句通用 SSE error

結果是整個 bot 退化到只剩 regex triage 能回答。

**建議修補**：`retrieveWith` **已經內建降級路徑** — `cfg.rerank = false`
就是純 RRF 排序。差的只是一個 try/catch：rerank 失敗時降級為 RRF 而不是
讓整條請求失敗。這是全案投報率最高的一處修改。

同理，query embedding 加一個記憶體 LRU 也幾乎零成本：同一個問題目前在
`triage`（FAQ probe）與 `retrieve` 各 embed 一次，而重複問題是這個產品的
常態。

### 4.3 Golden set 已飽和，eval 失去鑑別力

**風險等級：中（決策品質）**

`dense-only` arm 就已達 100% recall@k（見 ablation 報告）。這代表**這個
benchmark 已經無法區分任何檢索改進**。contextual retrieval A/B 的 +0.003
結論有可能只是被天花板遮住 —— A/B 文件自己誠實寫了這點（"Recall is at the
ceiling... not discriminating enough"），這是加分項，但問題本身還在。

29 題 × 3 locale 對 960 chunks 偏少，且缺 hard negatives。目前的 eval 能證明
「沒退步」，不能指引「怎麼進步」。

**建議修補**：題目往需要精確數字、跨 chunk 對比、時序推理、以及**刻意設計的
近似誘答**（同結構不同事實的配對題）上走。後者同時能替 §4.1 的 FAQ 誤命中
建立量測基準 —— 兩個問題可以用同一批新題目一起解決。

### 4.4 有 eval harness，但 eval 沒有在守門

**風險等級：中（回歸防護）**

四支 workflow 全是 `workflow_dispatch`。而 `rag-ingest.yml` **有 push-to-main
自動觸發** —— 意思是：改一行 `src/data/projects.zh-TW.ts` 會自動重建生產索引、
改變生產檢索行為，**中間沒有任何自動評估把關**。

此外 repo 內沒有跑 `npm test` / `npm run lint` 的 PR CI，也就是說那 254 個
rag 測試 + 25 個前端測試檔目前**沒有自動執行者**。

「建了 eval」與「eval 真的擋得住回歸」之間差的就是這一步。

**建議修補**：(a) 一支 PR CI 跑 `npm run rag:test` + `npm test` + `npm run lint`
（全部離線、不需 secrets）；(b) ingest 自動重建後串一次 `--retrieval-only`
的 eval，recall 掉出門檻就告警。

### 4.5 手工同步面沒有任何測試釘住 —— 最可能長期產生「自信說錯話」的來源

**風險等級：中（正確性，隨時間累積）**

以下四處全為手寫，且註解多處明載 *keep in sync by hand*：

| 檔案 | 內容 | 風險 |
|---|---|---|
| `rag/portfolio-map.ts` | 全語料壓縮總覽，**每次 generate 無條件注入** | 過期即成為凌駕檢索結果之上的錯誤事實源 |
| `rag/entities/relations.json` | 實體關聯圖 | 關聯過期導致多跳推理錯誤 |
| `rag/faq-cache.ts` | 789 行手寫答案，含具體數字 | 與 §4.1 疊加：錯誤答案 + 無檢查路徑 |
| `rag/triage.ts:CONTACT` | 聯絡方式（`src/data/social.ts` 的超集） | 影響較小 |

已查證：**沒有任何測試把 `portfolioMap` 或 `relations.json` 對回
`src/data`**（`rag/faq-audit.test.ts` 檢查的是 persona 覆蓋與主題存在性，
不是與語料的數字一致性）。

`rag-ingest.yml` 會在語料變更時重建索引，但**不會發現 portfolio-map 裡的
數字已經過期**。考慮到這個專案連 prose-lint 那種細節都寫成了機器檢查
（`rag/prose-lint.ts`），這裡的空缺特別突兀。

### 4.6 RateLimiter 在 serverless 上實質無效

**風險等級：低（此流量規模下）**

`rag/api-helpers.ts:RateLimiter` 是 per-instance in-memory `Map`：實際上限
= 20 × warm instance 數，instance 回收即歸零（程式碼註解自承要換 Upstash）。
另外 `hits` Map 沒有淘汰機制，冷門 key 在單一 instance 生命週期內只增不減。

以目前流量無所謂，但在「這是給 recruiter 看的生產工程展示」的框架下，
這是會被問到的點 —— **而程式碼已經誠實註解了限制，這比假裝沒問題好**。

## 5. 一個需要澄清的「非缺陷」

評審過程中一度將 **locale 硬過濾切斷跨語檢索** 列為弱點：
`rag/retrieval.ts:localeFilter` 的 `must: locale == 語言偵測結果`，等於主動
放棄 multilingual embedding 的跨語能力。

查證後推翻：`rag/ingest/extract.ts:blogChunks` 對**每個 locale 都存了一份
相同的中文 body**（部落格原文為繁中），所以 en/ja 查詢確實撈得到中文文章。

這不是缺陷，是**用 3 倍儲存換取過濾正確性**的取捨 —— 在 Qdrant 免費層的
規模下完全划算。記錄於此是因為它值得在面試時主動講：那是個好答案。

## 6. 為什麼「企業規模」只給 6.5，而這不是批評

架構中有數個選擇在 960 chunks 下是最優解，但**不隨語料量延伸**：

- 手寫 FAQ cache（789 行）
- 手維護 entity graph
- 手寫 portfolio-map
- `scrollHashes` 全量對帳（每次 ingest 掃全表）
- entity graph 無 ACL 概念

而 `portfolio-rag-roadmap.md` 開頭已經寫了這件事 —— 明確標示 per-user ACL
與 GraphRAG「**不適用於此，不做 cargo-cult**」。

**知道哪些企業級實踐不該套用，本身就是比全部照做更高階的判斷。**
因此 6.5 是適用範圍的描述，不是扣分。

## 7. 建議優先序

若只做三件事，按風險排序：

1. **rerank 失敗降級為純 RRF**（一個 try/catch，`retrieveWith` 已有現成路徑）
   → 把可用性從最脆弱拉到堪用。對應 §4.2
2. **FAQ cache 加 top-2 margin check** → 堵住唯一無 grounding 的直達路徑。
   對應 §4.1
3. **一個 `portfolio-map ↔ src/data` 的一致性測試** → 堵住最可能自信說錯話
   的來源。對應 §4.5

三者皆為小改動，但補的是風險排名前三的洞。

次一階：PR CI（§4.4）→ golden set 加 hard negatives（§4.3）→
query embedding LRU（§4.2 附帶）。

## 附錄：技術棧盤點

評分所依據的棧，一次列齊。

### 核心框架

| 層 | 技術 | 位置 |
|---|---|---|
| 編排 | LangGraph.js `@langchain/langgraph` — `StateGraph` + `Annotation` state、`streamEvents(v2)` | `rag/graph.ts`、`rag/state.ts` |
| 基礎抽象 | `@langchain/core`（`Document`、`BaseChatModel`、message types） | 全域 |
| 服務端點 | Vercel Node serverless function，SSE 串流（token / node / sources / done） | `api/chat.ts`、`vercel.json` |
| 前端 | React 19 + Vite，自寫 SSE client（POST 串流讀 body，非 EventSource） | `src/components/chat/useChatStream.ts` |
| Schema 驗證 | `zod`（structured output：grade、decompose、faithfulness judge） | `rag/nodes.ts`、`rag/decompose.ts`、`rag/evals/judge.ts` |
| 腳本執行 | `tsx`（ingest / eval / insights CLI）；測試 `node:test` + vitest | `package.json` |

### 模型層（雙層 cost-aware routing，`rag/llm.ts`）

- **Tier 1**：`@langchain/google-genai` → `gemini-2.5-flash`（免費層優先）
- **Tier 2**：`@langchain/anthropic` → fast（內部步驟）/ strong（僅使用者面向答案），
  兩者均由 `RAG_MODEL_FAST` / `RAG_MODEL_STRONG` 覆寫
- **First-token gate**：Gemini 串流若逾時無第一個 token 則丟棄改打 Claude；
  一旦吐出可見 token 即 commit，之後 stall 只回 partial 並標記 `stalled`
- `maxRetries = 0`（LangChain 預設 6 次退避會撞爆 Vercel function timeout）
- **刻意不用 prompt caching**（`rag/llm.ts` 載明理由：流量稀疏、快取 TTL 過期、
  prefix 低於最小快取門檻）

### 檢索層

| 元件 | 技術 |
|---|---|
| Dense embedding | Voyage AI `voyage-3-large`，1024 維，asymmetric `input_type`，裸 `fetch` 無 SDK |
| Sparse | Qdrant `qdrant/bm25`，由 Qdrant Cloud Inference 伺服器端計算（`idf` modifier） |
| Fusion | RRF（`rrfK = 60`）在 Qdrant Query API 伺服器端完成，dense/sparse 雙 prefetch |
| Rerank | Voyage `rerank-2.5` cross-encoder，`candidateK = 20` → `topK = 6` |
| 加權 | first-party boost 1.2（about/project/experience/skill/changelog 壓過 blog） |
| Vector DB | Qdrant Cloud，named vectors `dense` + `sparse`，UUIDv5 deterministic point id |

Collection 三個：`doc_chunks`（hybrid 索引）、`faq_cache`（語意快取，dense-only）、
`chat_logs`（分析用，size-1 dummy vector）。

### Pipeline 拓樸（`rag/graph.ts`）

```
START → triage ─┬─ answered (canned / FAQ hit) → END      ← $0，零 LLM 零 embedding
                ├─ converse (問對話本身) → END
                └─ retrieve → gradeDocuments ─┬─ generate → END
                                              ├─ rewriteQuery → retrieve  (CRAG 迴圈，maxLoops=2)
                                              └─ fallback → END
```

進圖前的前處理（皆可注入、可測）：`language.ts`（決定性語言偵測）、
`history.ts`（對話性訊息偵測、ordinal replay）、`contextualize.ts`
（condense question，首輪短路免費）、`decompose.ts`（gated 多問題拆解 →
per-question fan-out → `mergeInterleaved` round-robin 合併）。

### Context 增強（非檢索路徑）

- `rag/portfolio-map.ts` — 全語料壓縮總覽，每次 generate 注入，補 chunking
  對 global 問題的先天缺口
- `rag/entities/graph.ts` + `relations.json` — 手維護 adjacency list，
  query 時渲染子圖注入。明確標示為 GraphRAG 的刻意替代方案
- parent/child chunking（`parent_id`）

### Ingest（`rag/ingest/`）

`extract.ts`（直接 import typed TS data modules，語意邊界即 chunk 邊界）·
`chunk.ts`（自寫零依賴 CJK-aware 遞迴切分器）· `reconcile.ts`（content-hash
增量，含 `HASH_VERSION`、canonical JSON、`RAG_PRUNE_MAX` 大量刪除保險栓）·
`contextualize.ts`（Anthropic Contextual Retrieval，預設關閉，見 A/B 文件）·
`fetch-blog-bodies.ts` · `build-faq-cache.ts`

### 安全（`rag/guardrails.ts` + `api/chat.ts`）

注入 regex 消毒（中英雙語 pattern）→ generate 的 scope-lock system prompt →
輸出端歧視詞過濾（整則丟棄）→ 無效 citation 與 ungrounded link 剝除。
外加 1000 字輸入上限、RateLimiter、國別封鎖。

### 評估與可觀測性

`rag/evals/`（golden set、ablation arms、recall@k/MRR/correctness、
LLM-as-judge faithfulness）· LangSmith 選配 · `rag/insights/`（chat_logs 自建 BI，
純文字報表 + HTML dashboard，donut 以 `@resvg/resvg-js` 轉 PNG）·
前端 `PipelineTrace.tsx` 即時繪製節點與延遲

### CI / 運維

`rag-ingest.yml`（push to main 觸發）· `rag-eval.yml` · `chat-insights.yml` ·
`rag-drop-collection.yml`（有拒絕生產 collection 的護欄）。
所有可調參數集中於 `rag/config.ts`，全部 env-overridable。

### 刻意「沒有」採用

無 Python 服務（全 TS 收斂到 Vercel）· 無 Neo4j / GraphRAG · serving 路徑無
prompt caching · 無 LangChain VectorStore/Retriever 包裝（直接用 Qdrant client
取伺服器端 RRF）· 無 tokenizer（以字元計長）· 無 SPLADE++（付費；BM25 對
多語長 chunk 更合適）

---

# 後續處置（2026-09-16）

本節記錄依上述評審所做的修改。評審本身維持 2026-09-15 的原貌，不回頭改寫：
它是那天的判斷，而下面是對它的回應。實作 commit 範圍 `ceafc7a..HEAD`。

## §7 建議優先序

| # | 建議 | 狀態 | 落點 |
|---|---|---|---|
| 1 | rerank 失敗降級為純 RRF | 已修 | `rag/retrieval.ts` `retrieveWith` |
| 2 | FAQ cache 加 margin check | 已修，但**不是** top-2 | `rag/qdrant.ts` `faqLookup` |
| 3 | portfolio-map ↔ src/data 一致性測試 | 已修 | `rag/portfolio-map.test.ts` |

次一階四項（PR CI、golden set hard negatives、query embedding LRU、
`nodes.ts:retrieve` 的 catch）也一併做完，見下。

## §4.1 FAQ cache —— 建議本身有一個會反噬的前提

評審寫的是「`limit: 2` 並加 margin check：`top1.score - top2.score > δ`」。
照字面實作會**擋掉覆蓋最好的那些 FAQ**。

原因在寫入端：`rag/ingest/build-faq-cache.ts` 是 **每個 (entry × locale ×
paraphrase) 一個 point**，57 則 entry 攤成 838 個 point，單一 entry 最多有 14
句改寫（`exp-history` 的 zh-TW）。所以一則 FAQ 被問到最對口的問法時，回來的
top-2 往往是**它自己的兩句改寫**，faq_id 相同、答案相同、分數只差千分之幾。
把那當成 ambiguity，等於 paraphrase 寫得越多的 entry 越容易自我封鎖，而 paraphrase
多正是為了提高覆蓋率。

實際採用的規則：**跟「不同 faq_id 的最佳候選」比**。窗口因此不是 2 而是
`config.faqCandidateK = 16`，必須大於單一 entry 的最大改寫數，否則競爭主題根本
進不了比較；`rag/qdrant.test.ts` 有一條測試拿真實語料算出那個最大值來釘住窗口，
所以往後替某則 entry 加改寫句不會悄悄追過窗口。

門檻 `RAG_FAQ_MARGIN` 預設 0.02。2026-09-16 的 eval（run 35059505617）給了它第一份
線上分佈：**114 次探測、41 次過 0.7 的相似度門檻、其中 13 次被 margin 擋下**
（41 − 13 = 28 次實際命中）。被擋下的 gap 全部落在 **0.001 到 0.018**，正是規則要
擋的那種近乎同分的不同主題；整體 gap 範圍是 0.001 到 0.386，所以分佈不是擠在門檻
附近。

代價是量到的而不是猜的：**該擋的比例是 41 分之 13**，每一次都換成一次生成呼叫。
這個成本值不值得，要看同一次 eval 的 correctness —— near-miss 100%、整體 88.6%。
`faqprobe` log 每次都印 top、rival、gap 與兩個門檻，所以要調它隨時有新分佈可依。

## §4.2 檢索層 —— 只關掉一半，另一半是刻意留的

`retrieveWith` 的 rerank 失敗現在降級成純 RRF 排序，也就是 ablation 的 `hybrid`
arm 量過的那個排序（`docs/rag-ablation-report.md`：MRR 0.721 對 0.880，recall 都
是 100%），所以降級的代價是量過的，不是猜的。

**embedding 那條路徑仍然是單點**：`embedOne` 在 `fetchCandidates` 裡，Voyage 整體
中斷時 `retrieveWith` 依然會拋。這是刻意的 —— 候選集是空的時候沒有東西可降級，
回傳空集合會讓 grade 花一次 LLM 呼叫去得到「沒有資料」，訪客會被告知作品集裡
沒有這題的內容。那是一句關於 Charles 的假話，而且會留在對話記錄裡被下一輪引用。

那個例外改由 graph 處理：`retrieve` 節點捕捉失敗並設 `retrievalFailed`，
`routeAfterRetrieve` 直接繞過 grade 與 corrective loop 走到新的 `unavailable`
節點，回一句承認是我方故障、請稍後再試的話（`rag/triage.ts` `serviceUnavailable`，
三語）。新的 outcome `unavailable` 與 `fallback` 分開記進 chat_logs：後者是語料
缺口，屬於 backlog；前者是事故，不屬於任何人的 backlog。

加這個節點時踩到一個只有 mutation 才看得見的坑：節點名字原本手工維護在三份清單
裡（`NodeSet` 型別、`GraphNodeId` union、決定哪些 chain event 進得了訪客 pipeline
trace 的允許清單），而 `unavailable` 只進了兩份。它照樣執行、照樣回答正確，只是
在 trace 上完全不存在 —— 少接一條軌不會讓任何東西失敗。現在三者都從
`GRAPH_NODES` 這一份清單推導。**測試也補了第二道**：原本那條測試叫「every one is
traceable」，實際只比對了「圖裡接了哪些節點」，把 `unavailable` 從允許清單拿掉
整個 rag suite 照樣全綠。新測試走 `streamAnswer` 的真實串流路徑、讀它吐出來的
trace，而不是直接對允許清單做斷言（一個沒人呼叫的過濾器也能滿足後者）。

附帶做掉的是評審提到的 query embedding 快取：一則訪客訊息在熱路徑上至少被 embed
兩次（triage 探 FAQ 一次、retrieve 的 dense arm 一次），同字串同 input_type。
`rag/embeddings.ts` 加了一個上限 64 的行程內 memo，以 input_type 為 key 的一部分
（Voyage 對 query 與 document 的編碼不同，共用會靜默污染索引），失敗不入快取。

## §4.3 golden set 飽和 —— 加了題，但還沒有新的量測

golden set 從 29 題擴到 **41 題（123 次執行）**，新增的都落在評審指出的方向：

- **fragment-dependent**：3 題釘 `blog:<slug>:body:`，標題 chunk 滿足不了，
  逼出正文檢索。部落格正文佔語料三分之二，先前 5 題全都是標題 chunk 就能中的。
- **agentic design patterns**：4 題。22 個 chunk 先前**一題都沒有**，而它們
  只有 chatbot 讀得到（站上沒有頁面渲染），檢索是唯一入口。
- **skills chunk**：1 題。先前不可達。
- **near-miss 配對（hard negatives）**：4 題，兩組。同一個句型換一個名詞、答案是
  不同的數字（NUEIP +40% 對 PXPay +25%；FLUX 帶 10 人對 USPACE 帶 15 人）。
  這類題目的意義在於 recall 看不出問題：檢索回「兄弟題」的 chunk 照樣算命中，
  於是 correctness 與 recall 在這裡才會分開。它同時是 §4.1 那道 margin 的量測基準。

`EvalCategory` 因此多了 `near-miss`，而且 eval 報表多一張**分類 recall 表**，
否則新分類只是註解、沒有證明面。

**已經量了（2026-09-16，run 35059505617）**：`hybrid+rerank` 的 recall 從 100%
掉到 **96.7%**，也就是 benchmark 不再飽和 —— 擴題確實恢復了鑑別力。完整數字見
`docs/rag-ablation-report.md`。

那次 eval 同時揭穿三件這一輪自己造成或長期存在的缺陷，詳見下一節。

## §4.4 eval 沒有在守門 —— 兩層都補上

- **PR CI**（`.github/workflows/ci.yml`）：pull_request 與 push to main 都跑
  lint、`npm run build`（`tsc -b`，涵蓋測試檔）、`npm run rag:test`、`npm test`。
  全部離線、不需要任何 secret。先前這些只在本機跑過。

  最後一步原本**依 vitest 印出的 summary 行判定，不看 exit code**，因為 `npm test`
  在全過的情況下仍然 exit 1，印出一行 `[vitest-worker]: Timeout calling "onTaskUpdate"`。
  2026-10-01 查出機制：vitest 在同一檔的測試之間只 await microtask，rigProbe 整檔
  同步跑了三分鐘，worker 的 event loop 一直沒走到 poll phase，RPC 回應擱著沒讀，
  60 秒計時器在 loop 終於轉動時先觸發。`src/test/setup.ts` 改成每個測試後讓出一次
  macrotask（`setImmediate`）之後，該錯誤消失，CI 改回直接看 exit code。那個
  summary 判別式在 idlePose 加入 `it.runIf` 之後自己就壞了：`2335 passed | 11 skipped (`
  比對不到它的 pattern，全綠的 run 也判紅。
- **ingest 後的回歸閘門**（`rag-ingest.yml` 新增 `eval-gate` job）：內容 push 重建
  生產索引之後，對剛建好的索引跑 retrieval-only eval，`--min-recall 0.95` 不到就
  讓整個 run 失敗。門檻取 0.95 是因為三個 arm 現況都是 100%，留一題的容錯、不留
  崩盤的空間。它是地板不是差分：2% 的緩慢滑落要靠手動 `RAG Eval` 與 ablation 表看。
  只守 `doc_chunks`，A/B 用的實驗 collection 與 dry run 都跳過。

## §4.5 手工同步面 —— 四處裡釘住一處

`rag/portfolio-map.ts` 已由 `rag/portfolio-map.test.ts` 綁回 `src/data`：專案與
雇主的存在與不存在、每條連結、每個雇主的起始年份，以及**map 引用的每一個數字**
（7 個百分比與「team of N」全是從 `src/data` 逐字抄來的，所以可以逐字比對）。
評審在這點上是對的：先前那份測試的註解宣稱「役割的描述無從比對」，而承載數字的
正是那幾行。

**另外三處仍未釘住**：`rag/entities/relations.json`、`rag/faq-cache.ts` 的 838 條
答案、`rag/triage.ts` 的 `CONTACT`。這三個沒有現成的逐字對應可比，要釘得先決定
「什麼算一致」，不在這一輪。

## §4.6 RateLimiter

未動。評審的判斷（此流量規模下不構成風險，且程式碼已誠實註記限制）成立。

## 順手更正的過期敘述

改了行為就會讓描述它的散文變假，所以同一輪掃了一次：

- `docs/rag-chatbot-design.md` 三處把 FAQ 命中寫成單一 cosine 門檻，已補上 margin。
- 同一份文件的語料計數過期：`755 paraphrases / 52 topics` 實際是 **838 / 57**，
  `309 doc chunks` 實際是 **1,074**（本 commit 量的）；ingest 早已改成 push 觸發，
  文件仍寫 `workflow_dispatch`。
- `docs/portfolio-rag-roadmap.md` 的語意快取那列同樣只寫了門檻。
- `docs/rag-ablation-report.md` 的 29 題數字標成了那次 run 的當下值，並註明現在是
  41 題，避免它被當成可比較的現況。

**這一段自己漏掃過一輪。** 第一次掃用的 pattern 是我剛改完的那幾個字面值，於是
只找到自己已經修過的地方：`309 chunks`、`52 hand-written topics` 與兩處
`workflow_dispatch` 全部留在原地，是規格 review 抓出來的。正確的做法是拿**底層
的數字本身**（`\b309\b|\b52\b|\b755\b`）重掃，不是拿新措辭。同一句話常有雙胞胎。

## eval 第一次真的跑起來之後找到的三件事

這一輪把 eval 從「沒有在守門」變成「會跑」，而它跑起來的第一件事就是拆穿三個缺陷，
其中兩個是我自己在這一輪造成的。

1. **`retrieve` 拿不到它的依賴，整條線上檢索全掛。** LangGraph 呼叫節點的方式是
   `fn(state, config)`，第二個參數已經被佔用；我寫的 `deps = DEFAULT_RETRIEVE_DEPS`
   是預設參數，只在引數不存在時生效，於是 `deps` 綁到 RunnableConfig，
   `deps.hybridRetrieve` 是 undefined。**而同一輪加的 outage handler 把這個
   TypeError 接住，對訪客回報成「Qdrant 掛了」** —— 我方的 bug 穿上供應商故障的
   衣服，log 說 outage、incident metric 同意、沒有任何東西指回程式碼。
   非 FAQ 命中的題目全部回「我查不到」。修法是改用 repo 既有的
   `resolveRetrieveDeps` 慣例，並讓 catch 對 `TypeError` 直接重拋。
   我為這個接縫寫的測試（`DEFAULT_RETRIEVE_DEPS.hybridRetrieve === hybridRetrieve`）
   全程綠燈：它驗的是「預設值是什麼」，從來沒驗「預設值有沒有被用到」。

2. **near-miss 被放在看不見它的欄位。** §4.3 加了分類表，但只有 recall。
   near-miss 的兄弟題 chunk 本來就在該題自己的 `relevantIds` 裡，取錯那一半照樣
   滿分 recall，答案卻引用另一家公司的數字 —— 所以那張表對它唯一存在的理由是盲的。
   補上 correctness 分類表後，near-miss 量到 100%。過程中 mutation 又抓到同一類
   接線缺口（把 correctness 從 `runArm` 推進表格的那筆記錄裡拿掉，全綠），改成
   每次執行產生一筆 `ItemResult`、所有數字從它推導。

3. **out-of-corpus 的 correctness 從加進來就一直是 0%。** 行為是對的：triage 直接
   擋下私人問題，回「那屬於私人問題，交給 Charles 本人」＋聯絡方式。但
   `DECLINE_MARKERS` 是手抄的片語清單，**三種罐頭回覆一個都不命中它的十二個片語**，
   包含 `genericFallback` —— 而那份清單的註解寫著「the fallback node and a faithful
   generate both produce one of these」。改成從產生那些字串的函式取值，片語清單只
   留給 LLM 自己措辭的拒答；故障回覆明確不算拒答。修完 0% → 100%。

共同形狀是同一個：**純函式被測到了，接線沒有**。三件都是 mutation 或真實 eval 才
拆穿，靜態閱讀與全綠測試都看不出來。

## 第四件：修完之後的 production 探測才抓到的

前面三件是 eval 拆穿的，這一件 eval 看不到：它每一題只跑一次，而這個缺陷是
隨機的。是去確認 skills chunk 修正有沒有上線時，順手多探測幾次才看見。

**英文問題有時會拿到中文或日文的答案。** 對「What skills does Charles list on
his site?」探測 5 次，3 次漂移（2 次中文、1 次日文），每一次 `language` 都正確
偵測成 `en`、六個來源也都是 `:en`，所以上游沒有任何一層是錯的。漂移的句子是
逐字取自 `rag/persona.ts` 的 CJK 示範句（`お、それ聞いちゃう？`、`整理給你`、`超級`）：
舊的 `MIKA_VOICE` 是一個常數，把三個語系的示範無條件寫進每一次 generate 與 converse。
同一天對另一個英文題探測 3 次沒有漂移，所以不是每一題都會。

修法是「示範只送給它被寫成的那個語系」：`mikaVoice(locale)` 按回覆語言選取
`VOICE_PER_LANGUAGE`，而禁用詞與規則照舊全部帶（禁止的東西不是拿來抄的，這三個
字串也沒有一個是禁用詞）。任何一個字的文案都沒改：zh-TW 的回覆拿到的中文區塊
與修改前逐字相同。

量過的結果（commit `1dff5b6` 上線後）：同一個英文問題探測 8 次，**0 次漂移**。
若漂移率還是原來的 3/5，8 次全中的機率是 0.4^8 ≈ 0.07%。中日文各探測一次確認沒有
逆向壞掉：zh-TW 回中文、開頭「呀吼」結尾「喔」，ja 回日文、開頭「おっ」結尾常体。

這件與前三件形狀不同：不是接線沒被測，而是 **prompt 裡的每一句話都是模型的可用
材料**，包括那些寫給別的語系看的。接線還是要釘：四道防禦（persona 兩個 locale
索引、兩個節點的呼叫）各跑一次 mutation，四次全紅。

## 第五件：faithfulness 一直在量別的東西

要求重跑 faithfulness 拿最新數字時抳到的，而且是兩層：先是分母錯了，修完之後
真正的數字才浮出來，而它揭穿第二層：judge 看到的材料比 generator 少。

三個數字，彼此不可比，而且每一次變動都是量法變了、不是答案變了：

| Run | 數字 | 量在什麼上面 |
|---|---|---|
| 35110389098 | 85.4% | 全部 123 題，判不動的那幾題一律計 1 分 |
| 35122775710 | 82.4% | 有 retrieved context 的 91 題，judge 只看 graded chunks |
| 35124733398 | 95.6% | 同樣那 91 題，judge 看到 generator 看到的全部 |

第一個是被自己的分母膰高的。FAQ 命中、罐頭拒答、故障通知都沒有 retrieved
context，`judgeFaithfulness` 把這稱為 vacuously faithful 並回 `grounded: true`，於是
headline 跟著快取命中率走：lexical veto 把五題送去生成，免試數從 28 降到 23，
數字就揉下來，而沒有任何一個答案變差。現在那幾題是「不計入」，跟檢索 arm
沒有 correctness 是同一個處理。

第二個是正確的分母配錯誤的證據，也是真正有意思的那一個。它第一次印出逐題理由，
16 條 ungrounded 裡 judge 指控「捧造」的是 PXPay Plus、NUEIP、FLUX、Plutus Trade
與它找不到的每一個數字。這些全部在 `rag/portfolio-map.ts` 裡，generator 拿得到、
judge 拿不到。這個 pipeline 的一個主張可以依據三種東西：編號的 chunk、portfolio map、
entity 關係，而只有第一種有編號，所以被忘掉的永遠是另外兩種。這跟它曾經吐出
`[Charles Chen description]` 當引用是同一個根因：兩個讀者各自列自己的清單。
現在 `rag/nodes.ts` 的 `evidenceBlock` 是單一定義，prompt、連結過濾器、judge 三者共用。

剩下的四條 ungrounded 就是 95.6% 的內容。其中一條是 judge 在跟自己吵架：它把答案與
context 引成同一句話，然後判答案沒依據。不過它引的那句是「ChatGPT 的共同創造者
Liam Fedis」，而這個名字在原文就拼錯了（應為 Liam Fedus），機器人只是忠實轉述。
這屬於內容層，不在這份 review 的範圍內。

## 已知仍未覆蓋的缺口

- FAQ margin 的 0.02 現在有分佈了（見 §4.1），但**沒有證據說 0.02 是最佳值**：
  只知道它擋掉 41 分之 13，不知道那 13 次若放行會不會答錯。要回答那個問題，得把
  被擋下的那些 (query, entry) 配對變成 golden 題目。
- corrective arm 的 recall 分不出「FAQ 快取答掉了」與「檢索沒找到」（最近一次
  123 題裡 23 題由快取回答，快取答案沒有 sources，被記成 recall miss）。檢索品質
  要看三個檢索 arm。
- `rag/insights/collect.ts` 新增的 outage 計數沒有測試：`gatherInsights` 直接打
  Qdrant，沒有注入點，補 seam 的改動比這一輪該有的大。
- `npm test` 的 birpc 心跳誤報是**繞過去的，不是修好的**。它先於這一輪存在（這輪
  沒有新增任何 `src/` 或 `scripts/` 測試），而 CI 的判別式只容忍「結果行說全過」
  這一種情況。真正的修法是讓 avatar 那幾份測試不要長時間卡住 event loop，或等
  vitest 把那個 timeout 開放設定。

---

# 後續處置（2026-10-01）

9-16 那一輪把 §7 的三件事做完，但 §4.1 到 §4.5 各自留下缺口（見上一節「已知仍未覆蓋的缺口」）。這一輪把五項都推到可以用證據說「關掉了」的程度。實作已併入 main，commit 範圍 `c2a0c27..e2a8796`，含文末兩輪 FAQ 合併。

| 項目 | 9-16 狀態 | 本輪 |
|---|---|---|
| §4.1 FAQ 無 grounding | margin 0.02，無證據說它對 | 留一法校準加 judge，0.8／0.08 下答非所問 0 次；命中附引用 |
| §4.2 檢索單點 | rerank 可降級，embedding 仍單點 | embedding 失敗改用 BM25；供應商邊界統一分類、重試、斷路 |
| §4.3 golden 飽和 | 加題後 recall 不飽和，correctness 仍 100% | 加比較題與時序題，recall 92.4%，temporal 41.7% |
| §4.4 eval 沒守門 | ingest 後只有 recall 地板 | ingest 前先跑離線測試；ingest 後逐題比對基準 |
| §4.5 手工同步面 | 四處釘住一處 | 四處全部綁回 `src/data`，抓到 6 筆過期或無依據的事實 |

## §4.5 手工同步面：四處全部釘住，而且一接上就抓到錯

`rag/grounding.ts` 是唯一的定義，判斷一段手寫文字裡的數字與「年月」是否仍由同語系的語料陳述。FAQ 答案（當時 174 則、384 個事實；兩輪合併後 150 則、350 個事實）、portfolio map（28 個）、entity graph 的 note 全部用它檢查。年月另列一類，只准由經歷、專案、About 這類策展紀錄佐證；單比數字時，「2026 年 8 月升任」這種 `src/data` 根本沒寫的日期，會被某則 2026 年的 changelog 碰巧對上。

第一次接上就找到 6 筆過期或無依據的事實：

- `relations.json` 把 USPACE 職稱寫成 Product Manager（網站寫 Head of Product）
- 同一條 note 寫「3 product lines」，沒有任何紀錄這樣寫
- `path built_with claude`（prototyped with Claude Code），整個 `src/data` 沒有這句
- zh-TW 的兩則 FAQ 答案寫 `1M+`，zh-TW 網站寫「100 萬+」
- 成本答案說快取有 52 個主題，實際 58 個
- portfolio map 寫 Product Playbook `v2.3`，專案頁寫 `2.4.0`

結構面的修法：employment 邊改成只寫雇主，職稱、日期、在職與否在渲染時從 `experience.en.ts` 讀；`CONTACT` 改由 footer 的 `social.ts` 推導，不再手抄。語料沒寫但其他頁面有寫的事實，登記在 `rag/off-corpus-facts.ts` 並註明出處，測試會檢查出處仍成立、豁免仍然必要。本節初稿時有 2 筆（TOEIC 的分數與滿分），後來 Charles 決定不把分數寫進網站，現已清空，見文末待決事項。2026 年 8 月升任 Head of Product 原本也是一筆，經 Charles 確認後寫進三語的 `src/data/experience`，豁免隨之刪除；刪除前「豁免仍然必要」那條測試先轉紅，證明它認得出已經不需要的豁免。

## §4.1 FAQ：問題出在 entry 重疊，margin 只是旋鈕

校準的做法是留一法：每句 paraphrase 拿掉自己那個點後重問一次，正確答案就是它所屬的 entry，所以每個查詢的標籤都是精確的。第一次跑（run 36807870107，當時 853 句）的結果推翻了預設：

- 0.7／0.02 下命中 506 次，其中 128 次（25.3%）判給了別的 entry
- 離線試過三種接受規則與整張門檻網格，判錯率都在 19% 到 27% 之間，幾乎不隨門檻變動

所以問題在 entry 本身互相重疊，而且有一部分是資料錯誤：8 句 paraphrase 同時屬於兩個 entry（例如 `why Qdrant?`），5 句問版本的問題放在 Product Playbook 的一般介紹底下。兩者都已修正，前者有測試禁止。

判錯不等於答錯。主題相近的 entry 常常仍然回答了問題，所以每一筆判錯都交給 judge 判斷「這個答案有沒有回答這個問題」，只把沒回答的算成有害。另外 16 句會先被 regex triage 攔下、根本問不到快取，不計入。資料修正後的結果（run 36809386889，829 句）：

| 設定 | 命中 | 判對 | 判錯但切題 | 答非所問 |
|---|---|---|---|---|
| 0.7／0.02（舊） | 496 | 389 | 85 | 22（4.4%） |
| 0.8／0.08（現行） | 263 | 230 | 33 | 0 |

推薦規則是「有害 ≤ 命中的 1%，其中切題命中最多者」。margin 是真正起作用的旋鈕；只拉 threshold 時，好的命中與有害的命中幾乎同速減少。代價是覆蓋率：留一法查詢由快取答對的比例從 46.9% 降到 27.7%（命中比例從 59.8% 降到 31.7%），其餘改走檢索、評分、引用的完整路徑。以上是合併 entry 之前的數字；兩輪合併後同一設定命中 283 次、判對 270 次（覆蓋率 32.8%）、判錯 13 次、答非所問 0 次，見文末。

命中時現在會附上引用來源：入庫時用同一份 grounding 推導出陳述該答案事實的 chunk，存進 point 的 payload，triage 直接帶出。兩輪合併後（e2a8796，以入庫時實際使用的 `citeFacts` 量），150 則答案裡 75 則帶引用，另 75 則不含可查核的數字或日期（自我介紹、聯絡方式這類），含事實卻沒有引用的是 0 則。TOEIC 分數移除前，`languages` 的三語答案是唯一一組事實只有語料外來源的答案。

## §4.2 檢索：embedding 也有退路了，並修掉一個讓真斷線變成崩潰的缺陷

稀疏向量是 Qdrant Cloud Inference 在伺服器端算的 BM25，完全不需要 Voyage。所以 hybrid 查詢的 embedding 失敗時，改用 BM25 單臂排序；它的品質由新增的 `sparse-only` ablation arm 量測。hybrid 系列的 arm 開 `strictDense`，量測時不會悄悄退化。

檢查斷線路徑時找到更嚴重的缺陷：Node 的 `fetch` 在連線被拒或 DNS 失敗時丟出 `TypeError: fetch failed`（Qdrant client 與裸 `fetch` 都實測過），而 retrieve 節點把所有 `TypeError` 當成我方 bug 重拋。結果 `unavailable` 節點本來要處理的那種斷線，實際上會讓請求崩潰成通用錯誤。現在回答訪客需要的四種對外呼叫（FAQ 探測、query embedding、候選查詢、rerank）都經過 `rag/supplier.ts`；chat_logs 的寫入刻意不經過，記錄失敗不該讓下一位訪客收到 outage：

- 拋出的任何東西都分類成 `SupplierError`，outage 判斷改看這個型別
- 網路失敗、429、5xx 重試一次；逾時與 4xx 不重試
- 供應商答不出來（逾時、網路、429、5xx）時，同一個 instance 內斷路 30 秒，避免同一則訊息在 FAQ 探測與檢索各等一次 10 秒逾時；429 以外的 4xx 是對單一請求的回答，不斷路，否則 FAQ collection 的 404 會讓所有訪客的檢索都回 outage
- Voyage 回 200 卻缺少某個輸入的向量，也算供應商失敗；以前檢索會拿到 `undefined`，靜默改用 BM25 且不回報降級

降級種類（`dense-unavailable`、`rerank-unavailable`）沿 graph state 傳到 `done` 事件與 chat_logs 的 `degraded` 欄位，insights 報表新增計數。這類回答訪客照樣收到，以前在任何報表裡都看不出來。eval 的 corrective arm 跑的是正式 graph，所以 ablation 報告也新增 degraded 欄位，標出在 Voyage 斷線時檢索的 run 數（只靠 BM25，或少了 rerank 的融合排序）。

Qdrant 本身仍是儲存的唯一來源，斷線時回誠實的 outage 訊息，這是刻意的終點。

## §4.3 golden set：補上評審點名的兩類題

新增 3 題跨 chunk 比較題與 4 題時序題，golden set 變成 48 題。需要兩個 chunk 的題目改用「取回比例」計分，否則只取回一半的比較題也拿滿分。結果（run 36809268615，hybrid+rerank）：recall 從 96.7% 降到 92.4%，comparison 66.7%，temporal 41.7%。benchmark 重新有鑑別力了。

corrective arm 以前把 FAQ 命中算成 recall miss（123 次裡 23 次）；FAQ 命中帶引用之後又會被算成檢索結果。現在檢索沒跑過的 run 不計入 recall 與 MRR，改列在獨立欄位。

完整的 corrective arm 在校準後的 0.8／0.08 下（run 36811880858）：correctness 97.2%（144 次錯 4 次），faithfulness 93.5%。錯的 4 次裡 3 次是 `first-role`，就是上面 temporal 的檢索缺口；另 1 次是 golden 規則本身寫錯：`uspace-role` 要求答案說「a Product Manager at USPACE」，網站記的是 Head of Product，於是說對的答案被判錯。golden 規則同樣是手寫、被當成事實來判的面，現在有測試把規則裡每個「職稱 at 雇主」綁到 `src/data/experience`（a113bed）。逐項分析在 `docs/rag-ablation-report.md`。以上是 FAQ 合併前的量測；兩輪合併後重跑（run 36857502362，15424ba），correctness 仍是 97.2%（144 次錯 4 次，`first-role` 三語加 `uspace-role` en），faithfulness 91.0%（122 次判了 11 次沒依據）。11 次裡有 5 次 judge 自己的理由與判決矛盾，例如寫「兩者等價，其實有依據」卻仍判沒依據，或把「2026 年 8 月起」當成未來日期；另有 5 次是生成錯誤，例如把 Product Playbook 的 59.1% 到 100% 講反。上一輪的 `uspace-role` zh-TW 沒有再出現，升遷日期已經入庫。

## §4.4 守門：ingest 前與 ingest 後各一道

- ingest 前：`rag-ingest.yml` 的 ingest job 依賴新的 `offline-checks` job（`npm run rag:test`）。§4.5 的 grounding 測試在這裡，內容改了卻讓 FAQ、map 或 graph 陳述網站已不再陳述的事實，就進不了 production 索引。
- ingest 後：每題每語系的 recall 存成 `rag/evals/baseline.hybrid-rerank.json`（144 筆），任何一題比基準低就失敗並點名。recall 地板因此只需擋崩盤，從 0.95 降到 0.85；新題目讓 served arm 降到 92.4%，0.95 會擋下每一次 ingest。
- eval workflow 的 `faq_sparse_veto` 預設原本是關，production 是開，預設的 eval 量的是一個沒上線的設定。已改成預設開。
- insights 的 load 改成可注入，outage 與降級計數有測試了。

## 上一節「已知仍未覆蓋的缺口」的狀態

| 缺口 | 狀態 |
|---|---|
| margin 0.02 沒有證據 | 已校準，見 §4.1 |
| corrective recall 分不出快取與檢索 | 已分開，見 §4.3 |
| insights outage 計數沒有測試 | 已補 seam 與測試 |
| `npm test` birpc 心跳誤報是繞過去的 | 已在 `531adcf` 修好（每個測試後讓出一次 macrotask），CI 改回看 exit code |

## 驗證

- 本機（7b47aac）：`npm run rag:test` 433／433 全綠，`npx vitest run` 2336／2336 全綠，`npm run build`（含 `tsc -b`）通過，lint 通過。
- 本機（23f15e6，兩輪 FAQ 合併後）：`npm run rag:test` 445／445 全綠，`npx vitest run` 2336／2336 全綠，build 與 lint 通過。之後的 e2a8796 只改文件。
- 新增的每一道防禦都做過 mutation，確認拿掉後測試會轉紅；三輪下來存活的 10 道都補了測試或改寫成單一結構後再驗一次，全部轉紅。
- 線上：校準與基準檔都在 GitHub Actions 對真實 Qdrant 跑出，run id 已寫在各段。

## 待決事項的處置

**TOEIC 940／990**：Charles 決定不寫進網站，所以 `languages` 的三語答案拿掉了分數，只問分數的 6 句 paraphrase 也一併移除，這類問題改走檢索。`rag/off-corpus-facts.ts` 因此清空；檔案保留，下一筆例外仍有地方登記，也照樣受測試檢查。

**主題重疊的 entry**：三組各併成一則，保留 `who-is-charles`、`why-hire`、`who-is-mika`。entry 從 58 則變 53 則，paraphrase 從 845 句變 839 句，少掉的 6 句就是 TOEIC 題。合併後 `who-is-charles` 的 zh 有 21 句，超過 margin 規則讀取的 16 個鄰居，窗口測試當場轉紅，`faqCandidateK` 因此調到 32。

校準跑了三次才拿到可用的數字。第一次（run 36818421587）作廢：scratch collection 沿用正式環境的刪除上限，拒刪 109 個舊點，量到的是新舊混雜的快取。現在 scratch 建置一律完整刪除，校準開始前也會比對 collection 與 `faqEntries`，對不上就直接失敗。第二次（run 36818795916）有 1 筆答非所問：ja「キャリアの選択」拿到一串職位清單，原因是合併時漏掉 `exp-history` 那句職涯主線，以及 `who-is-charles` 列的三條 USPACE 產品線，補回後第三次（run 36819029430）回到 0。

第二輪合併處理剩下 18 筆判錯裡內容重疊的幾組：`bot-tech-stack` 併入 `bot-how-made`，`best-project` 併入 `projects-list`，`skills-ai` 併入 `how-uses-ai`，「你是 Charles 做的嗎」三語 paraphrase 從 `bot-how-made` 改歸 `who-is-mika`，因為「你是 Charles 本人嗎」「誰做了你」都在那裡。entry 從 53 則變 50 則，paraphrase 維持 839 句。

| 0.8／0.08 | 合併前（run 36809386889） | 第一輪（run 36819029430） | 第二輪（run 36830100946） |
|---|---|---|---|
| 留一法查詢 | 829 | 823 | 823 |
| 命中 | 263 | 271 | 283 |
| 判對（覆蓋率） | 230（27.7%） | 253（30.7%） | 270（32.8%） |
| 判錯 | 33（命中的 12.5%） | 18（命中的 6.6%） | 13（命中的 4.6%） |
| 答非所問 | 0 | 0 | 0 |

第二輪消掉 6 筆判錯，新冒出 1 筆（zh「為什麼要僱用 Charles」拿到 `who-is-charles`，judge 判有回答到）。同一組問句與答案在第一輪的 veto 關閉段（run 36820036596）被同一個 judge 判成答非所問，兩輪之間 `who-is-charles` 的答案沒有改過。所以「0 筆答非所問」是單次判讀的結果，這類邊界案例 judge 的判讀會在兩次 run 之間翻轉。剩下 13 筆分兩類：問句本身有兩種讀法，例如「his fintech project」可指 Plutus 也可指 PXPay、「他用哪些語言」可指程式語言也可指外語；或範圍大的 entry 蓋過範圍小的，例如「where is Charles based?」拿到 `who-is-charles`。這兩類再合併 entry 也消不掉。要再往下壓，得把這類短問句從快取移出交給完整檢索，並用 chat_logs 的真實提問另建 held-out 測試集來量，校準用的題目就是 paraphrase 本身，改 paraphrase 等於改考題。

第二輪的報告推薦 0.8／0.05，條件是答非所問不超過命中的 1%，那一格有 3 筆答非所問。正式設定維持 0.8／0.08，這一格是 0。

上線時有一件事要手動做：正式的 `faq_cache` 同樣受刪除上限保護，push 觸發的 ingest 會拒刪那 109 個舊點，所以 push 後要再帶 `prune=true` 跑一次 RAG Ingest。第一次照做時 `prune` 只傳到 doc_chunks 的建置步驟，FAQ 步驟照樣拒刪；d7c74e9 讓 FAQ 步驟也讀這個 input，重跑後刪掉 109 點，剩 839 點。第二輪合併上線（23f15e6）時，push 觸發的 ingest 自動刪掉 53 個舊點，數量在刪除上限內，正式快取同樣是 839 點。

## 時間軸 chunk 與 judge 的後續

上面列為範圍外的時序缺口已補：每個語系加一個依起始時間排序的經歷時間軸 chunk，標出最早的一份與目前同時在職的工作（`rag/ingest/extract.ts` 的 `timelineChunk`）。golden 新增 `answeredBy`，讓 `first-role`、`before-pxpay`、`concurrent-roles` 可以宣告「這個 chunk 單獨就答得完整」。

在同一分支建出的實驗索引上量：hybrid+rerank 的 recall 從 92.4% 升到 97.2%，時序題從 41.7% 升到 100%；逐題對照基準，沒有任何一題退步，9 題上升（run 36867760929），基準檔已更新到這次。corrective arm 的 correctness 從 97.2% 升到 99.3%，144 次只錯 1 次（run 36871169321）。沒有對訪客提供的 dense-only 與 hybrid 兩個 arm 在 single-fact 與 global 各掉了一點，對訪客提供的 hybrid+rerank 沒有。

judge 這邊做了三件事，留下來且確定有用的只有一件。告訴 judge 今天的日期、以及「翻譯或等值數字算有依據」的規則，faithfulness 仍是 91.0%，`uspace-role` zh 在拿到日期的情況下照樣把 2026 年 8 月當成未來。改成「列出所有沒依據的主張」的版本讓沒依據的判定從 11 次變 29 次（run 36868407205），已撤回。有用的是第三件：judge 的輸出讀不出來時只略過那一題。run 36867749603 就是因為一次讀不出來，整個 eval 中斷；這個退路由單元測試驗證，之後的 run 沒有再遇到讀不出來的情況。要讓 faithfulness 可信，下一步得換更強的 judge 模型或多次判讀取多數，光改 prompt 不夠。
