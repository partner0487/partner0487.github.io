// 興趣頁的動漫清單：一個分類（年份 / 進行中 / 未看…）排成一圈 3D 環形卡牌
//
// 資料：data/anime.json（scripts/anime_txt.py 從記事本清單轉出來）
//       data/anime-covers.json（scripts/anime_covers.py 抓的封面，圖在 images/anime/）
// 玩法：上面選分類；環會一張一張慢慢轉，可以拖曳 / 滑動、按 ← →、點某張卡轉到正前方；
//       正前方那張放大，下面顯示片名和標記。搜尋會跳到那部所在的分類並轉過去。
(() => {
  const board = document.querySelector(".anime-board");
  if (!board) return;
  const tabsEl = board.querySelector(".anime-tabs");
  const stage = board.querySelector(".anime-stage");
  const ring = board.querySelector(".anime-ring");
  const infoTitle = board.querySelector(".anime-info-title");
  const infoMeta = board.querySelector(".anime-info-meta");
  const search = document.getElementById("search-input");
  const searchHint = board.querySelector(".anime-search-hint");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const GROUP_LABEL = (g) => (/^\d{4}$/.test(g) ? `${g}` : g);
  const GROUP_NOTE = (g) => (/^\d{4}$/.test(g) ? `${g} 年看的` : g);
  const TAG_TEXT = { 完成: "✅ 看完", 推薦: "⭐ 推薦", 電影: "🎬 電影", 解說: "⏩ 看解說", 陸劇: "📺 陸劇", 日劇: "📺 日劇", 韓劇: "📺 韓劇" }; // Windows 不支援國旗表情符號（會變成 CN、KR 兩個字母）

  let groups = new Map(); // 分類 → 作品陣列（照清單順序）
  let current = null; // 目前的分類
  let items = []; // 目前這個分類的作品
  let ringItems = []; // 實際排在環上的（作品太少時重複排，見 buildRing）
  let cards = [];
  let step = 0; // 相鄰兩張差幾度
  let radius = 0;
  let angle = 0; // 環現在轉到幾度
  let target = 0; // 要轉到幾度（angle 每一幀往它靠近）
  let front = -1;
  let drag = null;
  let lastTouch = 0; // 上次有人操作的時間：操作完過一陣子才繼續自己轉
  let hovering = false;
  let visible = false;
  let frame = null;
  let lastCw = 0; // 目前這一圈用的卡片寬度
  let appear = 1; // 整圈出現的程度：0 = 縮小淡出，1 = 完整（換分類的動畫）
  let appearTarget = 1;

  const mod = (a, n) => ((a % n) + n) % n;

  Promise.all([
    fetch("data/anime.json").then((r) => r.json()),
    fetch("data/anime-covers.json").then((r) => r.json()).catch(() => ({})),
  ]).then(([anime, covers]) => {
    anime.forEach((a) => {
      a.cover = covers[a.title]?.file || null;
      if (!groups.has(a.group)) groups.set(a.group, []);
      groups.get(a.group).push(a);
    });
    // 分類順序：進行中 → 年份新到舊 → 未看 → 未看續作
    const years = [...groups.keys()].filter((g) => /^\d{4}$/.test(g)).sort((a, b) => b - a);
    const order = ["進行中", ...years, "未看", "未看續作"].filter((g) => groups.has(g));
    groups = new Map(order.map((g) => [g, groups.get(g)]));
    buildTabs();
    showGroup(order[0], true);
  });

  // ---- 分類標籤 ----
  function buildTabs() {
    tabsEl.replaceChildren(
      ...[...groups.keys()].map((g) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "anime-tab";
        b.setAttribute("role", "tab");
        b.dataset.group = g;
        b.innerHTML = `${GROUP_LABEL(g)}<span class="anime-tab-count">${groups.get(g).length}</span>`;
        b.addEventListener("click", () => showGroup(g));
        return b;
      })
    );
  }

  // ---- 換一圈 ----
  function showGroup(g, immediate = false, thenFocus = null) {
    if (g === current) {
      if (thenFocus !== null) rotateTo(thenFocus);
      return;
    }
    current = g;
    tabsEl.querySelectorAll(".anime-tab").forEach((b) => {
      const on = b.dataset.group === g;
      b.setAttribute("aria-selected", String(on));
      if (on) b.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    const build = () => {
      buildRing(groups.get(g));
      if (thenFocus !== null) angle = target = -thenFocus * step;
      appear = immediate || reduceMotion.matches ? 1 : 0;
      appearTarget = 1;
      render(true);
    };
    if (immediate || reduceMotion.matches) return build();
    // 舊的一圈縮起來淡出，換成新的再展開
    // （不能直接對外框做 opacity：3D 環的祖先只要半透明，瀏覽器就會把整圈壓平，先看到一排橫的）
    appearTarget = 0;
    setTimeout(build, 220);
  }

  function cardWidth() {
    return stage.clientWidth < 600 ? 140 : 210; // 卡片寬度（手機 / 桌機）
  }

  function buildRing(list) {
    items = list;
    // 少於 8 部時同一份清單重複排滿一圈：只有 3 張的話另外兩張會轉到背面，畫面上只剩一張
    ringItems = [];
    while (ringItems.length < 8) ringItems.push(...items);
    const cw = cardWidth();
    lastCw = cw;
    const n = ringItems.length;
    step = 360 / n;
    // 半徑跟著張數變大：卡片之間留一點空隙；張數很少時也不要小到擠成一團
    radius = Math.max((cw * 1.18 * n) / (2 * Math.PI), cw * 0.9);
    stage.style.setProperty("--cw", `${cw}px`);
    angle = target = 0;
    front = -1;
    cards = ringItems.map((a) => {
      const card = document.createElement("div");
      card.className = "anime-card";
      if (a.cover) {
        const img = document.createElement("img");
        img.src = a.cover;
        img.alt = "";
        img.decoding = "async";
        img.draggable = false;
        card.append(img);
      } else {
        // 沒有封面：直接寫片名
        const ph = document.createElement("span");
        ph.className = "anime-card-placeholder";
        ph.textContent = a.title;
        card.append(ph);
      }
      if (a.tags.includes("推薦")) card.insertAdjacentHTML("beforeend", '<span class="anime-card-star" aria-hidden="true">★</span>');
      if (a.tags.includes("電影")) card.insertAdjacentHTML("beforeend", '<span class="anime-card-badge">電影</span>');
      if (a.progress) card.insertAdjacentHTML("beforeend", `<span class="anime-card-badge">第 ${a.progress} 集</span>`);
      return card;
    });
    ring.replaceChildren(...cards);
    stage.setAttribute("aria-label", `${GROUP_NOTE(current)}，共 ${items.length} 部。用左右方向鍵切換`);
  }

  // ---- 每一幀：環轉一點、每張卡依角度調整大小和亮度 ----
  function render(force = false) {
    const da = appearTarget - appear;
    if (!drag) {
      const d = target - angle;
      if (Math.abs(d) < 0.01 && Math.abs(da) < 0.005 && !force) return;
      angle = Math.abs(d) < 0.01 ? target : angle + d * (reduceMotion.matches ? 1 : 0.12);
    }
    appear = Math.abs(da) < 0.005 ? appearTarget : appear + da * 0.2;
    const grow = 0.7 + 0.3 * appear; // 換分類時整圈縮小 / 展開
    // 整圈本身不轉，每張卡直接用「離正前方幾度」擺位置：
    // 原本是整圈 rotateY(angle) 再加上每張卡自己的 rotateY，兩個加起來超過 360° 時，
    // Chrome 會判斷不到滑鼠點到那張卡（畫面上看得到，點下去卻穿過去）
    ring.style.transform = `translateZ(${-radius}px) scale(${grow.toFixed(3)})`;
    cards.forEach((card, i) => {
      const rel = mod(i * step + angle + 180, 360) - 180; // 這張卡離正前方幾度
      const c = Math.cos((rel * Math.PI) / 180);
      const near = Math.max(0, c);
      const scale = 1 + 0.18 * Math.pow(near, 12); // 只有正前方那張會放大
      card.style.transform = `rotateY(${rel.toFixed(3)}deg) translateZ(${radius}px) scale(${scale.toFixed(3)})`;
      card.style.opacity = ((0.15 + 0.85 * Math.pow(near, 1.5)) * appear).toFixed(3);
    });
    const f = mod(Math.round(-angle / step), cards.length);
    if (f !== front) {
      cards[front]?.classList.remove("is-front");
      front = f;
      cards[front].classList.add("is-front");
      showInfo(ringItems[front]);
    }
  }

  function loop() {
    frame = requestAnimationFrame(loop);
    render();
  }

  function showInfo(a) {
    infoTitle.textContent = a.title;
    const chips = [GROUP_NOTE(a.group)];
    if (a.progress !== undefined) chips.push(a.progress ? `看到第 ${a.progress} 集` : "還沒開始看"); // 清單上寫 0️⃣ 的是還沒開始
    a.tags.forEach((t) => chips.push(TAG_TEXT[t] || t));
    if (a.times) chips.push(`🔁 看了 ${a.times} 次`);
    infoMeta.replaceChildren(
      ...chips.map((t) => {
        const s = document.createElement("span");
        s.className = "anime-chip";
        s.textContent = t;
        return s;
      })
    );
  }

  // 轉到第 i 張：從現在的角度挑最近的那一圈，不要整圈繞回去
  function rotateTo(i) {
    const base = -i * step;
    target = base + Math.round((angle - base) / 360) * 360;
    lastTouch = performance.now();
  }

  // 往右（正數）/ 往左（負數）多轉幾張：疊加在「已經要轉去的位置」上，
  // 還在轉的時候連點 / 連按會一直往同一個方向加，不會被拉回來而卡住
  function nudge(n) {
    target -= n * step;
    lastTouch = performance.now();
  }

  // ---- 拖曳 / 滑動 ----
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, start: angle, last: e.clientX, t: performance.now(), v: 0, moved: false, id: e.pointerId };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("dragging");
    }
    if (!drag.moved) return;
    const degPerPx = 360 / (2 * Math.PI * radius); // 正前方那張卡跟著手指走
    angle = drag.start + dx * degPerPx;
    const now = performance.now();
    drag.v = ((e.clientX - drag.last) * degPerPx) / Math.max(1, now - drag.t);
    drag.last = e.clientX;
    drag.t = now;
    render(true);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    stage.classList.remove("dragging");
    lastTouch = performance.now();
    if (d.moved) {
      // 放開時順著速度多滑一點，再停在最近的一張
      target = Math.round((angle + d.v * 220) / step) * step;
    } else {
      // 沒拖動 = 點擊：點到的那張在正前方右邊第幾張，就再往右轉幾張
      const card = e.target.closest?.(".anime-card");
      const i = cards.indexOf(card);
      if (i >= 0) nudge(Math.round((mod(i * step + angle + 180, 360) - 180) / step));
    }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && (hovering = true));
  stage.addEventListener("pointerleave", () => (hovering = false));

  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") nudge(1);
    else if (e.key === "ArrowLeft") nudge(-1);
    else return;
    e.preventDefault();
  });

  // 沒人操作時，每 3.5 秒自己轉到下一張
  setInterval(() => {
    if (!visible || hovering || drag || reduceMotion.matches || document.hidden) return;
    if (performance.now() - lastTouch < 6000 || items.length < 2) return; // 只有一部就不用轉
    target -= step;
  }, 3500);

  // 不在畫面上就不跑動畫
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && frame === null) frame = requestAnimationFrame(loop);
    else if (!visible && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }).observe(stage);

  // 視窗寬度跨過手機 / 桌機時，卡片大小不同，重排這一圈
  new ResizeObserver(() => {
    const cw = cardWidth();
    if (!current || cw === lastCw) return;
    const keep = front;
    lastCw = cw;
    buildRing(groups.get(current));
    angle = target = -Math.max(0, keep) * step;
    render(true);
  }).observe(stage);

  // ---- 搜尋：跳到那部所在的分類並轉過去；Enter 看下一筆 ----
  let matches = [];
  let matchAt = 0;
  function goMatch() {
    const a = matches[matchAt];
    searchHint.textContent = `${matchAt + 1} / ${matches.length}`;
    const i = groups.get(a.group).indexOf(a);
    showGroup(a.group, false, i);
    lastTouch = performance.now() + 4000; // 找到之後多停一下，不要馬上轉走
  }
  let timer = null;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = search.value.trim().toLowerCase();
      matches = q ? [...groups.values()].flat().filter((a) => a.title.toLowerCase().includes(q)) : [];
      matchAt = 0;
      if (!q) searchHint.textContent = "";
      else if (!matches.length) searchHint.textContent = "找不到";
      else goMatch();
    }, 250);
  });
  search.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !matches.length) return;
    e.preventDefault();
    matchAt = (matchAt + 1) % matches.length;
    goMatch();
  });
})();
