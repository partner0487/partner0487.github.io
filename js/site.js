// 取代原本 Nicepage 的 nicepage.js + jQuery，只保留這個網站實際用到的功能：
// 1. 依視窗寬度在 <html> 加上 u-responsive-xx（CSS 會用到）
// 2. 手機版漢堡選單的開關
// 3. 標示目前所在頁面的選單項目
// 4. 讓有 data-href 的元素可以點擊（社群圖示、學校 logo）
// 5. 深色 / 淺色主題切換（太陽 / 月亮按鈕）
// 6. 個性簽名的「寫出來」動畫

(() => {
  const root = document.documentElement;
  const body = document.body;
  const nav = document.querySelector(".u-menu");

  // ---- 1. 響應式斷點 ----
  const breakpoints = [
    ["xl", 1200],
    ["lg", 992],
    ["md", 768],
    ["sm", 576],
    ["xs", 0],
  ];
  const mobileMenu = window.matchMedia("(max-width: 991px)");

  function updateResponsive() {
    const width = window.innerWidth;
    const current = breakpoints.find(([, min]) => width >= min)[0];
    breakpoints.forEach(([name]) => {
      root.classList.toggle(`u-responsive-${name}`, name === current);
    });
    if (nav) nav.classList.toggle("u-enable-responsive", mobileMenu.matches);
    if (!mobileMenu.matches) closeMenu();
  }

  // ---- 2. 手機版選單 ----
  const overlay = nav && nav.querySelector(".u-menu-overlay");
  const menuContainer = nav && nav.querySelector(".u-nav-container-collapse");

  function openMenu() {
    if (!nav) return;
    nav.classList.add("open", "prevent-animation");
    body.classList.add("menu-overlay", "u-offcanvas-opened");
    root.style.overflow = "hidden"; // 選單打開時背景不能捲動
    if (menuContainer) menuContainer.style.width = "100%";
    if (overlay) overlay.style.display = "block";
  }

  function closeMenu() {
    if (!nav || !nav.classList.contains("open")) return;
    nav.classList.remove("open", "prevent-animation");
    body.classList.remove("menu-overlay", "u-offcanvas-opened");
    root.style.overflow = "";
    if (menuContainer) menuContainer.style.width = "";
    if (overlay) overlay.style.display = "none";
  }

  if (nav) {
    const hamburger = nav.querySelector(".u-hamburger-link");
    if (hamburger) {
      hamburger.addEventListener("click", (e) => {
        e.preventDefault();
        hamburger.blur();
        openMenu();
      });
    }
    nav
      .querySelectorAll(".u-menu-close, .u-menu-overlay, .u-nav-container-collapse .u-nav-link")
      .forEach((el) => el.addEventListener("click", closeMenu));
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // ---- 3. 目前頁面 ----
  // "/" 和 "/index.html" 視為同一頁
  const normalize = (path) => path.replace(/\/index\.html$/, "/");
  const here = normalize(location.pathname);
  document.querySelectorAll(".u-nav-link[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.includes("#")) return; // 「作品」是 ./#projects，不要跟首頁一起被標成目前頁面
    if (normalize(new URL(href, location.href).pathname) === here) {
      link.classList.add("active");
    }
  });

  // ---- 4. data-href 連結 ----
  document.querySelectorAll("[data-href]").forEach((el) => {
    const go = () => {
      window.location.href = el.getAttribute("data-href");
    };
    el.setAttribute("role", "link");
    el.setAttribute("tabindex", "0");
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
  });

  // ---- 5. 深色 / 淺色主題 ----
  // 一開始用哪個主題，已經由 <head> 裡的 script 決定並寫在 <html data-theme>（避免先閃一下白畫面）。
  // 這裡負責：產生切換按鈕、記住使用者的選擇、沒選過的人跟著系統主題走。
  const THEME_KEY = "theme";
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const savedTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null; // 無痕模式或封鎖儲存空間時會丟錯
    }
  };

  function setTheme(theme, save) {
    root.dataset.theme = theme;
    if (save) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
    }
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.setAttribute("aria-label", theme === "dark" ? "切換成淺色模式" : "切換成深色模式");
      btn.setAttribute("aria-pressed", String(theme === "dark"));
    });
    // 寶箱和數字雨是在 JS 裡畫的，聽這個事件換顏色
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }

  systemDark.addEventListener("change", (e) => {
    if (!savedTheme()) setTheme(e.matches ? "dark" : "light", false);
  });

  const THEME_ICONS =
    '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function makeThemeToggle() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.innerHTML = THEME_ICONS;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
    return btn;
  }

  if (nav) {
    // 桌機：導覽列最後一項；手機：漢堡按鈕左邊
    const list = nav.querySelector(".u-nav-container .u-nav");
    if (list) {
      const li = document.createElement("li");
      li.className = "u-nav-item theme-toggle-item";
      li.append(makeThemeToggle());
      list.append(li);
    }
    const collapse = nav.querySelector(".menu-collapse");
    if (collapse) collapse.prepend(makeThemeToggle());
  }
  setTheme(root.dataset.theme || (systemDark.matches ? "dark" : "light"), false);

  // ---- 6. 個性簽名：捲到的時候由左往右寫出來 ----
  // 先藏起來（.sign-ready），進到畫面再加 .signed 讓 clip-path 展開；不喜歡動畫的人直接顯示。
  // 觀察的是父元素：簽名自己被 clip-path 裁光時，瀏覽器算出來的可見比例永遠是 0，不會觸發
  const signatures = document.querySelectorAll(".signature");
  if (signatures.length && "IntersectionObserver" in window &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const owners = new Map(); // 父元素 → 裡面的簽名
    const signObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        owners.get(entry.target).forEach((s) => s.classList.add("signed"));
        signObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    signatures.forEach((s) => {
      s.classList.add("sign-ready");
      const parent = s.parentElement;
      if (!owners.has(parent)) owners.set(parent, []);
      owners.get(parent).push(s);
      signObserver.observe(parent);
    });
  }

  updateResponsive();
  window.addEventListener("resize", updateResponsive);
})();
