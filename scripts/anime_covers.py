"""幫 data/anime.json 的每一部找封面，下載到 images/anime/，對應記在 data/anime-covers.json。

用法：python scripts/anime_covers.py [--sheet 總覽圖.png]

- 先用 Bangumi（bgm.tv，有中文片名）搜尋，從前 10 筆裡挑片名最像的；
  分數太低再用 AniList（日文 / 英文片名，像 DARLING in the FRANXX、GACHIAKUTA 這種）
- data/anime-covers.json 裡已經有的就不會重查，所以可以手動修正：
    "片名": {"search": "換一個關鍵字"}        → 用這個關鍵字重新查
    "片名": {"bgm": 400602}                   → 直接指定 Bangumi 的條目編號
    "片名": {"none": true}                    → 不要封面
    "片名": {"file": "images/anime/xxx.webp"} → 自己找的圖（Bangumi / AniList 都沒有的，像 2017 年的真人劇《端腦》）
    "片名": {"search": "…", "type": [6]}      → 不是動畫（像韓劇）要查 Bangumi 的「三次元」分類
  改完把那一筆的 "file" 刪掉再跑一次就會重抓
- 圖片縮成 280px 寬的 WebP
- --sheet：另外輸出一張所有封面 + 片名的總覽圖，方便一次檢查有沒有對錯
"""
import io
import json
import re
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path

import requests
from opencc import OpenCC
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ANIME = ROOT / "data" / "anime.json"
COVERS = ROOT / "data" / "anime-covers.json"
IMG_DIR = ROOT / "images" / "anime"
UA = {"User-Agent": "partner0487-site/1.0 (https://github.com/partner0487/partner0487.github.io)"}
t2s = OpenCC("t2s").convert


def norm(s):
    s = t2s(s or "").lower()
    return re.sub(r"[\W_]+", "", s)  # 拿掉空白和標點，只比字


def score(query, cand, movie):
    q = norm(query)
    best = 0
    for name in (cand.get("name_cn"), cand.get("name")):
        n = norm(name)
        if not n:
            continue
        r = SequenceMatcher(None, q, n).ratio()
        if q in n or n in q:
            r += 0.2
        best = max(best, r)
    platform = cand.get("platform") or ""
    if movie and platform in ("剧场版", "电影"):
        best += 0.15
    if not movie and platform in ("剧场版", "电影"):
        best -= 0.1
    return round(best, 3)


def bangumi_search(keyword, types=(2,)):
    r = requests.post(
        "https://api.bgm.tv/v0/search/subjects?limit=10",
        json={"keyword": keyword, "filter": {"type": list(types)}},
        headers=UA,
        timeout=20,
    )
    r.raise_for_status()
    return r.json().get("data", [])


def bangumi_subject(sid):
    r = requests.get(f"https://api.bgm.tv/v0/subjects/{sid}", headers=UA, timeout=20)
    r.raise_for_status()
    return r.json()


def anilist_search(keyword):
    q = """query ($s: String) { Media(search: $s, type: ANIME) { id title { native romaji } coverImage { large } } }"""
    r = requests.post("https://graphql.anilist.co", json={"query": q, "variables": {"s": keyword}}, timeout=20)
    if r.status_code != 200:
        return None
    m = (r.json().get("data") or {}).get("Media")
    if not m:
        return None
    return {"id": m["id"], "name": m["title"]["native"] or m["title"]["romaji"], "image": m["coverImage"]["large"]}


def download(url, dest):
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    im = Image.open(io.BytesIO(r.content)).convert("RGB")
    w = 280
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=80, method=6)


def find(title, entry, movie):
    """回傳 (來源, 編號, 對到的片名, 分數, 圖片網址)"""
    if entry.get("bgm"):
        s = bangumi_subject(entry["bgm"])
        return "bgm", s["id"], s.get("name_cn") or s.get("name"), 1.0, s["images"]["common"]
    keyword = entry.get("search") or title
    results = bangumi_search(keyword, entry.get("type", [2]))
    time.sleep(0.4)
    if results:
        best = max(results, key=lambda c: score(keyword, c, movie))
        sc = score(keyword, best, movie)
        if sc >= 0.45 or entry.get("search"):
            return "bgm", best["id"], best.get("name_cn") or best.get("name"), sc, best["images"]["common"]
    a = anilist_search(keyword)
    time.sleep(0.8)
    if a:
        return "anilist", a["id"], a["name"], 0.0, a["image"]
    if results:  # AniList 也找不到：還是用 Bangumi 最像的那個，標低分讓人檢查
        return "bgm", best["id"], best.get("name_cn") or best.get("name"), sc, best["images"]["common"]
    return None


def main():
    anime = json.loads(ANIME.read_text(encoding="utf-8"))
    covers = json.loads(COVERS.read_text(encoding="utf-8")) if COVERS.exists() else {}
    for item in anime:
        title = item["title"]
        entry = covers.setdefault(title, {})
        if entry.get("none") or entry.get("file"):
            continue
        try:
            found = find(title, entry, "電影" in item["tags"])
        except requests.RequestException as e:
            print("✗", title, e)
            continue
        if not found:
            print("？找不到", title)
            continue
        source, sid, name, sc, url = found
        dest = IMG_DIR / f"{source}-{sid}.webp"
        if not dest.exists():
            download(url, dest)
        entry.update({"source": source, "id": sid, "name": name, "score": sc, "file": dest.relative_to(ROOT).as_posix()})
        print(f"{'⚠' if sc < 0.6 else '✓'} {title} → {name} ({sc})")
        COVERS.write_text(json.dumps(covers, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # 清掉沒用到的圖（之前對錯、後來改掉的）
    used = {e["file"] for e in covers.values() if e.get("file")}
    for f in IMG_DIR.glob("*.webp"):
        if f.relative_to(ROOT).as_posix() not in used:
            f.unlink()

    if "--sheet" in sys.argv:
        contact_sheet(anime, covers, Path(sys.argv[sys.argv.index("--sheet") + 1]))


def contact_sheet(anime, covers, out):
    from PIL import ImageDraw, ImageFont

    font = ImageFont.truetype("C:/Windows/Fonts/msjh.ttc", 13)
    cw, ch, cols = 150, 270, 12
    rows = -(-len(anime) // cols)
    sheet = Image.new("RGB", (cw * cols, ch * rows), "white")
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(anime):
        x, y = (i % cols) * cw, (i // cols) * ch
        e = covers.get(item["title"], {})
        if e.get("file"):
            im = Image.open(ROOT / e["file"])
            im.thumbnail((140, 200))
            sheet.paste(im, (x + 5, y + 5))
        low = e.get("score", 1) < 0.6
        draw.text((x + 5, y + 208), f"{i + 1}. {item['title'][:10]}", font=font, fill="#000")
        draw.text((x + 5, y + 226), f"→ {(e.get('name') or '（沒有）')[:10]}", font=font, fill="#c00" if low else "#06a")
        draw.text((x + 5, y + 244), f"{e.get('source', '')} {e.get('score', '')}", font=font, fill="#888")
    sheet.save(out)
    print("總覽圖：", out)


if __name__ == "__main__":
    main()
