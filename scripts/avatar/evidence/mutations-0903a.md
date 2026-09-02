# 後腦補髮改回根因之後的紅燈驗證（2026-09-02 深夜）

使用者指出前一版仍是「東補西補」，修正因此從「另做一片補上去」改成「twintail
不要把貼頭皮那層帶走」。這一份是新機制兩道防禦的收據。

原則同前：每道防禦單獨拔掉，對應那條測試必須自己轉紅；還原用位元組副本
（`shutil.copyfile`，不是 `git checkout --`，本輪修正尚未 commit）；替換腳本在
pattern 命中數 ≠ 1 時 assert 失敗，並在寫入後比對檔案內容確認 mutation 真的落
地才往下跑。

## 兩道防禦

`twintail.apply` 依「離體表距離」把後髮分成兩份，
`free = clip((d - 20mm) / 15mm, 0, 1)`：

1. **位置閘門** `fade = fade * free`：free=0 的頂點完全不被收進尾巴。
2. **權重改綁**：free<1 的頂點權重按 free 重新混合，缺的補成頭骨影響。

兩道各自獨立。只有第 1 道，貼頭層在靜止畫面上是對的，但基底檔裡它有 36 個頂點
掛著舊彈簧鏈（最大 8.4%），那條鏈轉換後就是尾巴鏈，尾尖位移 172mm，8.4% 等於
14mm 的漂移，動畫一播就把頭皮上的髮拖走。只有第 2 道，權重是對的但整片髮已經
被搬到側面，枕骨照樣裸露。

## 收據

| mutation | test_curtain_keeps_a_layer_lying_on_the_skull | test_scalp_layer_carries_no_tail_weight |
|---|---|---|
| M1 位置閘門拔除（`fade = fade * free` 整行刪掉） | **RED** | RED |
| M2 權重改綁拔除（`held = free < 1.0` → `free < 0.0`） | GREEN | **RED** |

粗體是該 mutation 對應的那一條。M1 連帶把權重那條也打紅，是因為它的取樣集合
（離體表 20mm 以內的髮簾頂點）在整片髮被搬走之後塌掉，那個 `assertGreaterEqual
(600)` 是防空轉的守衛。這不是互相遮蔽：兩道防禦各有一個 mutation 會打紅自己那
一條，任一道被拿掉都不可能全綠。M2 只打紅權重那條，證明權重防禦有自己的判準。

每次 mutation 都完整重建（rc=0、健檢 PASS），vertex sha 分別是 M1
`234dc15ae5298a9a`、M2 `5d6dcf2b4f2bfada`，與正確版的 `ae7f90eecb9784d9` 不同，
確認 mutation 確實進到出貨檔而不是只改了原始碼。還原後重建回
`ae7f90eecb9784d9`，五個測試模組 26 條全綠。

## 前一版收據的狀態

mutations-0902c.md 與 -0902d.md 記的是膚色、皇冠暖度、皇冠讓耳、外套 standoff
四項，那些判準與門檻本輪沒有改動，收據續用。-0902d.md 裡「掃髮帽色」那一格
（`test_nape_cap_matches_the_curtains`）已失效：該測試連同它守的那片補丁一起被
刪掉了，取代它的是本文這兩條。
