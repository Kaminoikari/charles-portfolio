# 第三版檔案內數字的重新量測（2026-09-02 收尾；spec reviewer 第一輪指出未落檔，補跑並存證）

量測腳本逐字如下，輸出緊接其後。對象：出貨檔 out/mika-milfy.vrm（95b79fd3910eb98a）
與第二版位元組 out/milfy.rerun.vrm（b2de2d7dcd48fdbd）。
```
import json
import numpy as np
import glb

def stats(model, manifest_path, label):
    doc, binary = glb.load(model)
    views = glb.views_of(doc, binary)
    parts = json.load(open(manifest_path))['parts']
    info = parts['Acc_Bandage_Thigh']
    mesh = next(m for m in doc['meshes'] if m.get('name') == info['mesh'])
    P = np.vstack([glb.read_accessor(doc, views, mesh['primitives'][i]['attributes']['POSITION'])
                   for i in info['primitives']])
    print(f'[{label}] Acc_Bandage_Thigh x 範圍 {P[:,0].min():.4f} .. {P[:,0].max():.4f}（{len(P)} 點）')
    for me in doc['meshes']:
        tn = (me.get('extras') or {}).get('targetNames') or []
        for i, name in enumerate(tn):
            if 'Hutomomo' not in name:
                continue
            best = 0.0; moved = 0; tot = 0
            for pr in me['primitives']:
                tg = pr.get('targets')
                if not tg or 'POSITION' not in tg[i]:
                    continue
                d = glb.read_accessor(doc, views, tg[i]['POSITION'])
                n = np.linalg.norm(d, axis=1)
                best = max(best, n.max()); moved += int((n > 1e-9).sum()); tot += len(n)
            print(f'[{label}] {me.get("name")} {name}: 最大位移 {best*1000:.2f}mm 動 {moved}/{tot}')
    sec = doc['extensions']['VRM']['secondaryAnimation']
    for g in sec['boneGroups']:
        names = [doc['nodes'][b].get('name', '') for b in g.get('bones', [])]
        if any(n.startswith('HairTail') for n in names):
            print(f'[{label}] 雙馬尾彈簧 hitRadius {g.get("hitRadius")} colliderGroups {g.get("colliderGroups")}')
    print(f'[{label}] boneGroups 共 {len(sec["boneGroups"])} 組')

stats('out/mika-milfy.vrm', 'out/mika-milfy.parts.json', '第三版')
stats('out/milfy.rerun.vrm', 'out/mika-milfy.parts.json', '第二版')
```

輸出：
```
[第三版] Acc_Bandage_Thigh x 範圍 -0.1137 .. -0.0063（3843 點）
[第三版] Body.baked Hutomomo_big: 最大位移 5.24mm 動 3839/58815
[第三版] Body.baked Hutomomo_slim: 最大位移 4.48mm 動 3843/58815
[第三版] 雙馬尾彈簧 hitRadius 0.035 colliderGroups []
[第三版] boneGroups 共 4 組
[第二版] Acc_Bandage_Thigh x 範圍 -0.1466 .. -0.0076（3843 點）
[第二版] Body.baked Hutomomo_big: 最大位移 7.00mm 動 3839/58815
[第二版] Body.baked Hutomomo_slim: 最大位移 5.48mm 動 3843/58815
[第二版] 雙馬尾彈簧 hitRadius 0.09636338 colliderGroups [3, 4, 7, 5, 8, 6, 9, 1, 0, 2]
[第二版] boneGroups 共 11 組
```

x 範圍與當年收據互相印證（EVIDENCE.md:162 的 -0.1466..-0.0076），證明部件→primitive
索引在兩版間解到同一個東西。

位移量則揭出一個定義錯位：第二版節記的 5.97mm／4.68mm（動 3098/3101）是 graft 當下在
服裝自身空間量的位移場；本腳本量的是出貨檔 Body.baked 上最終 morph target 的位移
（動 3839/58815），第二版檔內值是 7.00mm／5.48mm。兩者不是同一個數。同定義的比較是
7.00→5.24、5.48→4.48，比值 0.749／0.817，與 fit_ring_to_limb 的 xz 各向縮放相容。
RESULT.txt 第三版一節第一稿把 5.24/4.48 對上 5.97/4.68 是拿兩個定義互比，已改。
