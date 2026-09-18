# 這個目錄留下什麼，以及 avatar 管線的文件去哪了

`scripts/avatar` 在 2026-09-17 搬到 `~/vtuber-kit`（commit `7a500d4`）。它的九份
plan 與十份 report 在這裡又留了一天，直到 09-18 刪掉，理由是兩邊各存一份、沒有任何
同步機制，而分叉已經開始發生：同一份 `mika-platform-validation.md` 在兩個 repo 裡已經
差了 17 行。一份會過期而且沒有人會發現的文件，比沒有這份文件更糟。

**`src/components/chat/` 底下有 23 行註解引用 `docs/plans/…` 與 `docs/reports/…`，
指的是 vtuber-kit 那個 repo 的同名路徑。** 兩個 repo 的佈局是鏡像的，所以路徑一字不差，
換 repo 就找得到。註解沒有逐行改成「vtuber-kit 的 docs/…」，因為其中四個檔
（`clearance.ts`、`avatarMotions.ts`、`avatarVariants.ts`、`avatarGuideEngine.ts`）是
兩個 repo 共用的引擎模組，由 vtuber-kit 的 `scripts/engine-drift.ts` 逐 byte 比對；
為了讓註解好讀而讓它們分叉，會用掉那個工具的訊噪比。

刪掉的十九份（git 歷史留著，`git log --diff-filter=D -- docs/plans docs/reports`
找到那個 commit，再 `git show <commit>^:<路徑>` 取回）：

- plans：`avatar-build-module-contracts`、`avatar-dress-any-body`、
  `avatar-families-vroid-samples`、`avatar-family-vrm1-twist-sample`、
  `avatar-fixture-seed-san`、`avatar-motion-capture`、
  `mika-existing-solutions-evaluation`、`mika-hair-face-prototypes`、
  `mika-platform-validation`
- reports：`mika-hair-face-prototypes-2026-09-09`、`mika-pink-atlas-fix-2026-09-14`
  （含四張 PNG）、`mika-platform-validation-2026-09-09`、`mika-r2-studio-2026-09-09`、
  `mika-r3-studio-2026-09-09`、`mika-reuse-validation-2026-09-09`

## 留在這裡的

`docs/plans/avatar-guide.md`、`docs/plans/mika-persona.md`、
`docs/plans/hero-laser-impact-scroll-dissolve.md` 講的是這個網站本身（角色嚮導的產品
決策、Mika 的語氣、hero 動畫），管線搬家跟它們無關。`rag/persona.ts` 直接在 prompt
字串裡引用 `mika-persona.md`，所以那一份更不能搬。
