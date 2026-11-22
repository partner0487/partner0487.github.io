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

    // 鍵盤打字：游標後面一個字一個字打出來，打完游標再閃幾下消失
    type(el) {
      const text = el.textContent.trim();
      el.setAttribute("aria-label", text); // 螢幕閱讀器直接念完整的字
      return () => {
        el.classList.add("rv-in");
        const caret = document.createElement("span");
        caret.className = "rv-caret";
        caret.setAttribute("aria-hidden", "true");
        const chars = [...text];
        let k = 0;
        el.textContent = ""; // 先清空，只剩游標在閃
        el.append(caret);
        const typeNext = () => {
          el.textContent = chars.slice(0, k).join("");
          el.append(caret);
          if (k++ < chars.length) setTimeout(typeNext, 140 + Math.random() * 120); // 打字的節奏不要太平均
          else setTimeout(() => caret.remove(), 1800); // 打完閃幾下再收起來
        };
        setTimeout(typeNext, 350);
      };
    },

    // 英文亂碼：每個字母先亂跳，從左到右依序定格
    // 每個字母先量好最後的寬度並固定住，亂跳時字寬不同，標題才不會左右晃
    decode(el) {
      const text = el.textContent.trim();
      const pool = "abcdeghknopqsuvxyzACEFKLPRSTZ0123456789"; // 寬度差不多的字母
      const thin = "il1!|:;.'"; // i、l、' 這種很窄的位置只用窄字，不然會擠在一起
      el.setAttribute("aria-label", text);
      return () => {
        el.replaceChildren(
          ...[...text].map((ch) => {
            const s = document.createElement("span");
            s.className = "rv-slot";
            s.textContent = ch;
            s.setAttribute("aria-hidden", "true");
            return s;
          })
        );
        const slots = [...el.children];
        const em = parseFloat(getComputedStyle(el).fontSize);
        slots.forEach((s) => {
          const w = s.getBoundingClientRect().width;
          s.style.width = `${w}px`;
          s.pool = w < em * 0.35 ? thin : pool;
        });
        el.classList.add("rv-in");
        const start = performance.now();
        const tick = (now) => {
          const t = now - start;
          let done = true;
          slots.forEach((s, i) => {
            if (text[i] === " " || t > 300 + i * 70) s.textContent = text[i];
            else {
              done = false;
              s.textContent = s.pool[Math.floor(Math.random() * s.pool.length)];
            }
          });
          if (done) el.textContent = text; // 播完換回純文字（js/gamer.js 之後會改這個標題）
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
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
    ["type", "#block-3 .u-text-1"],
    ["fade", "#block-3 .u-text-2"],
    ["fade", "#research .u-text-1, #sec-6049 > .u-sheet > .u-text-1"],
    ["line", "#research .u-line-1, #sec-6049 .u-line-1"],
    ["fade", "#research .research-text"],
    ["stagger", "#sec-6049 .u-list-item"],
    ["decode", "#sec-704a .product-title"],
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
