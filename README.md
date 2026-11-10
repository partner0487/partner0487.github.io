# partner0487.github.io

我的個人網站：https://partner0487.github.io

這裡除了放自我介紹，也是我試各種網頁想法的地方。想到什麼新東西就做成一個區塊塞進來，所以每一塊背後幾乎都有一個想試的功能。

一開始是用 Nicepage 模板搭出外框（2025/02），之後的區塊都是自己加的。2026/11 把 Nicepage 的 JS 和 CSS 拿掉，現在整個網站是純 HTML / CSS / JavaScript，沒有用框架。

## 各區塊做了什麼

網站分成四頁：首頁、關於、作品、興趣。

### 首頁（[index.html](index.html)）

**自我介紹**
- **彈跳 blob 背景**：幾個模糊的彩色圓用 `requestAnimationFrame` 在畫面裡亂跑，碰到邊界就反彈。（[js/blob.js](js/blob.js)）
- 社群圖示列：GitHub、FB、IG、Discord、Threads、TikTok、Twitch

**My Project（傳送門）**
- **3D 模型嵌入**：用 three.js 載入 Minecraft 寶箱的 GLB 模型（[js/chest.js](js/chest.js)）
  - 滑鼠移動時寶箱會跟著轉
  - 滑鼠移上去會播放開箱動畫
- 點寶箱會播一段傳送門影片，再跳到作品頁

### 關於（[about.html](about.html)）

**研究方向、學歷**
- 學校 logo 可以點，連到系網站；地點連到 Google 地圖

**個人程式能力面板**
- 做成 RPG 角色面板：先看等級，百分比是升到下一級的進度
- **數字雨背景**：用 canvas 畫駭客任務那種往下掉的字元。（[js/skill.js](js/skill.js)）
- **捲到才播動畫**：用 `IntersectionObserver` 偵測面板進入畫面，經驗條和技能條才開始跑數字

### 作品（[project.html](project.html)）
- 從 [data/projects.json](data/projects.json) 讀取作品，依「實驗室計畫、碩士課程、個人專案、大學課程」分類，上方按鈕可以篩選
- 新增作品只要改 JSON
- 早期版本是用 GitHub API 抓所有 repo、依程式語言篩選。後來改成自己整理，因為 API 有次數限制，也會抓到不想放的 repo

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
- **Google 翻譯**：左上角 logo 旁邊可以切換繁中、簡中、英文、日文（[js/language.js](js/language.js)）
- **手機版選單**：[js/site.js](js/site.js) 負責漢堡選單、響應式斷點、標示目前頁面。這是拿掉 Nicepage 之後自己寫的替代版
- **footer**：社群連結和 Email

## 專案結構

```
index.html          首頁
about.html          關於：研究方向、學歷、能力面板
project.html        作品
interests.html      興趣：遊戲、動漫
css/                各區塊的樣式；base.css 是從 Nicepage 精簡下來的共用樣式，site.css 是每頁共用的 footer 等
js/                 各區塊的程式
images/             profile、social、schools、games、projects 五類圖片
videos/             傳送門影片和遊戲背景影片
models/             3D 模型
data/               作品和動漫清單的資料
```

## 在本機執行

作品頁和動漫清單會用 `fetch` 讀 JSON，直接雙擊打開 HTML 會被瀏覽器擋，要開一個本機伺服器：

```bash
python -m http.server
```

然後打開 http://localhost:8000
