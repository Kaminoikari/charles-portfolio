# Mika 現成方案評估與採用計畫

查核日期：2026-09-09。狀態：官方文件與 R0 限定 discovery 完成；R1 Blender VRM Add-on 最小往返已實測，基本結構／載入通過，嚴格 baseline 為 `FAIL`，正式接入保持 `PENDING`。詳見[本輪收據](../reports/mika-reuse-validation-2026-09-09.md)。本文件更新[平台計畫](mika-platform-validation.md)的下一步順序。

## 決策

市面已有可直接製作角色、組裝模組、匯出 VRM 與提供生成 API 的方案。暫停擴寫自研 bob 幾何、jaw deformation 及動作補償演算法，先驗證現成工具與可授權資產。上一輪 prototype 留作比較與回歸 fixture。

推薦的第一條路線是：VRoid Studio 建立動漫角色的美術與工時基準，Blender＋VRM Add-on 驗證既有 Mika 的自動化匯入／匯出，再評估 XWear／Modular Avatar 組裝。圖像生成路線以 Tripo／Meshy 和 OCM 成品作對照。先沿用成熟的製作與格式處理能力，平台自行負責需求、recipe、資產權利、訂單及驗收。

這是採用與試驗優先順序，尚未把任何工具標為 Mika 的正式生產依賴。沒有完成特定工具評估，不得直接恢復自行調參。

```text
需求與可交付檔案
        |
官方能力 + 範例 + 資產／平台授權
        |
現成工具產出相同案例
        |
品質 / 可編輯性 / 動作 / 工時 / 成本
        |
   +----+----------------+
   |                     |
可採用或整合         有已重現的缺口
   |                     |
固定版本與契約       再找既有擴充／參考實作
                         |
                  最小自研 adapter／補件
```

## 查核清單與適用邊界

「成熟」在此指已有官方產品、使用文件或可用 API／原始碼；不代表已測得 Mika 品質、供應商 SLA 或整合成功。

| 方案 | 官方能力與證據 | 採用判斷 |
|---|---|---|
| VRoid Studio | 臉型／五官、髮束、服裝模板、貼圖與髮束 bounce，原生 VRM 匯出。[功能](https://vroid.com/en/studio)、[匯出](https://vroid.pixiv.help/hc/en-us/articles/15760756822297-I-want-to-learn-more-about-the-VRM-export-feature) | 優先作 authoring 與品質基準；先用既有髮型／臉型工具。GUI 製作與全自動 SaaS 分開驗證 |
| VRoid dress-up／XWear | 服裝依骨骼 scaling auto-fit，配件跟隨指定骨骼；可將 VRM 與 XWear 組裝後匯出單一 VRM。[XWear 官方說明](https://vroid.pixiv.help/hc/en-us/articles/39513229598233-What-is-XWear) | 優先測現成換裝流程；auto-fit 仍需穿模驗收，不能當成任意拓樸的安全保證 |
| Blender＋VRM Add-on | VRM import／edit／export、MToon、humanoid 與 Python automation；有 examples、tests 及公開維護紀錄。[作者 repository](https://github.com/saturday06/VRM-Addon-for-Blender)、[Python 範例](https://vrm-addon-for-blender.info/en-us/scripting-api/) | 第一個自動化 round-trip 候選。先抄官方 API，不繼續擴寫一般 VRM serializer；它本身不提供完整角色素材庫 |
| Modular Avatar＋UniVRM | 官方支援先 Manual bake avatar，再以 UniVRM 匯出；組裝骨架有命名／對齊要求。[MA FAQ](https://modular-avatar.nadena.dev/docs/faq)、[UniVRM](https://vrm.dev/en/univrm/) | 可借用 prefab／骨架組裝流程；須驗證表情、材質、物理與 VRM 導出結果。不能由 VRChat 功能推定跨 app 等價 |
| OCM | 官網公開 3D 生成使用 Tripo，rigging／motion／texture repaint 使用 Meshy；提供模型、動畫與表情貼圖的資料夾匯出。[官方 FAQ](https://vtuber-ocm.com/en/) | 優先作端到端成品對照，並借鏡其上游組合。尚未取得本輪實際成品或可嵌入的 OCM API 合約 |
| Tripo／Meshy API | Tripo 有 image／multiview generation、mesh 與 rigging endpoints；Meshy 提供 humanoid rigging API。[Tripo API](https://developers.tripo3d.ai/en/docs/introduction)、[Meshy rigging](https://docs.meshy.ai/en/api/rigging) | 可直接整合的生成／綁定候選，先小量 benchmark。文件沒有替我們證明保留 Mika topology、56 morphs、MToon 或模組替換品質 |
| Didimo Popul8 Express | 自備 Template，定義 Shapes、Deformables 與 animations，自動適配服裝／髮型，與本案 base＋module 構想接近。[產品流程](https://developer.didimo.co/docs/what-is-popul8-express) | 可借鏡資料模型與適配工作流；暫不作完整 VTuber 核心。官方目前明列 animated／corrective blendshapes 不支援，使用 FBX workflow。[限制](https://developer.didimo.co/docs/best-practices-for-preparing-template-characters-for-use-in-popul8-express) |
| Character Creator 5 | 已有 stylized／realistic 角色、服裝、髮型、rig 與 DCC pipeline。[產品](https://www.reallusion.com/character-creator/) | 商業 authoring 備選。應用內角色生成與資產整合需確認 Enterprise；不能只買一般內容就推定可開放平台生成／轉售。[授權](https://www.reallusion.com/license/content.html) |
| Avaturn | 有 Web SDK、REST API、服裝與髮型客製及 GLB export；官方定位 realistic avatars。[SDK 範例](https://docs.avaturn.me/docs/integration/web/html/)、[定位](https://docs.avaturn.me/) | 可借鏡嵌入式 editor／export callback。動漫畫風與 VRM 交付尚未證實，暫不優先 |
| Ready Player Me | 官方公告服務自 2026-01-31 起不可用。[官方公告](https://forum.readyplayer.me/t/an-important-update-from-ready-player-me/3706) | 排除新採用，避免照舊文章接入已停止服務的方案 |

另有 Avatar Optimizer 可做 mesh／bone 清理，官方支援手動 bake 後的 VRM 匯出情境。先驗證它對 VRM expression／spring 引用的保留，再考慮取代現有清理；不可直接開啟自動移除 blendshapes。[官方教學](https://vpm.anatawa12.com/avatar-optimizer/en/docs/tutorial/basic-usage/)

Popul8 Express 與 Enterprise 是不同方案；不能把 Express 的限制或功能直接套到 Enterprise。Enterprise 的 blendshape、VRM、headless／SDK、平台授權與價格需另取得證據。[官方 FAQ](https://developer.didimo.co/docs/faq)

OCM guide 的生成 clip 會疊加到直播畫面；這項功能與可編輯的骨架動畫檔分開驗證。其匯出資料夾也不能直接當作已驗證的 VRM 0／1 交付包。[OCM guide](https://vtuber-ocm.com/en/guide/)

## 已定案的來源與授權事項

2026-09-09 使用者定案：既有 Mika 的 pixiv／VRoid、MellowHeart 素材及平台使用授權標示為 **已驗證（使用者確認先前已完成驗證）**。R0 權利確認結案，不再索取原文、不再重問、不阻擋 R2。這是使用者確認的既有結果，本輪沒有另稱親自審閱原始合約。[官方 Guidelines](https://vroid.com/en/studio/guidelines) 保留為歷史參考，不重開本案。

VRoid SDK 官方明示不能建立角色，功能是串接 Hub 模型；它不會解決 Studio authoring 自動化或應用生成授權。[SDK 說明](https://developer.vroid.com/en/sdk/)

Reallusion 的當前頁面上方新政策與下方舊 Extended FAQ 有不一致的描述，不能以舊 FAQ 的單角色數字估算預算；應用內角色建立仍指向 Enterprise 詢問。採購前須按實際素材與服務模式確認書面條件。[Content License Policy](https://www.reallusion.com/license/content.html)

上述既有素材範圍依使用者確認結案。未來明確新增的第三方方案、採購或資產依其新範圍處理；候選方案待報價或待 sample 不能當成「已證明無現成方案」。不以一般條款或本機文件缺席重開既有 Mika 授權確認。

## 本機可行性已查與未查

以 app 的 `Info.plist` 實際讀到 VRoidStudio 2.14.0 與 Blender 5.2.1，兩者已安裝。R1 在隔離 build 目錄下載並載入 VRM Add-on 4.7.1，沒有更新 app、安裝全域外掛或保存使用者設定。在 `/Users/charles/portfolio` 與 `/Users/charles/vtuber-kit` 搜尋 `.vroid`、`.vroidcustomitem`、`.xwear`，未找到匹配檔案；此結論只涵蓋這兩個目錄。

Studio 原生 editor 的 `.vroid` 工程檔與 `.vrm` 不同，不能把目前 Mika VRM 直接還原為原生臉型／髮型 slider 工程。[匯出 FAQ](https://vroid.pixiv.help/hc/en-us/articles/15760756822297-I-want-to-learn-more-about-the-VRM-export-feature) 不過 dress-up 模式明確支援 VRM 作為 base；因此仍可評估現有模型的 XWear 換裝，不應一概判為 Studio 無法讀取 VRM。[XWear 格式表](https://vroid.pixiv.help/hc/en-us/articles/39513229598233-What-is-XWear)

R1 已實際產生隔離往返模型與驗證收據，原始模型未修改；沒有呼叫生成 API、購買工具、上傳 Mika／客戶資產或對外聯絡。基本往返能力已測，完整品質、人工工時與平台整合保持未驗證。研究範圍覆蓋本文件候選的官方功能、格式、範例與條款，不構成對全市場「沒有其他方案」的斷言。

## 下一階段：Reuse-first bake-off

### R0：先鎖定權利與交付要求

2026-09-09 現況：**已驗證（使用者確認先前已完成驗證）**。使用者要求直接進入下一階段，後續不再詢問既有 pixiv／MellowHeart／平台使用的許可或以 source 補件阻擋。先前限定目錄搜尋結果保留為[歷史收據](../reports/mika-reuse-validation-2026-09-09.md)，不作為重開本案的依據。

R2 直接使用現有本機資產及成熟工具可建立的新 authoring fixture。檔案存在與可讀性按實測記錄；找不到舊 `.vroid` 時直接新建比較模型，不再要求使用者補件才能開始。既有權利已驗證與新候選模型的品質驗收分開記錄。

交付至少分為：VRM 本體、表情、可使用的 motion、可編輯 source／recipe、素材使用權。VRM 0 與 VRM 1 分開驗收；換裝與轉換後不沿用舊版通過紀錄。

### R1：先做最小的現成工具 round-trip

2026-09-09 實測完成：Blender 5.2.1 LTS＋VRM Add-on 4.7.1，在 22.02 秒輸出 VRM0；54 humanoid bones、56 face targets 名稱、15 expression binds 與 spring 引用保留，MToon 貼圖解碼像素相同。獨立結構檢查 PASS；嚴格 baseline 因 9 個 rounded rest positions 約 `1e-6 m` 差異保持 FAIL。輸出約 2.47 倍，已確認 PNG 轉碼與 sparse 展開；分件索引重排，未複製舊 sidecar。359 Python tests 通過，獨立 code／anti-pattern review 均 PASS；完整動作／物理及跨 consumer 品質未驗收。保留此工具作 authoring／automation 候選，正式替換為 `PENDING`。[完整 R1 報告](../reports/mika-reuse-validation-2026-09-09.md)

第一個技術試驗使用 Blender＋VRM Add-on 的官方 import／export 範例。在隔離目錄載入 Mika CONTROL，保持模型不做美術修改再匯出，檢查 humanoid、rest pose、inverse bind matrices、56 targets、15 expressions、貼圖、MToon、spring 及 three-vrm 載入。安裝套件若需要額外步驟，先確認官方版本相容與 code license。

依據與可複用 API：[Automation samples](https://vrm-addon-for-blender.info/en-us/scripting-api/) 的 `bpy.ops.import_scene.vrm(filepath=...)`、`bpy.ops.export_scene.vrm(filepath=...)`；成功回傳 `{'FINISHED'}`。沿用文件的錯誤處理，輸出路徑換成隔離目錄。這只建立格式往返基準，尚不取代現有 pipeline。

### R2：相同需求比成品與人工作業

本機 authoring 試驗已完成：control＋A／B／C 的 `.vroid`／VRM0 均已保存，四份各 14 expressions 與 10 clips 載入 probe 通過，另跑完十支 motion 掃描；CONTROL／C source 重新開啟成功。B 的 XWear 已回套 control、保存 `.xroid` 並匯出 VRM1，但自動遮蔽造成可見頸部缺口，品質 FAIL。四份原生模型的 Mika 專用 verify gate 也保持 FAIL；完整品質及人工成本尚未通過。詳見 [R2 執行紀錄](../reports/mika-r2-studio-2026-09-09.md)。R0 已驗證，不再重問；本輪無付費 API 或上傳。

先固定三份有權利的需求，再讓候選工具處理：一份新 bob＋臉型、一份服裝／配件替換、一份同角色換髮型與服裝但保留表情。第一組比較 Studio authoring 與上一輪 prototype；換裝比較 XWear／Modular Avatar；圖像輸入則比較 OCM 成品或 Tripo／Meshy。付費或外部上傳需另有核准的額度與資產範圍，未核准時標 `NOT_RUN`。

每份記錄：實際來源與版本、修改前後檔案、生成與重試次數、人工分鐘、四視角、blink／vowels、十支 motion、獨立模組替換後是否保留 identity、可編輯檔與資產權利。先比較有無完整交付，再比較品質與成本；禁止只憑工具 demo 或自動匯出成功判勝。三份是篩選實驗，完整 Phase 2 的十份原創需求仍保留。

### R3：採用現成流程，再處理具體缺口

R2 後決策：Studio native authoring 已證明可產生可編輯臉型／髮型／衣物變體，先用這條路徑保存經驗收資產；全自動 worker 與單位經濟尚未成立。XWear 的下一個試驗聚焦乾淨換裝 base 與內建 mesh restore，重驗頸部缺口，保留原始失敗檔。現有 Mika 構圖不能直接套用新 base，須建立專用 framing／motion allowlist；先沿用既有量測與成熟 authoring／retarget 工具。背面、完整 spring 與目標 consumer 仍須驗收。

2026-09-09 R3 限定試驗完成，見 [R3 執行報告](../reports/mika-r3-studio-2026-09-09.md)。採用官方 restore brush／Confirm 加上原生乾淨 base，已保存、重開 `.xroid`，並在匯出 VRM1 的獨立 MToon 畫面確認頸部缺口與舊 T-shirt 白色尖角消失，局部修復 `PASS`。最終 4 views／21 PNG／18 expressions、10 clips 數值掃描完成，13 組 motion／placement 數值候選；缺少專屬 crown clearance，正式 allowlist 保持空集合（其後已補上 clearance 三個模組裡的兩份，見下段）。Hoodie bent-arm edge growth 46.48 mm 超過既有 25 mm 門檻（其後已修復並套回原檔，該次量測的位元組保存為 `R3-B-clean-base-dressup-torn.vrm`），5 項 VRM0-only gate 不支援 VRM1，完整動態及交付保持 `PENDING`。R2 失敗樣本與 R3 partial 成品保留；自動遮蔽仍須人工 restore，未承諾任意設計全自動交付。

Hoodie 的 bent-arm 46.48 mm 已於同日修復，機制與量測見 [refit-0909](../../scripts/avatar/evidence/refit-0909.md)。這替 auto-fit 的判斷加上一項具體邊界：它在貼身處是對的，在寬版服裝飛離身體的地方沒有身體可以複製，於是把軀幹布料綁到手臂上。`scripts/avatar/refit.py` 能修這一類（`torn_bindings` FAIL→PASS，最壞邊 46.48→22.99 mm），代價是身體那邊仍要一份 manifest，樣本是一件衣服；`scripts/avatar/dressup.py` 已把它接成重新匯出後的入口，布料那邊改由 `verify.torn_bindings` 當場量出來。auto-mask 造成的頸部缺口是另一件事，仍須人工 restore。採用判斷維持不變：XWear 的 auto-fit 可用但需要下游修補，不能當成任意拓樸的安全保證。

同日補上 crown clearance 三個模組裡的兩份（`simulated` 與 `measured`），收據見 [parts-0909](../../scripts/avatar/evidence/parts-0909.md)。這替第三方匯出檔的可用性加上第二項具體邊界：Studio 的換裝成品會宣告一堆動不了的彈簧（16 組裡 9 條髮鏈、帽兜與兩條帽繩的節點都不在任何 skin 裡，只有胸部那 6 個節點有作用），所以頭髮是剛體，`parts.json` 也要人工寫。像素穿模 gate 原本卡在 `pierce.py` 寫死的兩個皮膚部件名（這具身體的皮膚分在三個 mesh 上），改成由 manifest 決定之後跑完，結果是 FAIL：帽 T 的胸口有一塊身體層穿出來，動態最差是上限的 5.19 倍。這是第三項邊界，Studio 的 auto-fit 換裝成品不保證不穿模。

商業採用邊界：先驗收固定 `base × module` 組合，保留可逆 source／mesh mask、來源 hash 及版本，僅將已驗收組合列入供應範圍。一次性模組整備人工與每單客製工時分開記錄，作為後續點數／單次／訂閱成本依據。單例修復結果尚未支持任意設計全自動交付，不先編定價格或毛利。

若 Studio authoring 品質與工時達標，先保存可編輯 source 及經確認的資產庫；平台是否能自動使用這批資產，獨立由權利與 automation gate 決定。若 Tripo／Meshy 成品通過相同 gate，採用其生成／綁定 API，保留 provider task ID、版本與費用。若自有 base 的跨體型適配仍是主要瓶頸，再針對 Popul8 Enterprise 取得必要文件與 sample，不能默認 Express 已能保留 VTuber 表情。

動作處理先研究現成 IK／constraint／bake 流程。Unity Animation Rigging 1.4.1 的 Bidirectional Motion Transfer 官方目前支援 Generic hierarchy，Humanoid 不支援；不可把它直接列為 Mika Humanoid 匯出修正方案。[官方限制](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/manual/BidirectionalMotionTransfer.html) 所有 runtime IK 都須另驗證可否 bake 成實際交付 motion；畫面內修好不代表匯出檔修好。

Final IK 作者文件確認 Baker 可錄製 Humanoid／Generic／Legacy clips，列為已知動作修正的候選。先試單支 scratchHead 的 IK target 修正、bake、重新載入與量測；尚未購入或驗證 Mika，外掛及部署授權需另確認。[作者 FAQ](https://rootmotion.freshdesk.com/support/solutions/articles/77000057785-faq)

恢復自研前，必須留下：已試方案與版本、官方參考、實際失敗樣本、失敗原因、既有擴充也無法補足的證據、最小實作範圍及回歸測試。保留現有 recipe、來源 hash、驗證與報告能力；幾何生成、綁定、匯出與物理優先採用現成方案。

## 本輪完成判定

已完成官方文件、R0 使用者確認結案、R1 隔離往返、R2 control＋三份 authoring 成品及 XWear 往返，以及 R3 乾淨 base／內建 restore 的兩項局部修復驗收。R3 重新執行 359 Python tests 通過，最終 source、VRM、靜態渲染與數值掃描證據已保存。完整品質、spring、consumer、人工作業比較與付費 API 尚未完成。保持 reuse-first，不恢復自研幾何或動作調參；既有權利事項不再作為待辦或阻擋。
