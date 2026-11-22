// 文字入場特效：捲到那一區才播，只播一次
//
// 要藏起來等入場的元素，在 <head> 那一行會先幫 <html> 加上 rv-on（系統關掉動畫的人不加，直接顯示），
// css/reveal.css 用 .rv-on 把它們先藏好，這裡等它們進到畫面再加上 rv-in 播動畫。
// 每一個效果對應一組選擇器，所以 HTML 不用改。
(() => {
  const root = document.documentElement;
  if (!root.classList.contains("rv-on")) return;

  // 把元素裡的文字拆成一個字一個 <span>（<br> 保留），回傳所有字
  function splitChars(el) {
    const chars = [];
    [...el.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const frag = document.createDocumentFragment();
      [...node.textContent.trim()].forEach((ch) => {
        const s = document.createElement("span");
        s.className = "rv-ch";
        s.textContent = ch;
        frag.append(s);
        chars.push(s);
      });
      node.replaceWith(frag);
    });
    return chars;
  }

  const effects = {
    // 首頁開場：「Hello」往上浮現，名字一個字一個字彈出來，社群圖示再依序出現
    hello(el) {
      el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
      const chars = splitChars(el);
      const helloLen = "Hello".length;
      chars.forEach((s, i) => {
        s.setAttribute("aria-hidden", "true");
        s.classList.add(i < helloLen ? "rv-rise" : "rv-pop");
        s.style.setProperty("--d", `${i < helloLen ? 0 : 0.35 + (i - helloLen) * 0.08}s`);
      });
      document.querySelectorAll(".u-section-1 .u-repeater-item").forEach((icon, i) => {
        icon.classList.add("rv-icon");
        icon.style.setProperty("--d", `${0.35 + (chars.length - helloLen) * 0.08 + 0.1 + i * 0.06}s`);
      });
      return () => {
        el.classList.add("rv-in");
        document.querySelectorAll(".rv-icon").forEach((icon) => icon.classList.add("rv-in"));
      };
    },

    // 解碼：先是亂跳的符號，再一個字一個字定格（用全形符號，寬度跟中文一樣，標題不會左右晃）
    scramble(el) {
      const text = el.textContent.trim();
      const pool = "＃＄％＆＊＠＋＝？！０１＜＞";
      el.setAttribute("aria-label", text); // 螢幕閱讀器直接念正確的字，不要念到亂碼
      return () => {
        el.classList.add("rv-in");
        const start = performance.now();
        const tick = (now) => {
          const t = now - start;
          let out = "";
          let done = true;
          [...text].forEach((ch, i) => {
            if (t > 400 + i * 180) out += ch; // 每個字隔 0.18 秒定格
            else {
              done = false;
              out += pool[Math.floor(Math.random() * pool.length)];
            }
          });
          el.textContent = out;
          if (!done) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
    },

    // 故障：紅藍錯位閃一下再定格（::before / ::after 用 data-text 疊兩層）
    glitch(el) {
      return () => {
        el.dataset.text = el.textContent;
        el.classList.add("rv-in", "rv-glitching");
        setTimeout(() => el.classList.remove("rv-glitching"), 900);
      };
    },

    // 淡入上浮（段落、副標）
    fade(el) {
      return () => el.classList.add("rv-in");
    },

    // 標題下面的線：從中間往兩邊畫出來（CSS transition）
    line(el) {
      return () => el.classList.add("rv-in");
    },

    // 一個接一個滑上來（學歷的三間學校）：每一個自己進到畫面才播
    stagger(el) {
      return () => el.classList.add("rv-in");
    },
  };

  // 效果 ← 選擇器（找不到的就跳過，所以三頁共用同一份設定）
  const plan = [
    ["hello", ".u-section-1 .u-title"],
    ["scramble", "#block-3 .u-text-1"],
    ["fade", "#block-3 .u-text-2"],
    ["fade", "#research .u-text-1, #sec-6049 > .u-sheet > .u-text-1"],
    ["line", "#research .u-line-1, #sec-6049 .u-line-1"],
    ["fade", "#research .research-text"],
    ["stagger", "#sec-6049 .u-list-item"],
    ["glitch", "#sec-704a .product-title"],
    ["fade", "#sec-704a .product-subtitle"],
  ];

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        entry.target._rvPlay();
      });
    },
    { rootMargin: "0px 0px -12% 0px" } // 進到畫面一點點再播，不要在最底邊緣就播掉
  );

  plan.forEach(([name, sel]) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.classList.add(`rv-${name}`);
      el._rvPlay = effects[name](el);
      io.observe(el);
    });
  });
})();
