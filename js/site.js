// 取代原本 Nicepage 的 nicepage.js + jQuery，只保留這個網站實際用到的功能：
// 1. 依視窗寬度在 <html> 加上 u-responsive-xx（CSS 會用到）
// 2. 手機版漢堡選單的開關
// 3. 標示目前所在頁面的選單項目
// 4. 讓有 data-href 的元素可以點擊（社群圖示、學校 logo）

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
    if (!href || href === "#") return;
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

  updateResponsive();
  window.addEventListener("resize", updateResponsive);
})();
