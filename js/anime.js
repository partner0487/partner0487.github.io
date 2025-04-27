const board = document.querySelector(".anime-board");

// 你想要的順序
const categoryOrder = [
  "進行中",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "未看",
  "未看續作",
];

// 定義表情符號對應
const tagEmojis = {
  完成: "✅",
  電影: "🎬",
  KR: "🎬",
};

// 處理數字標籤顯示對應的數字表情符號
function getNumberEmojis(number) {
  const numberEmojis = [
    "0️⃣",
    "1️⃣",
    "2️⃣",
    "3️⃣",
    "4️⃣",
    "5️⃣",
    "6️⃣",
    "7️⃣",
    "8️⃣",
    "9️⃣",
  ];
  // 將每個數字轉換為對應的表情符號
  return number
    .toString()
    .split("")
    .map((digit) => numberEmojis[digit])
    .join(" ");
}

// 讀取 JSON 檔案
fetch("images/anime.json")
  .then((response) => response.json())
  .then((animeData) => {
    // 分類
    const categorized = {};

    animeData.forEach((anime) => {
      const key = anime.category;
      if (!categorized[key]) categorized[key] = [];
      categorized[key].push(anime);
    });

    // 畫面動態產生
    categoryOrder.forEach((category) => {
      if (categorized[category]) {
        const section = document.createElement("div");
        section.className = "category-section";

        const title = document.createElement("h3");
        title.className = "category-title";
        title.textContent = category;
        section.appendChild(title);

        const listContainer = document.createElement("div");
        listContainer.className = "anime-list-container";

        const leftBtn = document.createElement("button");
        leftBtn.className = "scroll-btn left-btn";
        leftBtn.textContent = "←";

        const rightBtn = document.createElement("button");
        rightBtn.className = "scroll-btn right-btn";
        rightBtn.textContent = "→";

        const list = document.createElement("div");
        list.className = "anime-list";

        categorized[category].forEach((anime) => {
          const card = document.createElement("div");
          card.className = "anime-card";

          // 生成每個tag對應的表情符號
          const tagIcons =
            anime.tags && anime.tags.length > 0
              ? anime.tags
                  .map((tag) => {
                    if (typeof tag === "string") {
                      return tagEmojis[tag] || ""; // 如果是字串類型的tag，如 "完成"
                    } else if (typeof tag === "number") {
                      return getNumberEmojis(tag); // 如果是數字型tag，顯示對應數字表情
                    }
                    return ""; // 如果是其他類型，則不顯示
                  })
                  .join("")
              : ""; // 如果沒有標籤，顯示 "無標籤"

          card.innerHTML = `
            <h3 class="anime-title">${anime.title}</h3>
            ${
              anime.tags && anime.tags.includes("推薦")
                ? '<div class="recommend-icon">💖</div>'
                : ""
            }
            <div class="anime-tags">${tagIcons}</div>
          `;

          list.appendChild(card);
        });

        listContainer.appendChild(leftBtn);
        listContainer.appendChild(list);
        listContainer.appendChild(rightBtn);
        section.appendChild(listContainer);
        board.appendChild(section);

        // 加上滑鼠拖曳滑動功能
        enableDragScroll(list);
      }
    });

    // 加上左右按鈕功能
    enableHorizontalScrollWithButtons();
  })
  .catch((error) => {
    console.error("無法讀取 JSON 檔案:", error);
  });

// 右/左按鈕的滑動功能
function enableHorizontalScrollWithButtons() {
  const allLists = document.querySelectorAll(".anime-list-container");

  allLists.forEach((listContainer) => {
    const animeList = listContainer.querySelector(".anime-list");
    const leftBtn = listContainer.querySelector(".left-btn");
    const rightBtn = listContainer.querySelector(".right-btn");

    if (animeList && leftBtn && rightBtn) {
      // 確保這些元素存在
      leftBtn.addEventListener("click", () => {
        const scrollAmount = animeList.offsetWidth; // 每次滑動一個視窗寬度
        animeList.scrollLeft -= scrollAmount; // 向左滑動
      });

      rightBtn.addEventListener("click", () => {
        const scrollAmount = animeList.offsetWidth; // 每次滑動一個視窗寬度
        animeList.scrollLeft += scrollAmount; // 向右滑動
      });
    } else {
      console.warn("某些元素未正確加載，無法設置事件");
    }
  });
}

// 拖曳滑動功能
function enableDragScroll(container) {
  let isDown = false;
  let startX;
  let scrollLeft;

  // 禁止選擇文字
  function disableTextSelection() {
    container.style.userSelect = "none";
  }

  // 恢復選擇文字
  function enableTextSelection() {
    container.style.userSelect = "";
  }

  container.addEventListener("mousedown", (e) => {
    isDown = true;
    container.classList.add("active");
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;

    // 禁止選擇文字
    disableTextSelection();
  });

  container.addEventListener("mouseleave", () => {
    isDown = false;
    container.classList.remove("active");
    // 恢復選擇文字
    enableTextSelection();
  });

  container.addEventListener("mouseup", () => {
    isDown = false;
    container.classList.remove("active");
    // 恢復選擇文字
    enableTextSelection();
  });

  container.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();

    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;

    container.scrollLeft = scrollLeft - walk;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.toLowerCase();
      let found = false;

      const allAnimeCards = document.querySelectorAll(".anime-card");
      allAnimeCards.forEach((card) => {
        card.classList.remove("highlight");
      });

      allAnimeCards.forEach((card) => {
        const title = card
          .querySelector(".anime-title")
          .textContent.trim()
          .toLowerCase();

        if (title.includes(query)) {
          found = true;
          card.classList.add("highlight");
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      if (!found) {
        alert("未找到" + query);
      }
    }
  });
});
