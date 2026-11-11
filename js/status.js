// 關於頁的 RPG 角色面板（經典 JRPG 視窗風格）
// 資料在 data/character.json；這裡把它畫成「狀態 / 技能 / 成就」三個分頁，
// 下方的對話框用打字機效果顯示說明。
//
// 操作：點分頁或用 ← → 切換；在列表裡用 ↑ ↓ ← → 移動、Enter 選擇；點對話框可以直接顯示完整文字。

(() => {
  const root = document.getElementById("status-panel");
  if (!root) return;

  const langNames = { python: "Python", dart: "Dart", react: "React", kotlin: "Kotlin", html: "HTML", java: "Java" };
  const slug = (project) => project.links[0].url.replace(/\/+$/, "").split("/").pop().toLowerCase();

  // 小工具：建立元素
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // 分格的進度條：segments 格，填滿 filled 格
  function segBar(segments, kind) {
    const bar = el("div", `rpg-bar rpg-bar-${kind}`);
    for (let i = 0; i < segments; i++) bar.append(el("span"));
    return bar;
  }

  function fillBar(bar, ratio, delay = 0) {
    const cells = bar.children;
    const filled = Math.round(ratio * cells.length);
    [...cells].forEach((cell, i) => {
      cell.classList.remove("on");
      if (i < filled) setTimeout(() => cell.classList.add("on"), delay + i * 40); // 一格一格亮起來
    });
  }

  // 數字從 0 跑到目標值
  function countUp(node, to, format = (v) => v, duration = 900) {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      node.textContent = format(Math.round(to * t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- 對話框：打字機效果 ----
  let typingTimer = null;
  let typingFull = null;
  function say(message, extra) {
    const box = root.querySelector(".rpg-message-text");
    const more = root.querySelector(".rpg-message-extra");
    clearInterval(typingTimer);
    box.textContent = "";
    more.replaceChildren();
    more.hidden = true;
    typingFull = () => {
      clearInterval(typingTimer);
      typingTimer = null;
      box.textContent = message;
      if (extra) {
        more.append(extra);
        more.hidden = false;
      }
      root.classList.remove("rpg-typing");
    };
    const chars = [...message];
    let i = 0;
    root.classList.add("rpg-typing");
    typingTimer = setInterval(() => {
      box.textContent += chars[i++] || "";
      if (i >= chars.length) typingFull();
    }, 28);
  }

  // ---- 頭像：自己的 OC 轉成 48×48 的像素圖（images/profile/oc-pixel.png），畫面上放大 2 倍 ----
  function avatar(src, alt) {
    const img = el("img", "rpg-avatar");
    img.src = src;
    img.alt = alt;
    img.width = img.height = 96;
    img.decoding = "async";
    return img;
  }

  // 性別：♂ / ♀ 加上 U+FE0E，強制用文字樣式顯示（不然有些手機會變成彩色 emoji），再上男生藍 / 女生粉
  function genderSign(v) {
    const sign = v === "♂" ? "male" : v === "♀" ? "female" : "";
    return sign ? el("span", `rpg-gender rpg-gender-${sign}`, v + "︎") : document.createTextNode(v);
  }

  // ---- 三個分頁 ----
  function buildStatus(c) {
    // 角色等級 = 從開始寫程式（startedCoding）到現在的月數，每個月 1 號升一級；EXP 是這個月過了幾天
    const now = new Date();
    const [sy, sm] = c.startedCoding.split("-").map(Number);
    c.level = (now.getFullYear() - sy) * 12 + (now.getMonth() + 1 - sm);
    c.nextExp = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    c.exp = now.getDate() - 1;
    const page = el("div", "rpg-page");
    const hero = el("div", "rpg-hero");
    const info = el("dl", "rpg-info");
    const row = (k, v, cls) => {
      info.append(el("dt", "", k));
      const dd = el("dd", cls || "", v);
      info.append(dd);
      return dd;
    };
    row("名字", c.name);
    if (c.uid) row("UID", c.uid, "rpg-uid");
    if (c.gender) row("性別", "").append(genderSign(c.gender));
    // 職業：轉職路線的最後一階；點了在對話框看完整的轉職紀錄
    const path = c.classPath || [];
    const job = row("職業", "");
    const jobBtn = el("button", "rpg-class");
    // 「二轉・」和職業名各自不斷行，螢幕窄的時候只會在「・」後面換行
    if (path.length) jobBtn.append(el("span", "rpg-nowrap", `${path[path.length - 1].rank}・`));
    jobBtn.append(el("span", "rpg-nowrap", c.class));
    jobBtn.type = "button";
    jobBtn.addEventListener("click", () =>
      say("轉職紀錄：" + path.map((p) => `【${p.rank}】${p.name}：${p.desc}`).join(" → ") + "。下一次轉職：畢業之後再看看。")
    );
    job.append(jobBtn);
    row("稱號", `「${c.title}」`, "rpg-title");
    const lv = row("等級", `Lv. ${c.level}`, "rpg-level");
    hero.append(avatar("images/profile/oc-pixel.png", `${c.name} 的 OC`), info);

    const exp = el("div", "rpg-exp");
    const expHead = el("div", "rpg-exp-head");
    expHead.append(el("span", "rpg-label", "EXP"));
    const expNum = el("span", "rpg-num", `0 / ${c.nextExp}`);
    expHead.append(expNum);
    const expBar = segBar(20, "exp");
    exp.append(expHead, expBar, el("p", "rpg-hint", `從 ${sy} 年 ${sm} 月開始寫程式，每個月升一級；再 ${c.nextExp - c.exp} 天升到 Lv. ${c.level + 1}`));

    const attrs = el("ul", "rpg-list rpg-attrs");
    c.attributes.forEach((a) => {
      const li = el("li");
      const btn = el("button", "rpg-row");
      btn.type = "button";
      const num = el("span", "rpg-num", "0");
      // ARPG 的屬性名稱（HP、MP、STR…）+ 對應到我身上的意思（熱情、點子、實作力…）
      const name = el("span", "rpg-name");
      if (a.stat) name.append(el("span", "rpg-stat", a.stat), " ");
      name.append(a.name);
      btn.append(name, segBar(10, `attr rpg-bar-${a.color || "purple"}`), num);
      btn.addEventListener("click", () => select(btn, () => say(`${a.stat ? a.stat + "（" + a.name + "）" : a.name} ${a.value}：${a.desc}`)));
      li.append(btn);
      attrs.append(li);
      a._bar = btn.querySelector(".rpg-bar");
      a._num = num;
    });

    attrs.style.setProperty("--rows", Math.ceil(c.attributes.length / 2)); // 桌機排兩欄，每欄幾列
    page.append(hero, exp, el("h3", "rpg-sub", "屬性"), attrs);

    // 玩家屬性：三個並排的小格子（博弈、操作、準度），標題後面是玩家定位
    const gamerStats = (c.gamer && c.gamer.stats) || [];
    if (gamerStats.length) {
      const head = el("h3", "rpg-sub", "遊戲屬性");
      const role = el("button", "rpg-role", c.gamer.role);
      role.type = "button";
      role.addEventListener("click", () => say(`【${c.gamer.role}】${c.gamer.desc}`));
      head.append(role);
      const grid = el("ul", "rpg-gstats");
      gamerStats.forEach((g) => {
        const li = el("li");
        const btn = el("button", "rpg-gstat");
        btn.type = "button";
        const num = el("span", "rpg-num", "0");
        const top = el("span", "rpg-gstat-head");
        top.append(el("span", "rpg-stat", g.stat), el("span", "rpg-gstat-name", g.name), num);
        btn.append(top, segBar(10, "attr rpg-bar-game"));
        btn.addEventListener("click", () => select(btn, () => say(`${g.stat}（${g.name}）${g.value}：${g.desc}`)));
        li.append(btn);
        grid.append(li);
        g._bar = btn.querySelector(".rpg-bar");
        g._num = num;
      });
      page.append(head, grid);
    }

    page._reveal = () => {
      fillBar(expBar, c.exp / c.nextExp);
      countUp(expNum, c.exp, (v) => `${v} / ${c.nextExp}`, 600);
      [...c.attributes, ...gamerStats].forEach((a, i) => {
        fillBar(a._bar, a.value / 100, 300 + i * 100);
        countUp(a._num, a.value);
      });
    };
    page._intro = () => say(`${c.name} ── ${c.class}。腦袋裡的點子很多，想到就會動手做做看。`);
    return page;
  }

  // 技能等級 = 實際有在寫的月數：
  //   base：到 githubFrom 為止累積的月數（手動填，一學期的課算 6）
  //   + GitHub 上 githubFrom 之後有 commit 改到這個語言的月份（data/github-activity.json，每週自動更新）
  // Git 比較特別：有 commit 的月份全部都算。
  function skillLevels(c, activity) {
    c.skills.forEach((s) => {
      if (s.github === "*") {
        s.gh = activity.commitMonths.length;
        s.level = s.gh;
      } else {
        s.gh = (activity.languages[s.github] || []).filter((m) => m >= c.githubFrom).length;
        s.level = (s.base || 0) + s.gh;
      }
    });
    c.skills.sort((a, b) => b.level - a.level);
  }

  function buildSkills(c, projects) {
    const page = el("div", "rpg-page");
    const list = el("ul", "rpg-list rpg-skills");
    c.skills.forEach((s) => {
      const li = el("li");
      const btn = el("button", "rpg-row");
      btn.type = "button";
      btn.append(el("span", "rpg-name", s.name), segBar(10, "skill"), el("span", "rpg-num", `Lv. ${s.level}`));
      btn.addEventListener("click", () =>
        select(btn, () => {
          const used = projects.filter((p) => s.langs.includes(p.lang));
          const how = s.github === "*"
            ? `有 ${s.gh} 個月有 commit。`
            : `${s.from}，累積 ${s.base} 個月` + (s.gh ? `，之後 GitHub 上又寫了 ${s.gh} 個月。` : "。");
          const text = `${s.name} Lv. ${s.level}：${s.github === "*" ? `${s.from}，` : ""}${how}` +
            (used.length ? `用它做過 ${used.length} 個作品：` : "");
          let extra = null;
          if (used.length) {
            extra = el("ul", "rpg-links");
            used.forEach((p) => {
              const a = el("a", "", p.name);
              a.href = `./#projects/${slug(p)}`; // 打開首頁寶箱的那張卡片
              const li2 = el("li");
              li2.append(a);
              extra.append(li2);
            });
          }
          say(text, extra);
        })
      );
      li.append(btn);
      list.append(li);
      s._bar = btn.querySelector(".rpg-bar");
    });
    list.style.setProperty("--rows", Math.ceil(c.skills.length / 2));
    page.append(list, el("p", "rpg-hint", "等級 = 實際有在寫的月數；GitHub 上有寫的月份會自動加上去。"));
    // 進度條：跟最高等的技能比，看得出差距
    const top = Math.max(1, ...c.skills.map((s) => s.level));
    page._reveal = () => c.skills.forEach((s, i) => fillBar(s._bar, s.level ? Math.max(0.1, s.level / top) : 0, i * 60)); // 有等級就至少亮一格
    page._intro = () => say("選一個技能，看看它的等級和用它做過的作品。");
    return page;
  }

  function buildAchievements(c) {
    const page = el("div", "rpg-page");
    const list = el("ul", "rpg-badges");
    c.achievements.forEach((a) => {
      const li = el("li");
      const btn = el("button", "rpg-badge" + (a.locked ? " locked" : "") + (a.image ? " has-proof" : ""));
      btn.type = "button";
      btn.append(el("span", "rpg-badge-icon", a.locked ? "？" : a.icon), el("span", "rpg-badge-name", a.locked ? "???" : a.name));
      if (a.date && !a.locked) btn.append(el("span", "rpg-badge-date", a.date));
      btn.addEventListener("click", () =>
        select(btn, () => {
          if (a.locked) return say(`尚未解鎖。提示：${a.name}，${a.desc}`);
          let extra = null;
          if (a.image) {
            // 有附圖的成就：對話框下面多一個按鈕，點了用彈出視窗看圖
            const label = a.imageLabel || "圖片";
            const open = el("button", "rpg-proof-open", `◆ 查看${label}`);
            open.type = "button";
            open.addEventListener("click", () => showProof(a.image, `${a.name}・${label}`));
            extra = open;
          }
          say(`【${a.name}】${a.date ? `（${a.date}）` : ""}${a.desc}`, extra);
        })
      );
      li.append(btn);
      list.append(li);
    });
    const got = c.achievements.filter((a) => !a.locked).length;
    const hint = el("p", "rpg-hint", `已解鎖 ${got} / ${c.achievements.length}`);
    if (c.achievements.some((a) => a.image)) hint.append("　", el("span", "rpg-proof-mark", "✦"), " 可以看獎狀");
    page.append(hint, list);
    // 徽章名稱盡量排成一行：放不下就把字縮小（最小 10px），縮到 10px 還放不下（名字太長）才換行
    const fitNames = () =>
      list.querySelectorAll(".rpg-badge-name").forEach((n) => {
        n.style.fontSize = "";
        n.classList.add("rpg-fit");
        let size = parseFloat(getComputedStyle(n).fontSize);
        while (n.scrollWidth > n.clientWidth + 1 && size > 10) {
          size -= 0.5;
          n.style.fontSize = size + "px";
        }
        if (n.scrollWidth > n.clientWidth + 1) {
          n.style.fontSize = "";
          n.classList.remove("rpg-fit");
        }
      });
    new ResizeObserver(fitNames).observe(list); // 換螢幕寬度、字型載入完都重新算一次
    document.fonts?.ready.then(fitNames);
    page._intro = () => say("一路上解鎖的成就。還有一些正在努力中。");
    return page;
  }

  // ---- 寵物：小樹（長毛吉娃娃）的像素圖，一格一個字，對照 PET_PALETTE 上色 ----
  // 照片上的小樹：白色為主，耳朵、臉頰兩側和背上是黃褐色，臉中間一道白，鼻子咖啡色
  const PET_PALETTE = {
    o: "#4a3426", // 外框
    w: "#fffaf2", // 白毛
    s: "#e2d6c6", // 白毛的陰影
    t: "#d38a45", // 黃褐色的毛
    d: "#a9652c", // 黃褐色的陰影
    p: "#f2a7a0", // 耳朵內側、舌頭
    k: "#1a1618", // 眼睛
    e: "#ffffff", // 眼睛反光
    n: "#603628", // 鼻子
  };
  // 面向右邊：大大的蘋果頭、大眼睛、短嘴、圓身體、長毛耳朵、白色蓬蓬尾巴捲在背上
  const PET_BODY = [
    "..........oo.....oo....",
    ".........otpo...otpo...",
    ".........otppo.otppo...",
    "..oo.....otttwwtttto...",
    ".owso...ottttwwtttto...",
    ".owwso..otttwwwkkwwto..",
    "..owso..ottttwkekwwwo..",
    "..owswo.otttttwkkwwwno.",
    "...owwooottttttwwwwwo..",
    "...owttttttttswwwwpo...",
    "...owwtttttttwwwwwo....",
    "...owwwttttwwwwwwwo....",
    "...oswwwwwwwwwwwwwo....",
    "....osswwwwwwwwwso.....",
    "....oossssssssssoo.....",
  ];
  // 四隻短腿的走路循環
  const PET_LEGS = [
    ["....ow.ow....ow.ow.....", "....oo..oo...oo..oo...."],
    [".....owow.....owow.....", ".....oooo.....oooo....."],
    ["...ow.ow....ow.ow......", "..oo..oo...oo..oo......"],
    [".....owow.....owow.....", ".....oooo.....oooo....."],
  ];
  // 睡覺：跟照片一樣捲成一球，頭靠在前面、眼睛閉著、尾巴圍在身體前面
  const PET_SLEEP = [
    ".......................",
    ".......................",
    ".......................",
    ".......................",
    ".......................",
    ".......................",
    "............oo...oo....",
    ".....oooooootpo..opo...",
    "....ottttttttwoooto....",
    "...otttttttttottwtto...",
    "..ottttttttttottwtto...",
    "..odddddddddwotoowwo...",
    "..owwwwwwwwwwottwwwn...",
    "...owwwssssswwotooo....",
    "...ossswwwwwssso.......",
    "...ooowwwwwwwooo.......",
    "......ooooooo..........",
  ];

  // 把字串畫成一張小 canvas（1 格 = 1 px），之後放大時不做平滑
  function spriteCanvas(rows) {
    const c = document.createElement("canvas");
    c.width = Math.max(...rows.map((r) => r.length));
    c.height = rows.length;
    const ctx = c.getContext("2d");
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (!PET_PALETTE[ch]) return;
        ctx.fillStyle = PET_PALETTE[ch];
        ctx.fillRect(x, y, 1, 1);
      })
    );
    return c;
  }

  // 寵物分頁：左邊小樹在草地上走來走去，走一陣子就趴下來睡覺（愛睡覺），右邊是名字、品種、性別、個性、能力
  function buildPet(c) {
    const pet = c.pet;
    const page = el("div", "rpg-page rpg-pet-page");
    const stage = el("canvas", "rpg-pet-stage");
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", `${pet.name}在草地上走來走去，累了就趴下睡覺`);
    const info = el("dl", "rpg-info rpg-pet-info");
    [["名字", pet.name], ["品種", pet.breed], ["性別", pet.gender], ["個性", pet.personality], ["能力", pet.ability]]
      .filter(([, v]) => v) // 沒填的欄位不顯示
      .forEach(([k, v]) => {
        const dd = el("dd");
        dd.append(k === "性別" ? genderSign(v) : v);
        info.append(el("dt", "", k), dd);
      });
    const body = el("div", "rpg-pet-body");
    // canvas 放在外框裡、絕對定位：大小由外框決定，不會因為 canvas 本身的解析度越撐越高
    const yard = el("div", "rpg-pet-yard");
    yard.append(stage);
    body.append(yard, info);
    page.append(body);

    const walk = [...PET_LEGS.map((legs) => spriteCanvas([...PET_BODY, ...legs]))];
    const sleep = spriteCanvas(PET_SLEEP);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let PX = 3; // 一格像素在畫面上幾 px：院子大的時候放大成 4
    let spriteW = walk[0].width * PX;
    // 夜空的星星：位置固定（用簡單的亂數種子），亮度慢慢閃
    const stars = Array.from({ length: 26 }, (_, i) => ({ x: ((i * 7919) % 997) / 997, y: ((i * 104729) % 991) / 991, p: i * 0.7 }));

    let raf = null;
    let x = 0, dir = 1, last = 0, stepTime = 0, step = 0;
    let mode = "walk", modeUntil = 0;
    const rand = (a, b) => a + Math.random() * (b - a);

    function draw(now) {
      const dpr = window.devicePixelRatio || 1;
      const w = stage.clientWidth, h = stage.clientHeight;
      if (stage.width !== Math.round(w * dpr)) {
        stage.width = Math.round(w * dpr);
        stage.height = Math.round(h * dpr);
      }
      const ctx = stage.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      PX = Math.max(3, Math.min(5, Math.round(h / 120))); // 院子越大，小樹畫得越大（3～5 倍）
      spriteW = walk[0].width * PX;
      // 草地（院子越高，草地越厚）
      const ground = h - Math.max(18, Math.round(h * 0.16));
      // 星星
      ctx.fillStyle = "#ffffff";
      stars.forEach((st) => {
        ctx.globalAlpha = still ? 0.6 : 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(now / 900 + st.p));
        ctx.fillRect(Math.round(st.x * w), Math.round(st.y * (ground - 30)) + 6, 2, 2);
      });
      ctx.globalAlpha = 1;
      // 月亮：像素風的圓，右上角，有一個淡淡的坑
      const mr = Math.max(9, Math.round(Math.min(w, h) * 0.055));
      const mx = w - mr * 2.6, my = mr * 2.4;
      for (let yy = -mr; yy <= mr; yy += 3)
        for (let xx = -mr; xx <= mr; xx += 3) {
          if (Math.hypot(xx, yy) > mr) continue;
          ctx.fillStyle = Math.hypot(xx + mr * 0.4, yy - mr * 0.25) < mr * 0.3 ? "#e6d79c" : "#fff3c2";
          ctx.fillRect(Math.round(mx + xx), Math.round(my + yy), 3, 3);
        }
      ctx.fillStyle = "#2f7d3a";
      ctx.fillRect(0, ground, w, h - ground);
      ctx.fillStyle = "#49a552";
      for (let gx = 0; gx < w; gx += 12) ctx.fillRect(gx, ground, 6, 3);

      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!still && now > modeUntil) {
        // 走 4～7 秒就睡 3～5 秒，睡醒繼續走
        mode = mode === "walk" ? "sleep" : "walk";
        modeUntil = now + (mode === "walk" ? rand(4000, 7000) : rand(3000, 5000));
      }
      if (!still && mode === "walk") {
        x += dir * PX * 11 * dt; // 畫得越大走得越快，看起來速度一樣
        if (x < 0) { x = 0; dir = 1; }
        if (x > w - spriteW) { x = w - spriteW; dir = -1; }
        stepTime += dt;
        if (stepTime > 0.14) { stepTime = 0; step = (step + 1) % walk.length; }
      }
      const img = still ? walk[0] : mode === "walk" ? walk[step] : sleep;
      const y = ground - img.height * PX + 2;
      ctx.save();
      if (dir < 0) {
        // 往左走時左右翻過來
        ctx.translate(x + spriteW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, y, img.width * PX, img.height * PX);
      } else {
        ctx.drawImage(img, x, y, img.width * PX, img.height * PX);
      }
      ctx.restore();
      // 睡覺時頭上冒 Z z
      if (!still && mode === "sleep") {
        const t = (now / 1000) % 1.8;
        const headX = dir > 0 ? x + spriteW - PX * 6 : x + PX;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${PX * 5}px DotGothic16, monospace`;
        ctx.globalAlpha = 1 - t / 1.8;
        ctx.fillText("Z", headX + t * PX * 3, y + PX * 4 - t * PX * 5);
        ctx.font = `bold ${PX * 3.4}px DotGothic16, monospace`;
        ctx.fillText("z", headX + PX * 4 + t * PX * 2, y - t * PX * 3.4);
        ctx.globalAlpha = 1;
      }
      if (still) return; // 不要動畫：只畫一次站著的樣子
      raf = requestAnimationFrame(draw);
    }

    // 只有在寵物分頁打開、而且面板在畫面上的時候才跑動畫
    let active = false;
    let onScreen = false;
    function update() {
      cancelAnimationFrame(raf);
      raf = null;
      if (active && onScreen) {
        last = 0;
        if (!modeUntil) modeUntil = performance.now() + rand(4000, 7000);
        raf = requestAnimationFrame(draw);
      }
    }
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    }).observe(stage);
    page._onShow = () => {
      if (!x) x = Math.max(0, (stage.clientWidth - spriteW) / 2); // 第一次打開時站在中間
      active = true;
      update();
    };
    page._onHide = () => {
      active = false;
      update();
    };
    page._intro = () => say(`${pet.name}：${pet.breed}，個性是${pet.personality}，能力是${pet.ability}。`);
    return page;
  }

  // 看獎狀的彈出視窗（<dialog>：Esc、點任何地方都會關閉，關掉後焦點回到原本的按鈕）
  // 每次都換一張新的 <img>，等圖片解碼好才打開視窗，不會先閃出上一張獎狀
  let proofDialog = null;
  let proofToken = 0;
  async function showProof(src, caption) {
    if (!proofDialog) {
      proofDialog = el("dialog", "rpg-window rpg-proof");
      proofDialog.append(el("img"), el("p", "rpg-proof-caption"), el("span", "rpg-proof-hint", "點一下關閉"));
      proofDialog.addEventListener("click", () => proofDialog.close());
      root.append(proofDialog);
    }
    const token = ++proofToken;
    const img = new Image();
    img.src = src;
    img.alt = caption;
    try {
      await img.decode();
    } catch {
      // 解碼失敗也照樣打開，至少看得到說明文字
    }
    if (token !== proofToken) return; // 等待中又點了別張，以最後點的為準
    proofDialog.querySelector("img").replaceWith(img);
    proofDialog.querySelector(".rpg-proof-caption").textContent = caption;
    if (!proofDialog.open) proofDialog.showModal();
  }

  // 選中某一列：加上 ▶ 游標
  function select(btn, action) {
    root.querySelectorAll(".rpg-row.selected, .rpg-badge.selected, .rpg-gstat.selected").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    action();
  }

  // ---- 組起來 ----
  function render(c, projects) {
    const main = el("div", "rpg-window rpg-main");
    const tabs = el("div", "rpg-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "角色面板");
    const pagesWrap = el("div", "rpg-pages");
    const pages = [
      ["角色", buildStatus(c)], // 「狀態」的「狀」像素字型裡沒有（日文是「状」），所以叫「角色」
      c.pet && ["寵物", buildPet(c)],
      ["技能", buildSkills(c, projects)],
      ["成就", buildAchievements(c)],
    ].filter(Boolean);
    const revealed = new Set();

    const tabButtons = pages.map(([label, page], i) => {
      const t = el("button", "rpg-tab", label);
      t.type = "button";
      t.setAttribute("role", "tab");
      t.id = `rpg-tab-${i}`;
      page.id = `rpg-page-${i}`;
      page.setAttribute("role", "tabpanel");
      page.setAttribute("aria-labelledby", t.id);
      t.setAttribute("aria-controls", page.id);
      t.addEventListener("click", () => show(i));
      tabs.append(t);
      pagesWrap.append(page);
      return t;
    });

    let current = -1;
    function show(i, intro = true) {
      if (current >= 0 && current !== i) pages[current][1]._onHide?.();
      current = i;
      tabButtons.forEach((t, k) => {
        t.setAttribute("aria-selected", String(k === i));
        t.tabIndex = k === i ? 0 : -1;
      });
      pages.forEach(([, page], k) => page.classList.toggle("active", k === i));
      root.querySelectorAll(".selected").forEach((b) => b.classList.remove("selected"));
      const page = pages[i][1];
      if (root.classList.contains("rpg-visible") && !revealed.has(i) && page._reveal) {
        page._reveal();
        revealed.add(i);
      }
      page._onShow?.();
      if (intro) page._intro();
    }

    // 鍵盤：← → 換分頁，↑ ↓ 在列表裡移動
    tabs.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const n = (current + (e.key === "ArrowRight" ? 1 : pages.length - 1)) % pages.length;
      show(n);
      tabButtons[n].focus();
    });
    // 列表裡：↑ ↓ 照順序移動；← → 移到同一列的左邊 / 右邊那格，走到底就繞回另一邊
    //（例如右欄的「智力」按左或右都會到左欄同一列的「點子」）
    pagesWrap.addEventListener("keydown", (e) => {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const items = [...pages[current][1].querySelectorAll(".rpg-row, .rpg-gstat, .rpg-badge")];
      const at = items.indexOf(document.activeElement);
      if (at < 0) return;
      e.preventDefault();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
        return;
      }
      // 畫面上跟現在這格同一列（垂直中心差不到半格高）的格子，由左到右排好
      const box = (n) => n.getBoundingClientRect();
      const me = box(items[at]);
      const midY = me.top + me.height / 2;
      const row = items
        .filter((n) => Math.abs(box(n).top + box(n).height / 2 - midY) < me.height / 2)
        .sort((a, b) => box(a).left - box(b).left);
      if (row.length < 2) return; // 手機只有一欄，左右沒有東西可以去
      const i = row.indexOf(items[at]);
      row[(i + (e.key === "ArrowRight" ? 1 : row.length - 1)) % row.length].focus();
    });

    const title = el("h2", "rpg-heading", "地球Online玩家屬性面板");
    main.append(title, tabs, pagesWrap);

    const message = el("div", "rpg-window rpg-message");
    message.setAttribute("aria-live", "polite");
    message.append(el("p", "rpg-message-text"), el("div", "rpg-message-extra"), el("span", "rpg-message-next", "▼"));
    message.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      if (typingTimer && typingFull) typingFull(); // 點一下直接顯示完整文字
    });

    root.replaceChildren(main, message);
    show(0, false);

    // 捲到面板時才開始跑數字和進度條
    new IntersectionObserver(
      (entries, observer) => {
        if (!entries[0].isIntersecting) return;
        root.classList.add("rpg-visible");
        const page = pages[current][1];
        if (!revealed.has(current) && page._reveal) {
          page._reveal();
          revealed.add(current);
        }
        page._intro();
        observer.disconnect();
      },
      { threshold: 0.4 }
    ).observe(root);
  }

  Promise.all([
    fetch("data/character.json").then((r) => r.json()),
    fetch("data/projects.json")
      .then((r) => r.json())
      .then((groups) => groups.flatMap((g) => g.projects))
      .catch(() => []),
    fetch("data/github-activity.json")
      .then((r) => r.json())
      .catch(() => ({ commitMonths: [], languages: {} })),
  ])
    .then(([character, projects, activity]) => {
      skillLevels(character, activity);
      render(character, projects);
    })
    .catch((e) => {
      console.error("無法讀取角色資料:", e);
      root.textContent = "角色資料讀取失敗 😢";
    });
})();
