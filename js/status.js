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
    page.append(el("h3", "rpg-sub", "職業技能"), list);

    // 基礎技能：生活上的技能，沒辦法算月數，直接給 0～100 的數值（以多益 650 的英文 = 65 當基準）
    const life = c.lifeSkills || [];
    if (life.length) {
      const lifeList = el("ul", "rpg-list rpg-skills");
      life.forEach((s) => {
        const li = el("li");
        const btn = el("button", "rpg-row");
        btn.type = "button";
        btn.append(el("span", "rpg-name", s.name), segBar(10, "skill"), el("span", "rpg-num", `Lv. ${s.value}`));
        btn.addEventListener("click", () => select(btn, () => say(`${s.name} Lv. ${s.value}${s.desc ? `：${s.desc}` : "。"}`)));
        li.append(btn);
        lifeList.append(li);
        s._bar = btn.querySelector(".rpg-bar");
      });
      lifeList.style.setProperty("--rows", Math.ceil(life.length / 2));
      page.append(el("h3", "rpg-sub", "基礎技能"), lifeList);
    }

    // 進度條：職業技能跟最高等的比，看得出差距；基礎技能照數值
    const top = Math.max(1, ...c.skills.map((s) => s.level));
    page._reveal = () => {
      c.skills.forEach((s, i) => fillBar(s._bar, s.level ? Math.max(0.1, s.level / top) : 0, i * 60)); // 有等級就至少亮一格
      life.forEach((s, i) => fillBar(s._bar, s.value / 100, (c.skills.length + i) * 60));
    };
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

  // ---- 寵物的像素圖：一格一個字，對照 PET_PALETTE 上色 ----
  // 照片上的小樹和小奈：白色為主，耳朵、臉頰兩側和背上是黃褐色，臉中間一道白，鼻子咖啡色
  const PET_PALETTE = {
    o: "#4a3426", // 外框
    w: "#fffaf2", // 白毛
    s: "#e2d6c6", // 白毛的陰影
    t: "#d38a45", // 黃褐色的毛
    d: "#a9652c", // 黃褐色的陰影
    p: "#f2a7a0", // 耳朵內側、肚子
    P: "#e65a78", // 吐出來的舌頭
    k: "#1a1618", // 眼睛
    e: "#ffffff", // 眼睛反光
    n: "#603628", // 鼻子
    g: "#4caf50", // 小樹的綠色恐龍裝
    G: "#2e7d32", // 恐龍裝的陰影
    y: "#bee65a", // 恐龍背上的刺
    c: "#ffc4c8", // 小奈的粉紅色衣服
    C: "#e896a5", // 粉紅衣服的陰影、鋪棉的點點
  };
  // 四隻短腿的走路循環（兩隻共用）
  const PET_LEGS = [
    ["....ow.ow....ow.ow.....", "....oo..oo...oo..oo...."],
    [".....owow.....owow.....", ".....oooo.....oooo....."],
    ["...ow.ow....ow.ow......", "..oo..oo...oo..oo......"],
    [".....owow.....owow.....", ".....oooo.....oooo....."],
  ];
  const PET_SPRITES = {
    // 小樹：面向右邊，大大的蘋果頭、大眼睛、長毛耳朵、白色蓬蓬尾巴捲在背上；休息時捲成一球睡覺，頭上冒 Z z
    shu: {
      body: [
        "..........oo.....oo....",
        ".........otpo...otpo...",
        ".........otppo.otppo...",
        "..oo.....otttwwtttto...",
        ".owso...ottttwwtttto...",
        ".owwso..otttwwtkktwto..",
        "..owso..otttttkektwwo..",
        "..owswo.ottttttkktwwno.",
        "...owwooottttttttwwwo..",
        "...owwwtttwwwswwwwpo...",
        "...owwwwtwwttwwwwwo....",
        "...owwwwwwwwwwwwwwo....",
        "...oswwwwwwwwwwwwwo....",
        "....osswwwwwwwwwso.....",
        "....oossssssssssoo.....",
      ],
      rest: [[
        ".......................",
        ".......................",
        ".......................",
        ".......................",
        ".......................",
        ".......................",
        "............oo...oo....",
        ".....oooooootpo..opo...",
        "....owwwwwttwwoooto....",
        "...owwtttwwwwottwtto...",
        "..owwwwtwwwwwottwtto...",
        "..ossssssssswotoowwo...",
        "..owwwwwwwwwwottwwwn...",
        "...owwwssssswwotooo....",
        "...ossswwwwwssso.......",
        "...ooowwwwwwwooo.......",
        "......ooooooo..........",
      ]],
      fx: "zzz",
      // 綠色恐龍裝：身體換成綠色、頭上戴恐龍帽、帽子中間一排刺；睡覺時整個背都是綠的，背上一排刺
      clothes: {
        walk: [
          { fill: [4, 16, 9, 14], main: "g", shade: "G" },
          { fill: [9, 20, 0, 3], main: "g", shade: "g" },
          { fill: [9, 20, 4, 4], main: "G", shade: "G" },
          { px: [[13, 1], [14, 0], [15, 1], [14, 2]], ch: "y" },
        ],
        rest: [
          { fill: [2, 12, 8, 16], main: "g", shade: "G" },
          { spikes: [3, 11, 7], ch: "y" },
        ],
      },
    },
    // 小奈：跟小樹差不多的配色，舌頭吐出來；休息時翻肚子討摸、四腳朝天踢呀踢，冒愛心
    nai: {
      body: [
        "..........oo.....oo....",
        ".........otpo...otpo...",
        ".........otppo.otppo...",
        "..oo.....otttwwtttto...",
        ".owso...ottttwwtttto...",
        ".owwso..otttwwtkktwto..",
        "..owso..otttttkektwwo..",
        "..owswo.ottttttkktwwno.",
        "...owwooottttttttwwwo..",
        "...owwwwwwwwwswwwwPo...",
        "...owwwwwwwwwwwwwwoPo..",
        "...owwwwwwwwwwwwwwoPo..",
        "...oswwwwwwwwwwwwwo....",
        "....osswwwwwwwwwso.....",
        "....oossssssssssoo.....",
      ],
      rest: [0, 1].map((k) => [
        ".......................",
        ".......................",
        ".......................",
        ".......................",
        ".......................",
        k ? "...oo.......oo........." : "....oo.....oo..........",
        k ? "..owwo.....owwo........" : "...owwo...owwo.........",
        k ? "..owso......owso......." : "...owso...owso.........",
        "...owwo...owwo.........",
        "..oowwooooowwoooooo....",
        ".owwwwwwwwwwwwwwwtto...",
        "owswwwwwwwwwwwwwtwwtoo.",
        "owwwwwwwwpwwwwwwkkwwto.",
        "oswwwwwwwwwwwwwwkekwwno",
        ".owwwwwwwwwwwwwwkkwwwPo",
        "..ossssssssssssotoooPPo",
        "...oooooooooooootpo.oo.",
      ]),
      fx: "hearts",
      small: true, // 畫的時候每格少 1px
      // 粉紅色鋪棉外套：身體換成粉紅色，加幾個深一點的點點當鋪棉的紋路
      clothes: {
        walk: [
          { fill: [4, 16, 9, 14], main: "c", shade: "C" },
          { px: [[7, 11], [10, 10], [13, 12], [8, 13]], ch: "C" },
        ],
        rest: [
          { fill: [1, 15, 10, 16], main: "c", shade: "C" },
          { px: [[4, 12], [8, 11], [12, 13], [6, 14]], ch: "C" },
        ],
      },
    },
  };

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

  // 幫像素圖穿衣服：照 ops 一步一步改格子
  //   fill: [x0, x1, y0, y1] 範圍裡不是外框的格子換成 main（原本是陰影的換成 shade）
  //   px: [[x, y], ...] 這幾格直接換成 ch
  //   spikes: [x0, x1, yMin] 每隔一欄，在最上面那格的再上面一格加一根刺
  function dress(rows, ops) {
    const g = rows.map((r) => [...r]);
    ops.forEach((op) => {
      if (op.fill) {
        const [x0, x1, y0, y1] = op.fill;
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const ch = g[y]?.[x];
            if (!ch || ch === "." || ch === "o") continue;
            g[y][x] = ch === "s" || ch === "d" ? op.shade : op.main;
          }
      }
      if (op.px) op.px.forEach(([x, y]) => (g[y][x] = op.ch));
      if (op.spikes) {
        const [x0, x1, yMin] = op.spikes;
        for (let x = x0; x <= x1; x += 2) {
          const top = g.findIndex((row) => row[x] !== ".");
          if (top > 0 && top >= yMin && g[top - 1][x] === ".") g[top - 1][x] = op.ch;
        }
      }
    });
    return g.map((r) => r.join(""));
  }

  // 院子的天空跟著看的人當地的時間換：早上、中午、傍晚、晚上
  const SKIES = {
    morning: { name: "早上", top: "#78bfee", bottom: "#ffe2ad", sun: { x: 0.18, y: 0.62, r: 0.05, color: "#ffe066" }, clouds: true },
    noon: { name: "中午", top: "#3c8ae0", bottom: "#a9dcff", sun: { x: 0.8, y: 0.2, r: 0.055, color: "#fff27a" }, clouds: true },
    evening: { name: "傍晚", top: "#3a2a6e", mid: "#e9764a", bottom: "#ffd27a", sun: { x: 0.14, y: 0.86, r: 0.075, color: "#ff9a3d" }, clouds: false },
    night: { name: "晚上", top: "#16206a", bottom: "#3b56b8", moon: true, stars: true },
  };
  function skyNow(d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 6 && h < 10.5) return SKIES.morning;
    if (h >= 10.5 && h < 16) return SKIES.noon;
    if (h >= 16 && h < 18.5) return SKIES.evening;
    return SKIES.night;
  }
  // 像素雲：一格 u px
  const CLOUD = ["..oooo....", ".oooooo.o.", "oooooooooo", ".oooooooo."];

  const petLine = (pet) =>
    `${pet.name}：${pet.breed}，個性是${pet.personality}` + (pet.ability ? `，能力是${pet.ability}` : "") + "。";

  // 一隻寵物一列：左邊是牠在草地上走來走去的小院子，右邊是名字、品種、性別、個性、能力
  function petCard(pet) {
    const card = el("div", "rpg-pet");
    const sprite = PET_SPRITES[pet.sprite];
    const stage = el("canvas", "rpg-pet-stage");
    stage.setAttribute("role", "img");
    stage.setAttribute(
      "aria-label",
      sprite.fx === "zzz" ? `${pet.name}在草地上走來走去，累了就趴下睡覺` : `${pet.name}在草地上走來走去，走一走就翻肚子討摸`
    );
    const info = el("dl", "rpg-info rpg-pet-info");
    [["名字", pet.name], ["品種", pet.breed], ["性別", pet.gender], ["個性", pet.personality], ["能力", pet.ability]]
      .filter(([, v]) => v) // 沒填的欄位不顯示
      .forEach(([k, v]) => {
        const dd = el("dd");
        dd.append(k === "性別" ? genderSign(v) : v);
        info.append(el("dt", "", k), dd);
      });
    // canvas 放在外框裡、絕對定位：大小由外框決定，不會因為 canvas 本身的解析度越撐越高
    const yard = el("div", "rpg-pet-yard");
    yard.append(stage);
    yard.addEventListener("click", () => say(petLine(pet)));
    card.append(yard, info);

    const walkRows = PET_LEGS.map((legs) => [...sprite.body, ...legs]);
    const looks = {
      plain: { walk: walkRows.map(spriteCanvas), rest: sprite.rest.map(spriteCanvas) },
    };
    let dressed = false;
    if (sprite.clothes && pet.outfit) {
      looks.dressed = {
        walk: walkRows.map((r) => spriteCanvas(dress(r, sprite.clothes.walk))),
        rest: sprite.rest.map((r) => spriteCanvas(dress(r, sprite.clothes.rest))),
      };
      // 院子左上角的衣服按鈕：按了穿上 / 脫掉
      const btn = el("button", "rpg-pet-dress");
      btn.type = "button";
      btn.innerHTML =
        '<svg viewBox="0 0 12 10" aria-hidden="true"><path d="M3 0h2v1h2V0h2v1h1v1h1v1h1v2h-2v5H2V5H0V3h1V2h1V1h1z"/></svg>';
      const label = () => {
        btn.setAttribute("aria-pressed", String(dressed));
        btn.setAttribute("aria-label", dressed ? `幫${pet.name}脫掉${pet.outfit}` : `幫${pet.name}穿上${pet.outfit}`);
        btn.title = btn.getAttribute("aria-label");
      };
      label();
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // 不要觸發院子的介紹
        dressed = !dressed;
        label();
        say(dressed ? `${pet.name}穿上了${pet.outfit}。` : `${pet.name}把${pet.outfit}脫掉了。`);
        if (still) draw(performance.now()); // 不跑動畫時也要重畫一次
      });
      yard.append(btn);
    }
    const look = () => looks[dressed ? "dressed" : "plain"];
    const walk = looks.plain.walk;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let PX = 3; // 一格像素在畫面上幾 px：院子大的時候放大
    let spriteW = walk[0].width * PX;
    // 夜空的星星：位置固定（用簡單的亂數種子），亮度慢慢閃；每隻的院子星星位置不一樣
    const seed = pet.sprite.length * 13 + pet.sprite.charCodeAt(0);
    const stars = Array.from({ length: 18 }, (_, i) => ({
      x: (((i + seed) * 7919) % 997) / 997,
      y: (((i + seed) * 104729) % 991) / 991,
      p: i * 0.7,
    }));

    let sky = null, skyCheck = 0;
    const baseLabel = stage.getAttribute("aria-label");
    let raf = null;
    let x = 0, dir = 1, last = 0, stepTime = 0, step = 0;
    let mode = "walk", modeUntil = 0;
    const rand = (a, b) => a + Math.random() * (b - a);

    // 像素愛心：5×4 格，每格 u px
    function heart(ctx, cx, cy, u) {
      [".o.o.", "ooooo", ".ooo.", "..o.."].forEach((row, j) =>
        [...row].forEach((ch, i) => ch === "o" && ctx.fillRect(Math.round(cx + i * u), Math.round(cy + j * u), u, u))
      );
    }

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
      PX = Math.max(3, Math.min(5, Math.round(Math.min(h / 45, w / 50)))); // 院子越大，畫得越大（3～5 倍）
      if (sprite.small) PX -= 1; // 小奈比小樹小一號
      spriteW = walk[0].width * PX;
      // 草地（院子越高，草地越厚）
      const ground = h - Math.max(18, Math.round(h * 0.16));
      // 天空：每 30 秒看一次時間，跨過時段就換
      if (!sky || now - skyCheck > 30000) {
        sky = skyNow();
        skyCheck = now;
        stage.setAttribute("aria-label", `${baseLabel}（${sky.name}）`);
      }
      const grad = ctx.createLinearGradient(0, 0, 0, ground);
      grad.addColorStop(0, sky.top);
      if (sky.mid) grad.addColorStop(0.6, sky.mid);
      grad.addColorStop(1, sky.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, ground);
      // 像素風的圓（太陽、月亮）：一格 3px
      const disc = (cx, cy, r, color, crater) => {
        for (let yy = -r; yy <= r; yy += 3)
          for (let xx = -r; xx <= r; xx += 3) {
            if (Math.hypot(xx, yy) > r) continue;
            ctx.fillStyle = crater && Math.hypot(xx + r * 0.4, yy - r * 0.25) < r * 0.3 ? "#e6d79c" : color;
            ctx.fillRect(Math.round(cx + xx), Math.round(cy + yy), 3, 3);
          }
      };
      const unit = Math.min(w, h);
      if (sky.stars) {
        // 星星
        ctx.fillStyle = "#ffffff";
        stars.forEach((st) => {
          ctx.globalAlpha = still ? 0.6 : 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(now / 900 + st.p));
          ctx.fillRect(Math.round(st.x * w), Math.round(st.y * (ground - 30)) + 6, 2, 2);
        });
        ctx.globalAlpha = 1;
      }
      if (sky.moon) {
        // 月亮：右上角，有一個淡淡的坑
        const mr = Math.max(9, Math.round(unit * 0.055));
        disc(w - mr * 2.6, mr * 2.4, mr, "#fff3c2", true);
      }
      if (sky.sun) {
        // 太陽：外面一圈淡淡的光暈
        const r = Math.max(9, Math.round(unit * sky.sun.r));
        const sx = w * sky.sun.x, sy = ground * sky.sun.y;
        ctx.globalAlpha = 0.25;
        disc(sx, sy, r + 6, sky.sun.color);
        ctx.globalAlpha = 1;
        disc(sx, sy, r, sky.sun.color);
      }
      if (sky.clouds) {
        // 白天的雲：慢慢往右飄，飄出去從左邊回來
        const u = Math.max(2, Math.round(unit / 70));
        const cw = CLOUD[0].length * u;
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        [[0.1, 0.18, 1], [0.55, 0.32, 0.7]].forEach(([fx, fy, speed]) => {
          const cx = ((fx * (w + cw) + (still ? 0 : now / 1000) * 6 * speed) % (w + cw)) - cw;
          CLOUD.forEach((row, j) =>
            [...row].forEach((ch, i) => ch === "o" && ctx.fillRect(Math.round(cx + i * u), Math.round(fy * ground + j * u), u, u))
          );
        });
      }
      // 草地：晚上暗一點
      ctx.fillStyle = sky.stars ? "#2f7d3a" : "#3f9a46";
      ctx.fillRect(0, ground, w, h - ground);
      ctx.fillStyle = sky.stars ? "#49a552" : "#5cc163";
      for (let gx = 0; gx < w; gx += 12) ctx.fillRect(gx, ground, 6, 3);

      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!still && now > modeUntil) {
        // 走 4～7 秒就休息 3～5 秒（小樹睡覺、小奈翻肚子），休息完繼續走
        mode = mode === "walk" ? "rest" : "walk";
        modeUntil = now + (mode === "walk" ? rand(4000, 7000) : rand(3000, 5000));
      }
      if (x > w - spriteW) x = Math.max(0, w - spriteW); // 院子變窄時不要跑出去
      if (!still && mode === "walk") {
        x += dir * PX * 11 * dt; // 畫得越大走得越快，看起來速度一樣
        if (x < 0) { x = 0; dir = 1; }
        if (x > w - spriteW) { x = w - spriteW; dir = -1; }
        stepTime += dt;
        if (stepTime > 0.14) { stepTime = 0; step = (step + 1) % walk.length; }
      }
      const { walk: walkNow, rest } = look();
      const img = still ? walkNow[0] : mode === "walk" ? walkNow[step] : rest[Math.floor(now / 350) % rest.length];
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
      if (!still && mode === "rest") {
        const headX = dir > 0 ? x + spriteW - PX * 6 : x + PX;
        if (sprite.fx === "zzz") {
          // 睡覺時頭上冒 Z z
          const t = (now / 1000) % 1.8;
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${PX * 5}px DotGothic16, monospace`;
          ctx.globalAlpha = 1 - t / 1.8;
          ctx.fillText("Z", headX + t * PX * 3, y + PX * 4 - t * PX * 5);
          ctx.font = `bold ${PX * 3.4}px DotGothic16, monospace`;
          ctx.fillText("z", headX + PX * 4 + t * PX * 2, y - t * PX * 3.4);
        } else {
          // 翻肚子時冒愛心
          ctx.fillStyle = "#ff6996";
          [0, 0.9].forEach((off, i) => {
            const t = (now / 1000 + off) % 1.8;
            ctx.globalAlpha = 1 - t / 1.8;
            heart(ctx, headX - PX * 2 + i * PX * 5 + Math.sin(t * 4) * PX, y + PX * 6 - t * PX * 6, Math.max(2, PX - 1));
          });
        }
        ctx.globalAlpha = 1;
      }
      if (still) return; // 不要動畫：只畫一次站著的樣子
      raf = requestAnimationFrame(draw);
    }

    // 只有在寵物分頁打開、而且院子在畫面上的時候才跑動畫
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
    return {
      card,
      show() {
        if (!x) x = Math.max(0, (stage.clientWidth - spriteW) / 2); // 第一次打開時站在中間
        active = true;
        update();
      },
      hide() {
        active = false;
        update();
      },
    };
  }

  // 寵物分頁：一隻一列。資料裡 null 的位置是一個空位：虛線框 + 空白欄位（給已經不在的那隻）
  function buildPet(c) {
    const page = el("div", "rpg-page rpg-pet-page");
    const grid = el("div", "rpg-pets");
    const cards = [];
    c.pets.forEach((pet) => {
      if (!pet) {
        // 空位：左邊虛線框中間一個 +，右邊欄位都是空白底線
        const slot = el("div", "rpg-pet rpg-pet-empty");
        const box = el("div", "rpg-pet-yard rpg-pet-slot", "+");
        box.setAttribute("aria-hidden", "true");
        const info = el("dl", "rpg-info rpg-pet-info");
        ["名字", "品種", "性別", "個性", "能力"].forEach((k) => info.append(el("dt", "", k), el("dd", "", "＿＿")));
        info.setAttribute("aria-label", "空的寵物欄位");
        slot.append(box, info);
        return grid.append(slot);
      }
      const card = petCard(pet);
      cards.push(card);
      grid.append(card.card);
    });
    page.append(grid);
    page._onShow = () => cards.forEach((k) => k.show());
    page._onHide = () => cards.forEach((k) => k.hide());
    page._intro = () => say(c.pets.filter(Boolean).map(petLine).join("　"));
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
      c.pets?.length && ["寵物", buildPet(c)],
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
