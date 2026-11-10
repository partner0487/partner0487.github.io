"""
統計 GitHub 上每個語言「有寫的月份」，存成 data/github-activity.json，給關於頁的技能等級用。

- commitMonths：有 commit 的所有月份（Git 的等級）
- languages：每個語言有 commit 改到它的檔案的月份；只算 character.json 的 githubFrom 之後
  （之前的經驗已經算在技能的 base 裡，不重複算）

只看公開 repo、作者是自己的 commit。GitHub Action 每週跑一次（.github/workflows/github-activity.yml），
本機也可以跑：  GITHUB_TOKEN=$(gh auth token) python scripts/github_activity.py
"""
import json
import os
import urllib.request
from datetime import date
from pathlib import Path

USER = "partner0487"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "github-activity.json"

# 副檔名 → 語言（名字要和 character.json 技能的 github 欄位一樣）
EXT = {
    "cpp": "C++", "cc": "C++", "cxx": "C++", "hpp": "C++", "h": "C++", "c": "C",
    "py": "Python", "ipynb": "Python",
    "html": "HTML", "css": "CSS", "scss": "CSS", "js": "JavaScript", "jsx": "JavaScript", "mjs": "JavaScript",
    "ts": "TypeScript", "tsx": "TypeScript", "java": "Java", "kt": "Kotlin", "kts": "Kotlin",
    "dart": "Dart", "php": "PHP", "sql": "SQL", "v": "Verilog", "sv": "Verilog", "s": "MIPS", "asm": "MIPS",
}
# 別人寫的套件、產生出來的檔案不算
SKIP = ("node_modules/", "site-packages/", "third_party/", "vendor/", "dist/", "build/", ".min.")


def api(path):
    req = urllib.request.Request(f"https://api.github.com/{path}", headers={"Accept": "application/vnd.github+json"})
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def paged(path):
    page = 1
    while True:
        items = api(f"{path}{'&' if '?' in path else '?'}per_page=100&page={page}")
        yield from items
        if len(items) < 100:
            return
        page += 1


def main():
    since = json.loads((ROOT / "data" / "character.json").read_text(encoding="utf-8"))["githubFrom"]
    commit_months = set()
    langs = {}
    for repo in paged(f"users/{USER}/repos?type=owner"):
        name = repo["name"]
        if repo["size"] == 0:
            continue
        for c in paged(f"repos/{USER}/{name}/commits?author={USER}"):
            month = c["commit"]["author"]["date"][:7]
            commit_months.add(month)
            if month < since:
                continue  # 之前的只要算 Git 月份，不用看改了哪些檔案
            for f in api(f"repos/{USER}/{name}/commits/{c['sha']}").get("files", []):
                path = f["filename"].lower()
                base = path.rsplit("/", 1)[-1]
                if any(s in path for s in SKIP) or "." not in base:
                    continue
                lang = EXT.get(base.rsplit(".", 1)[-1])
                if lang:
                    langs.setdefault(lang, set()).add(month)

    data = {
        "updated": date.today().isoformat(),
        "since": since,
        "commitMonths": sorted(commit_months),
        "languages": {k: sorted(v) for k, v in sorted(langs.items())},
    }
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    # 只有日期變了就不寫檔，省得每週都多一個沒意義的 commit
    if {k: v for k, v in old.items() if k != "updated"} == {k: v for k, v in data.items() if k != "updated"}:
        print("沒有變化")
        return
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Git {len(commit_months)} 個月；", {k: len(v) for k, v in langs.items()})


if __name__ == "__main__":
    main()
