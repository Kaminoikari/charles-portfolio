control and mutations, at rest (pierce.py) and inside the body (inside.py):
| garment | mutation | pierce ratio (px) | inside n/total (deepest mm) |
|---|---|---|---|
| Outfit_Top | control | 0.00 (0) | 0/313 (0.0) |
| Outfit_Top | sink 25mm | 34.05 (4015) | 237/313 (21.9) |
|  | pierce gate | control PASS, mutation FAIL | |
| Outfit_Socks | control | 0.00 (0) | 1/307 (8.3) |
| Outfit_Socks | sink 25mm | 9.76 (398) | 142/307 (26.9) |
|  | pierce gate | control PASS, mutation FAIL | |
| Outfit_Bottom | control | 0.00 (0) | 0/307 (0.0) |
| Outfit_Bottom | sink 25mm | 6.31 (946) | 82/307 (20.4) |
|  | pierce gate | control PASS, mutation FAIL | |
| Outfit_Cardigan | control | 0.03 (4) | 0/303 (0.0) |
| Outfit_Cardigan | sink 25mm | 6.35 (953) | 16/303 (13.2) |
|  | pierce gate | control PASS, mutation FAIL | |
| Outfit_Shoes | control | 0.01 (1) | 2/301 (14.2) |
| Outfit_Shoes | shrink 0.9 | 4.01 (132) | 9/301 (19.3) |
|  | pierce gate | control PASS, mutation FAIL | |

motion.py (the ten clips, 4 frames each, 3 views), the bodice sunk 25mm:
  control  worst 0.02x (2 px of 104, playFingers.vrma t=0.6s)
  sunk     worst 36.79x (2892 px of 79, idleLoop.vrma t=3.89s)
  motion gate: control PASS, mutation FAIL  (1124s)

ALL SEPARATE
