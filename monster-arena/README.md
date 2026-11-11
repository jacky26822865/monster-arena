# 元素獸競技場 Monster Arena

原創元素獸的 3D 即時動作對戰網頁遊戲。純靜態網頁，放在 GitHub Pages 就能玩，也能和朋友連線對戰（不需要伺服器）。

- **第三代（GBA）數值引擎**：能力值、傷害公式、17 屬性相剋、物理／特殊依屬性分類、能力等級 ±6、會心一擊、天氣、異常狀態
- **16 隻原創元素獸**，涵蓋全部 17 種屬性，另附 1 隻範例模組怪獸
- **LoL 式操作**：右鍵移動、QWER 施放，按住顯示範圍、放開施放；方向／落點／指定／自身四種技能類型
- **6 種場地**：星光競技場、翠綠草原、熔岩火山（岩漿）、冰封雪原（地面很滑）、天空神殿（沒有牆，會掉下去）、沙漠遺跡，也可以隨機
- **跳躍、二段跳、前跳**：可以跳過震波、站上障礙物、在空中下砸
- **連線對戰**：輸入同一個房號就能對打（PeerJS / WebRTC）
- **怪獸工坊**：自己捏怪獸（身體、部件、配色、種族值、特性、技能），可以匯出成 JSON 模組
- **照片貼臉**：上傳照片，照片會貼在怪獸的臉上，連線時對手也看得到
- 手機觸控（虛擬搖桿＋技能鈕）與實體手把

> 角色、技能名稱、美術全部為原創，不含任何任天堂／The Pokémon Company 的素材；只參考了第三代的數值與公式設計。

---

## 放上 GitHub Pages

1. 在 GitHub 建立新的 repository（例如 `monster-arena`），把這個資料夾的所有檔案上傳到 `main` 分支的根目錄
2. 到 repository 的 **Settings → Pages**
3. **Build and deployment** 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/ (root)`，按 Save
4. 等 1～2 分鐘，網址會是 `https://<你的帳號>.github.io/monster-arena/`

在網址後面加上 `?room=abc123`，房號欄會自動帶入，方便直接分享連結給朋友。

## 本機測試

```bash
cd monster-arena
python3 -m http.server 8000
# 打開 http://localhost:8000
```

- 直接雙擊 `index.html` 也能玩單人，但 `mods/` 資料夾的模組要用伺服器開才會載入
- **在同一台電腦測試連線**：開兩個分頁到 `http://localhost:8000/?local=1`，輸入同一個房號（這個模式用 BroadcastChannel，不經過網路）

## 操作

| | LoL 式（預設） | WASD 模式 |
|---|---|---|
| 移動 | 滑鼠右鍵點地面（按住可拖著走） | WASD |
| 技能 | Q W E R：按住顯示範圍，放開施放 | 1–4 或 滑鼠左／右鍵 |
| 跳躍 | Space（空中再按一次是二段跳；移動中起跳會往前跳） | Space |
| 閃避 | D（往滑鼠方向） | Shift |
| 換人 | F | Tab |

- **方向技**：往滑鼠方向射出或衝出。**落點技**：在滑鼠位置延遲爆發。**指定技**（必中技）：自動鎖定對手，太遠會先走過去再放。**自身技**：按下立刻生效
- 手機：橫放；左半邊按住拖曳＝搖桿；技能鈕點一下自動瞄準，按住拖曳自己瞄準
- 手把：左搖桿移動、右搖桿瞄準、A 跳、B 閃避、X/Y/LB/RB 技能、Back 換人、Start 暫停

## 專案結構

```
index.html          入口與所有畫面
css/style.css       樣式
js/data.js          屬性、相剋、性格、特性、技能、怪獸資料，以及共用公式
js/maps.js          場地
js/mods.js          模組載入、自訂怪獸、連線時同步怪獸定義
js/engine.js        戰鬥引擎（第三代公式＋即時制規則）
js/ai.js            電腦對手
js/models.js        3D 模型（部件式程序化模型、照片貼臉、GLB 外部模型）
js/render.js        3D 場景、特效、鏡頭、範圍指示
js/hud.js           對戰介面
js/input.js         鍵盤滑鼠、觸控、手把
js/net.js           連線對戰（PeerJS、房主權威、狀態快照）
js/ui.js            標題、大廳、選角、場地、怪獸工坊、結算
js/main.js          主迴圈
mods/               模組資料夾（index.json 列出要載入的檔案）
```

## 連線架構

- 同一個房號＝同一局，先進房的玩家是**房主**
- **房主權威**：戰鬥只在房主的瀏覽器計算；挑戰者只送出操作（移動方向、面向、施放），房主每秒回傳 30 次狀態快照與事件（傷害數字、特效、紀錄）
- 這樣兩邊的結果不會分歧，也比較難作弊；代價是挑戰者的操作有一點延遲（約等於兩人之間的網路延遲）
- 配對使用 PeerJS 的公用服務，連線後玩家之間直接傳資料；連不上時多半是網路擋住了直連（行動網路、公司或學校網路），可以換 Wi-Fi

---

## 自己做怪獸

### 方法一：遊戲內的怪獸工坊

標題畫面 → 怪獸工坊。調整身體、部件、配色、屬性、種族值（合計上限 600）、特性、性格和 4 個技能，按「儲存」就會出現在選角畫面（存在瀏覽器裡）。按「匯出 JSON」可以得到模組檔。

### 方法二：寫模組 JSON 放進 `mods/`

1. 建立 `mods/我的怪獸.json`
2. 在 `mods/index.json` 的 `mods` 陣列加上檔名
3. 推上 GitHub，所有人打開遊戲都會看到

範例（見 `mods/example-starcat.json`）：

```json
{
  "name": "我的模組",
  "author": "你的名字",
  "moves": {
    "starbeam": { "name": "星光束", "type": "PSYCHIC", "power": 75, "acc": 100, "pp": 15,
                  "shape": "proj", "spd": 620, "r": 12, "range": 560 }
  },
  "species": [{
    "id": "starcat",
    "name": "星光貓",
    "types": ["PSYCHIC", "FLYING"],
    "base": { "hp": 72, "atk": 70, "def": 68, "spa": 108, "spd": 92, "spe": 110 },
    "ability": "同步",
    "nature": "膽小",
    "evs": { "hp": 4, "spa": 252, "spe": 252 },
    "moves": ["starbeam", "wingdash", "calmmind", "roost"],
    "look": { "body": "round", "parts": ["bigEars", "gem", "smallWings"], "legs": "two", "arms": false,
              "acc": "#9fd8ff", "color": "#c9b6ff" }
  }]
}
```

**欄位說明**

| 欄位 | 說明 |
|---|---|
| `id` | 英文小寫、數字、`-`、`_`，不能和內建怪獸重複 |
| `types` | 1～2 個：`NORMAL FIRE WATER ELECTRIC GRASS ICE FIGHTING POISON GROUND FLYING PSYCHIC BUG ROCK GHOST DRAGON DARK STEEL` |
| `base` | 種族值 1～255 |
| `evs` | 努力值，每項最多 252、總和最多 510 |
| `ability` | 特性名稱（見 `js/data.js` 的 `ABIL`），沒有就填 `無` |
| `moves` | 4 個技能 id，可以用內建技能（見 `js/data.js` 的 `MOVES`）或模組裡新增的技能 |
| `look.body` | `round` 圓滾滾、`tall` 高個子、`blob` 軟糊糊、`wisp` 幽靈、`shell` 甲殼 |
| `look.parts` | 部件陣列，可用值見 `js/data.js` 的 `PARTS`（例如 `mane` `ears` `horns` `wings` `longTail` `cap` `wool`…） |
| `look.legs` | `two`、`four`、`none`（none＝漂浮） |
| `look.color` / `look.acc` | 主色／配色（不填主色就用屬性色） |
| `model` | （選填）外部 GLB 模型路徑，例如 `mods/models/mycat.glb` |
| `scale` / `modelYaw` | （選填）模型縮放、轉向（弧度） |

**技能欄位**：`type`、`power`（0＝變化技）、`acc`（0＝必中，會變成指定技）、`pp`、`pri`（先制度）、`shape`（`proj` 射擊、`melee` 近戰、`dash` 突進、`aoeSelf` 自身範圍、`zone` 落點、`self` 自身、`blink` 瞬移），以及 `range` `radius` `reach` `arc` `dist` `spd` `r` 等形狀參數。附加效果：`eff: { burn, para, frz, psn, flinch, statDown:{s,ch}, selfUp:{s,ch} }`、`status`（`PAR` `SLP` `TOX` `SEED`）、`drop:{s,n}`、`buff:{atk:2}`、`heal`、`drain`、`recoil`、`contact`、`highCrit`。

### 方法三：用自己的 3D 模型（GLB）

1. 用 Blender（免費）或其他工具做模型，匯出成 **glTF Binary（.glb）**
2. 放到 `mods/models/`，在怪獸定義加上 `"model": "mods/models/xxx.glb"`
3. 模型會自動縮放到合適大小；如果檔案裡有名稱含 `Idle`、`Walk`／`Run` 的動畫，會自動依移動速度切換
4. 面向不對時用 `modelYaw` 調整（例如 `3.1416` 轉 180 度）

**做模型的工具**

| 工具 | 適合 | 費用 |
|---|---|---|
| Blender | 最完整：建模、上色、骨架、動畫，匯出 GLB | 免費 |
| MagicaVoxel | 像素方塊風格，最好上手 | 免費（匯出後用 Blender 轉 GLB） |
| Meshy／Tripo／Rodin | 用文字或一張圖片 AI 生成 3D 模型，直接匯出 GLB | 有免費額度 |
| Mixamo | 幫人形模型自動綁骨架＋套動作 | 免費（需 Adobe 帳號） |

> 自己做或 AI 生成的原創角色都沒問題；如果模型是照著現有商業作品的角色做的，放上公開的 GitHub 可能會收到侵權下架通知。

## 授權

程式碼採 MIT 授權（見 `LICENSE`）。使用的函式庫：three.js（MIT）、PeerJS（MIT）。
