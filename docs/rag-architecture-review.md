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

門檻 `RAG_FAQ_MARGIN` 預設 0.02，是**未經線上分數分佈驗證的起始值**（本機沒有
Voyage key）。`faqprobe` log 現在每次都印 top、rival、gap 與兩個門檻，調整時有
實據可依。

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

**還沒做的是重新量。** 需要 Voyage 與 Qdrant 金鑰，得跑 `RAG Eval` workflow；
在那之前，「新題目是否讓 benchmark 重新具備鑑別力」仍然是未驗證的假設。

## §4.4 eval 沒有在守門 —— 兩層都補上

- **PR CI**（`.github/workflows/ci.yml`）：pull_request 與 push to main 都跑
  lint、`npm run build`（`tsc -b`，涵蓋測試檔）、`npm run rag:test`、`npm test`。
  全部離線、不需要任何 secret。先前這些只在本機跑過。

  最後一步是**依 vitest 印出的結果判定，不看 exit code**。`npm test` 在 1,636 條
  全過的情況下仍然 exit 1：avatar 那幾份測試有長時間的同步 CPU 迴圈，worker 因此
  錯過 vitest 內部 birpc 的 `onTaskUpdate` 心跳，印出一行
  `[vitest-worker]: Timeout calling "onTaskUpdate"`。2026-09-16 量過五種組合
  （預設 2 threads 連跑三次、`--pool=forks`、`--maxWorkers=1`），**五次全部 exit 1
  且五次全部 1,636 條通過、各恰好一行該錯誤**；那個 timeout 是 vitest 內部常數
  `DEFAULT_TIMEOUT`，沒有對外旗標可調。必紅的關卡會教會所有人忽略 CI，拿掉這步
  則失去覆蓋，所以改判 summary 行：`Tests N failed | M passed` 或那行根本不存在
  （run 沒跑到印結果）都算失敗。這個判別式是拿一條**故意寫壞的探針測試**驗過的，
  不是只拿全綠的 run 驗。
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

## 已知仍未覆蓋的缺口

- FAQ margin 的 0.02 沒有線上分數分佈佐證。
- 擴充後的 golden set 沒有跑過一次 eval，§4.3 是否真的恢復鑑別力未知。
- `rag/insights/collect.ts` 新增的 outage 計數沒有測試：`gatherInsights` 直接打
  Qdrant，沒有注入點，補 seam 的改動比這一輪該有的大。
- `npm test` 的 birpc 心跳誤報是**繞過去的，不是修好的**。它先於這一輪存在（這輪
  沒有新增任何 `src/` 或 `scripts/` 測試），而 CI 的判別式只容忍「結果行說全過」
  這一種情況。真正的修法是讓 avatar 那幾份測試不要長時間卡住 event loop，或等
  vitest 把那個 timeout 開放設定。
