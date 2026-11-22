"""把記事本的動漫清單（txt）轉成 data/anime.json。

用法：python scripts/anime_txt.py <清單.txt>

txt 的格式（我平常用記事本記的樣子）：
  - 「2019年」「進行中」「未看」「未看續作」這種一行是分組
  - 每一行一部，後面接表情符號當標記：
      ✅ 完成  🥰 推薦  🎬 電影  ⏩️ 看解說  🇨🇳 🇯🇵 🇰🇷 真人影劇（陸劇、日劇、韓劇）
  - 同一個符號重複幾次 = 看了幾遍（罪惡王冠✅✅✅ 是看了三次、天氣之子🎬🎬 是看了兩次）
  - 「進行中」後面的數字表情（4️⃣0️⃣）是看到第幾集，🔟2️⃣ 當成 12
  - 第一個分組前面的說明行會略過
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "anime.json"

GROUPS = {"進行中", "未看", "未看續作"}
TAGS = [("✅", "完成"), ("🥰", "推薦"), ("🎬", "電影"), ("⏩", "解說"), ("🇨🇳", "陸劇"), ("🇯🇵", "日劇"), ("🇰🇷", "韓劇")]
VS = "️"  # 表情符號後面常跟著的「變體選擇符」，有的有、有的沒有
KEYCAP = "⃣"


def parse_line(line):
    text = line.replace(VS, "")
    times = max(text.count("✅"), text.count("🎬"))  # 重複的勾 = 看了幾遍
    tags = []
    for emoji, name in TAGS:
        if emoji in text:
            tags.append(name)
            text = text.replace(emoji, " ")
    if "[電影]" in text:
        tags.append("電影")
        text = text.replace("[電影]", " ")

    # 數字表情：0⃣ ~ 9⃣（數字 + U+20E3）、🔟
    progress = None
    m = re.search(r"(🔟|\d" + KEYCAP + r")+", text)
    if m:
        digits = m.group(0)
        if digits.startswith("🔟"):
            rest = re.findall(r"\d", digits[1:])
            progress = 10 + int(rest[0]) if len(rest) == 1 else 10
        else:
            progress = int("".join(re.findall(r"\d", digits)))
        text = text[: m.start()]  # 集數後面的東西（顏文字、看到幾分幾秒）不要

    title = re.sub(r"\s+", " ", text).strip()
    item = {"title": title, "tags": sorted(set(tags), key=[n for _, n in TAGS].index)}
    if progress is not None:
        item["progress"] = progress
    if times > 1:
        item["times"] = times
    return item


def parse(path):
    group = None
    items = []
    for raw in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.fullmatch(r"(\d{4})年", line)
        if m or line in GROUPS:
            group = m.group(1) if m else line
            continue
        if group is None:
            continue  # 檔案開頭的說明
        item = parse_line(line)
        if item["title"]:
            items.append({"group": group, **item})
    return items


if __name__ == "__main__":
    items = parse(sys.argv[1])
    OUT.write_text(
        "[\n" + ",\n".join(json.dumps(i, ensure_ascii=False) for i in items) + "\n]\n",
        encoding="utf-8",
    )
    print(f"{len(items)} 部 → {OUT.relative_to(ROOT)}")
