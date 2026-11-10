// 作品頁：從 data/projects.json 讀取作品，依分類顯示
// 分類和介紹跟 GitHub profile README 一致，新增作品只要改 JSON

const filtersEl = document.querySelector(".filters");
const listEl = document.getElementById("project-list");

const langNames = {
  python: "Python",
  dart: "Dart",
  react: "React",
  kotlin: "Kotlin",
  html: "HTML",
  java: "Java",
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function createCard(project) {
  const card = el("article", "card");

  const head = el("div", "card-head");
  if (project.icon) {
    const icon = el("img", "project-icon");
    icon.src = project.icon;
    icon.alt = "";
    if (project.iconBg) icon.style.background = project.iconBg;
    head.appendChild(icon);
  }
  head.appendChild(el("h3", null, project.name));
  card.appendChild(head);

  card.appendChild(el("p", null, project.desc));

  const footer = el("div", "repo-footer");
  const lang = el("span", "language");
  const langIcon = el("img");
  langIcon.src = `https://skillicons.dev/icons?i=${project.lang}`;
  langIcon.alt = "";
  lang.append(langIcon, langNames[project.lang] || project.lang);
  footer.appendChild(lang);

  const links = el("div", "repo-links");
  project.links.forEach((link) => {
    const a = el("a", "repo-btn", link.label);
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener";
    links.appendChild(a);
  });
  footer.appendChild(links);
  card.appendChild(footer);

  return card;
}

function showCategory(category) {
  filtersEl.querySelectorAll(".filter").forEach((btn) => {
    const active = btn.dataset.category === category;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active);
  });
  listEl.querySelectorAll(".category").forEach((section) => {
    section.hidden = category !== "all" && section.dataset.category !== category;
  });
}

function addFilter(label, category) {
  const btn = el("button", "filter", label);
  btn.type = "button";
  btn.dataset.category = category;
  btn.addEventListener("click", () => showCategory(category));
  filtersEl.appendChild(btn);
}

fetch("data/projects.json")
  .then((res) => res.json())
  .then((groups) => {
    addFilter("全部", "all");
    groups.forEach((group) => {
      addFilter(group.category, group.category);

      const section = el("section", "category");
      section.dataset.category = group.category;
      section.appendChild(el("h2", null, group.category));
      const grid = el("div", "card-grid");
      group.projects.forEach((project) => grid.appendChild(createCard(project)));
      section.appendChild(grid);
      listEl.appendChild(section);
    });
    showCategory("all");
  })
  .catch((error) => {
    console.error("無法讀取作品資料:", error);
    listEl.textContent = "作品資料讀取失敗 😢";
  });
