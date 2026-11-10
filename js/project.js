// 作品頁（Vue 3 版）：從 data/projects.json 讀取作品，依分類顯示
//
// 原本的寫法是用 createElement 一個一個組出卡片、自己綁 click、自己切換 hidden。
// Vue 的寫法是：畫面長什麼樣子寫在 project.html 的 template 裡，
// 這裡只管「資料」和「狀態」，資料一變，Vue 會自己更新畫面。

// 直接從 CDN import，不需要安裝或打包；版本固定，避免哪天 Vue 改版網站突然壞掉
import { createApp, ref, computed, onMounted, nextTick } from "https://unpkg.com/vue@3.5.13/dist/vue.esm-browser.prod.js";

const langNames = {
  python: "Python",
  dart: "Dart",
  react: "React",
  kotlin: "Kotlin",
  html: "HTML",
  java: "Java",
};

createApp({
  setup() {
    // ref()：會影響畫面的狀態。在 JS 裡要用 .value 讀寫，在 template 裡直接寫名字就好
    // ≈ React 的 useState，但不用另外呼叫 setXxx
    const groups = ref([]); // 所有分類和作品（從 JSON 讀進來）
    const current = ref("all"); // 目前選的分類；原本是 showCategory() 裡手動切換 class
    const error = ref(false);

    // computed()：由其他狀態算出來的值，groups 或 current 改變時會自動重算
    // ≈ React 的 useMemo，但不用寫依賴陣列，Vue 會自己追蹤用到了哪些 ref
    const categories = computed(() => groups.value.map((g) => g.category));

    // 原本是把每個 section 加上 hidden；現在直接算出「要顯示哪些分類」，template 只畫這些
    const visibleGroups = computed(() =>
      current.value === "all"
        ? groups.value
        : groups.value.filter((g) => g.category === current.value)
    );

    // template 裡可以呼叫的一般函式
    const langIcon = (lang) => `images/lang/${lang}.svg`; // 從 skillicons.dev 下載到本機（首頁寶箱也會用）
    const langName = (lang) => langNames[lang] || lang;
    // 卡片的 id 用 repo 名稱，例如 #hitter-skeleton；首頁寶箱掉出來的作品會連到這裡
    const slug = (project) => project.links[0].url.replace(/\/+$/, "").split("/").pop().toLowerCase();

    // onMounted()：畫面第一次掛上去之後執行，適合放 fetch
    // ≈ React 的 useEffect(() => {...}, [])
    onMounted(async () => {
      try {
        const res = await fetch("data/projects.json");
        groups.value = await res.json(); // 一指定，畫面就會自動長出所有卡片
        // nextTick()：等 Vue 把畫面更新完，卡片真的出現在 DOM 上之後再執行
        await nextTick();
        focusCardFromHash();
      } catch (e) {
        console.error("無法讀取作品資料:", e);
        error.value = true;
      }
    });

    // 網址有 #repo名稱 的話，捲到那張卡片並閃一下
    function focusCardFromHash() {
      const id = decodeURIComponent(location.hash.slice(1));
      const card = id && document.getElementById(id);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("flash");
      card.addEventListener("animationend", () => card.classList.remove("flash"), { once: true });
    }

    // 回傳的東西才能在 template 裡使用
    return { groups, current, error, categories, visibleGroups, langIcon, langName, slug };
  },
}).mount("#app"); // 只接管 #app，導覽列等其他部分不受影響
