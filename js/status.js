// 關於頁的 RPG 角色面板（經典 JRPG 視窗風格）
// 資料在 data/character.json；這裡把它畫成「狀態 / 技能 / 成就」三個分頁，
// 下方的對話框用打字機效果顯示說明。
//
// 操作：點分頁或用 ← → 切換；在列表裡用 ↑ ↓ 移動、Enter 選擇；點對話框可以直接顯示完整文字。

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

  // ---- 頭像：把照片縮成 48×48 再用像素方式放大 ----
  function pixelAvatar(src) {
    const canvas = el("canvas", "rpg-avatar");
    canvas.width = canvas.height = 48;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 4, s, s, 0, 0, 48, 48);
    };
    img.src = src;
    return canvas;
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
    // 職業：轉職路線的最後一階；點了在對話框看完整的轉職紀錄
    const path = c.classPath || [];
    const job = row("職業", "");
    const jobBtn = el("button", "rpg-class", path.length ? `${path[path.length - 1].rank}・${c.class}` : c.class);
    jobBtn.type = "button";
    jobBtn.addEventListener("click", () =>
      say("轉職紀錄：" + path.map((p) => `【${p.rank}】${p.name}：${p.desc}`).join(" → ") + "。下一次轉職：畢業之後再看看。")
    );
    job.append(jobBtn);
    row("稱號", `「${c.title}」`, "rpg-title");
    const lv = row("等級", `Lv. ${c.level}`, "rpg-level");
    hero.append(pixelAvatar("images/profile/me.jpg"), info);

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
      btn.append(name, segBar(10, `attr rpg-bar-${(a.stat || "").toLowerCase()}`), num);
      btn.addEventListener("click", () => select(btn, () => say(`${a.stat ? a.stat + "（" + a.name + "）" : a.name} ${a.value}：${a.desc}`)));
      li.append(btn);
      attrs.append(li);
      a._bar = btn.querySelector(".rpg-bar");
      a._num = num;
    });

    page.append(hero, exp, el("h3", "rpg-sub", "屬性"), attrs);
    page._reveal = () => {
      fillBar(expBar, c.exp / c.nextExp);
      countUp(expNum, c.exp, (v) => `${v} / ${c.nextExp}`, 600);
      c.attributes.forEach((a, i) => {
        fillBar(a._bar, a.value / 100, 300 + i * 120);
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
    page._intro = () => say("一路上解鎖的成就。還有一些正在努力中。");
    return page;
  }

  // 看獎狀的彈出視窗（<dialog>：Esc、點任何地方都會關閉，關掉後焦點回到原本的按鈕）
  let proofDialog = null;
  function showProof(src, caption) {
    if (!proofDialog) {
      proofDialog = el("dialog", "rpg-window rpg-proof");
      proofDialog.append(el("img"), el("p", "rpg-proof-caption"), el("span", "rpg-proof-hint", "點一下關閉"));
      proofDialog.addEventListener("click", () => proofDialog.close());
      root.append(proofDialog);
    }
    const img = proofDialog.querySelector("img");
    img.src = src;
    img.alt = caption;
    proofDialog.querySelector(".rpg-proof-caption").textContent = caption;
    proofDialog.showModal();
  }

  // 選中某一列：加上 ▶ 游標
  function select(btn, action) {
    root.querySelectorAll(".rpg-row.selected, .rpg-badge.selected").forEach((b) => b.classList.remove("selected"));
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
      ["技能", buildSkills(c, projects)],
      ["成就", buildAchievements(c)],
    ];
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
    pagesWrap.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...pages[current][1].querySelectorAll(".rpg-row, .rpg-badge")];
      const at = items.indexOf(document.activeElement);
      if (at < 0) return;
      e.preventDefault();
      const next = items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
      next.focus();
    });

    const title = el("h2", "rpg-heading", "個人程式能力面板");
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
