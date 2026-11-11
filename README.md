# partner0487.github.io

我的個人網站：https://partner0487.github.io

這裡除了放自我介紹，也是我試各種網頁想法的地方。想到什麼新東西就做成一個區塊塞進來，所以每一塊背後幾乎都有一個想試的功能。

一開始是用 Nicepage 模板搭出外框（2025/02），之後的區塊都是自己加的。2026/11 把 Nicepage 的 JS 和 CSS 拿掉，現在整個網站是純 HTML / CSS / JavaScript，沒有用框架。

## 各區塊做了什麼

網站分成三頁：首頁、關於、興趣。作品放在首頁的寶箱裡。

### 首頁（[index.html](index.html)）

**自我介紹**
- **彈跳 blob 背景**：幾個模糊的彩色圓用 `requestAnimationFrame` 在畫面裡亂跑，碰到邊界就反彈。（[js/blob.js](js/blob.js)）
- 社群圖示列：GitHub、FB、IG、Discord、Threads、TikTok、Twitch

**My Project（開箱掉寶）**
- **3D 模型嵌入**：用 three.js 載入 Minecraft 寶箱的 GLB 模型（[js/chest.js](js/chest.js)）。three.js 是 r170，用 `importmap` 以 ES module 從 CDN 載入
  - 滑鼠移動時寶箱會跟著轉，移上去蓋子會打開（用動畫權重在關閉和打開的姿勢之間補間）
- **點寶箱開箱**：讀 [data/projects.json](data/projects.json)，每個作品變成一個掉落物，從箱口沿拋物線噴出、落在寶箱周圍浮動
  - 落點是先在螢幕上找寶箱周圍的空位，再用 raycasting 換算回 3D 座標，所以手機和桌機都排得下
  - 滑鼠移到作品上顯示名稱
  - **點作品**：用 `camera.setViewOffset` 把寶箱和掉落物整個平移到左邊，右邊滑出那個作品的卡片（手機改成卡片從下面滑上來）。點空白處、按 Esc 或 × 收起
  - 再點寶箱，作品會飛回去
  - 網址 `#projects` 會自動開箱，`#projects/<repo>` 會再打開那個作品的卡片
- 新增作品只要改 [data/projects.json](data/projects.json)
- 演變：一開始點寶箱是播傳送門影片再跳到作品頁；後來作品頁整個合併進寶箱

### 關於（[about.html](about.html)）

**研究方向、學歷**
- 學校 logo 可以點，連到系網站；地點連到 Google 地圖

**RPG 角色面板**
- 做成經典 JRPG 的視窗（深藍漸層、白框、像素字型 DotGothic16），資料在 [data/character.json](data/character.json)（[js/status.js](js/status.js)）
  - **角色**：像素頭像（自己的 OC 轉成 48×48 的像素圖，images/profile/oc-pixel.png）、職業（`classPath` 轉職路線：初心者 → 一轉 → 二轉，點職業可以看轉職紀錄）、稱號、ARPG 屬性（左欄有顏色：HP 熱情、MP 點子、VIT 體力、LUK 幸運、CHA 魅力；右欄紫色：STR 實作、INT 智力、SPD 速度、PER 眼力、ELO 口才；條的顏色寫在 `color`）和遊戲屬性（`gamer`：定位「大腦型玩家」，TAC 博弈、DEX 操作、ACC 準度）；等級 = 從 `startedCoding` 開始寫程式到現在的月數，EXP 條是這個月過了幾天
  - **寵物**：`pets` 一隻一欄，桌機排三欄（`null` 的位置留空）。小樹累了就捲成一球睡覺，小奈會翻肚子討摸、冒愛心；`sprite` 對到 js/status.js 裡的 `PET_SPRITES`；圖是照片照著畫的，在 js/status.js 裡用字串一格一格畫。只有切到這一頁、而且面板在畫面上時才跑動畫
  - **技能**：等級 = 實際有在寫的月數 = `base`（到 `githubFrom` 為止手動估的月數，一學期的課算 6）＋ 之後 GitHub 上有 commit 改到這個語言檔案的月份；Git 則是有 commit 的月份數。GitHub 的部分由 [scripts/github_activity.py](scripts/github_activity.py) 統計成 [data/github-activity.json](data/github-activity.json)，GitHub Action（[.github/workflows/github-activity.yml](.github/workflows/github-activity.yml)）每週一自動跑一次，有變化才 commit。依等級排序，進度條是跟最高等技能的比例；選一個技能，下方對話框會用打字機效果說明，並列出用它做過的作品，點了打開首頁寶箱的那張卡片
  - **成就**：徽章，還沒達成的顯示「???」；有 `image` 的成就（右上角 ✦）可以點開看獎狀或證書，圖放在 images/achievements（上傳前先遮掉身分證字號、生日、學號等個資）
  - 可以用鍵盤操作：← → 換分頁、↑ ↓ 移動、Enter 選擇；點對話框直接顯示完整文字
  - 捲到面板才開始跑數字和進度條（`IntersectionObserver`）
- **數字雨背景**：用 canvas 畫駭客任務那種往下掉的字元，用 `ResizeObserver` 跟著面板大小重設（[js/matrix.js](js/matrix.js)）
- 小坑：DotGothic16 是日文字型，沒有繁體的「狀」「值」等字，所以分頁叫「角色」不叫「狀態」；缺的字會改用 Noto Sans TC 顯示

### 以前的作品頁
- 一開始用 GitHub API 抓所有 repo、依程式語言篩選。後來改成自己整理在 JSON，因為 API 有次數限制，也會抓到不想放的 repo
- 之後用 **Vue 3**（CDN）改寫過一次，練習 `ref`、`computed`、`v-for`。現在作品都放進首頁的寶箱了，那個版本留在 git 歷史裡
- [project.html](project.html) 現在只負責把舊連結轉到首頁的寶箱

### 興趣（[interests.html](interests.html)）

**I'm a Gamer**
- 點右邊的遊戲 icon：
  - 背景影片會淡出再換成那款遊戲的影片
  - 左邊卡片會有上下捲動的切換動畫
- 有詳細圖的遊戲會顯示圖片，點圖片可以放大
- 手機版的動畫方向跟桌機不同（[js/gamer.js](js/gamer.js)）

**我的動漫清單**
- 這塊主要是拿來練**讀檔和搜尋**，剛好包裝成我的動漫紀錄
- 用 `fetch` 讀 [data/anime.json](data/anime.json)，依年份和觀看狀態分類
- 搜尋：按 Enter 後找到的卡片會 highlight 並自動捲過去
- 每一列可以用滑鼠拖曳左右滑動，也可以按左右按鈕

### 每一頁都有
- **手機版選單**：[js/site.js](js/site.js) 負責漢堡選單、響應式斷點、標示目前頁面。這是拿掉 Nicepage 之後自己寫的替代版
- **字型**：Google Fonts 載入 Roboto、Open Sans 和 Noto Sans TC（400、700）。英文用前兩個，中文一律用 Noto Sans TC，不同電腦和手機看起來才會一樣；Google 把中文字型切成很多小塊，瀏覽器只下載頁面用到的字
- **footer**：社群連結和 Email
- **個性簽名**：首頁自我介紹結尾和每頁 footer 的「P4RTNER」。[images/profile/signature.webp](images/profile/signature.webp) 只當 CSS 遮罩用（`mask`），顏色由 CSS 決定：淺色深藍黑、深色米白、footer 一律白色；捲到時用 `clip-path` 由左往右「寫」出來（js/site.js），系統設定減少動態效果的人會直接顯示
- **深色模式**：預設跟著系統主題，導覽列的太陽 / 月亮按鈕可以手動切換，選擇存在 `localStorage`。主題在 `<head>` 裡的一小段 script 就先決定好（寫在 `<html data-theme>`），才不會先閃一下白畫面。樣式集中在 [css/dark.css](css/dark.css)；寶箱的 3D 背景和數字雨是在 JS 裡畫的，聽 `themechange` 事件重畫

## 專案結構

```
index.html          首頁
about.html          關於：研究方向、學歷、能力面板
project.html        舊作品頁，轉到首頁的寶箱
interests.html      興趣：遊戲、動漫
css/                各區塊的樣式；base.css 是從 Nicepage 精簡下來的共用樣式，site.css 是每頁共用的 footer 等
js/                 各區塊的程式
images/             profile、social、schools、games、projects、lang（程式語言 icon）、achievements（獎狀）、favicon
videos/             遊戲背景影片
models/             3D 模型
data/               作品、動漫清單、角色面板、GitHub 活動的資料
scripts/            github_activity.py：統計 GitHub 上各語言有寫的月份
```

## 在本機執行

作品頁和動漫清單會用 `fetch` 讀 JSON，直接雙擊打開 HTML 會被瀏覽器擋，要開一個本機伺服器：

```bash
python -m http.server
```

然後打開 http://localhost:8000
