const filterButtonsContainer = document.querySelector(".filters");
const username = "partner0487";
const container = document.getElementById("repo-grid");

fetch(`https://api.github.com/users/${username}/repos?sort=updated`)
  .then((res) => res.json())
  .then((data) => {
    const languageSet = new Set();

    data.forEach((repo) => {
      if (repo.language) {
        languageSet.add(repo.language); // 收集語言
      }
      else{
        languageSet.add("Unknown"); // 收集語言
      }

      const card = document.createElement("div");
      card.className = "card";
      card.dataset.category = repo.language || "Unknown"; // 設定資料類別
      card.innerHTML = `
        <h2>${repo.name}</h2>
        <p>${repo.description || "（沒有描述）"}</p>
        <div class="repo-footer">
            <span class="language">
              ${
                repo.language
                  ? `<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${repo.language.toLowerCase()}/${repo.language.toLowerCase()}-original.svg" onerror="this.style.display='none'" width="16" height="16" style="vertical-align: middle; margin-right: 6px;" />`
                  : ""
              }
              ${repo.language || "未知語言"} ・ ⭐ ${repo.stargazers_count}
            </span>
            <a href="${
              repo.html_url
            }" target="_blank" class="repo-btn">🔗 GitHub</a>
        </div>
      `;
      container.appendChild(card);
    });

    // ✅ 自動建立語言按鈕
    const allBtn = `<button class="filter active" data-category="all">全部</button>`;
    const langBtns = Array.from(languageSet)
      .map((lang) => {
        return `<button class="filter" data-category="${lang}">${lang}</button>`;
      })
      .join("");
    filterButtonsContainer.innerHTML = allBtn + langBtns;

    // 🧠 設定按鈕點擊事件（重新綁定）
    const filterButtons = document.querySelectorAll(".filter");
    const cards = document.querySelectorAll(".card");

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        const category = button.dataset.category;
        cards.forEach((card) => {
          const match =
            card.dataset.category === category || category === "all";
            card.style.position = match ? "relative" : "absolute";
            card.style.visibility = match ? "visible" : "hidden"; // 使用 visibility 來控制顯示/隱藏
            card.style.opacity = match ? "1" : "0"; // 控制透明度，讓過渡更平滑
            card.style.position = match ? "relative" : "absolute";
        });
      });
    });
  })
  .catch((error) => {
    console.error("❌ 無法取得 GitHub 資料:", error);
    container.innerHTML = "<p>取得資料失敗 😢</p>";
  });
