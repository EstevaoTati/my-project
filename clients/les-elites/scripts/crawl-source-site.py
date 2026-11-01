#!/usr/bin/env python3
"""Crawl the current leselitespublishinghouse.com and save its content.

Runs on GitHub's runners (the Claude sandbox cannot reach the domain).
Output, committed to docs/source-site/ (never served):
  pages/<slug>.md      visible text of each page, headings kept
  pages/<slug>.json    title, url, headings, links, images, buttons
  wp/<endpoint>.json   WordPress / WooCommerce REST data when exposed
  images/              every content image (<= 3 MB)
  index.json           summary of everything found
"""
import json, os, re, sys, hashlib, time, urllib.parse as up
import requests
from bs4 import BeautifulSoup

BASE = os.environ.get("SITE", "https://leselitespublishinghouse.com/")
OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/source-site"
HOST = up.urlparse(BASE).netloc.replace("www.", "")
UA = {"User-Agent": "Mozilla/5.0 (compatible; LesElitesSiteAudit/1.0)"}
os.makedirs(f"{OUT}/pages", exist_ok=True); os.makedirs(f"{OUT}/images", exist_ok=True); os.makedirs(f"{OUT}/wp", exist_ok=True)
S = requests.Session(); S.headers.update(UA)

def same(u): return up.urlparse(u).netloc.replace("www.", "") == HOST
def norm(u): p = up.urlparse(u); return up.urlunparse((p.scheme, p.netloc, p.path or "/", "", p.query, ""))
def slug(u):
    p = up.urlparse(u); s = (p.path.strip("/") or "home") + (("-" + p.query) if p.query else "")
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", s)[:120]

seen, queue, pages, images = set(), [norm(BASE)], [], {}
# Seed with sitemaps when present.
for sm in ["sitemap.xml", "sitemap_index.xml", "wp-sitemap.xml", "page-sitemap.xml", "product-sitemap.xml", "post-sitemap.xml"]:
    try:
        r = S.get(up.urljoin(BASE, sm), timeout=20)
        if r.ok and "<loc>" in r.text:
            for loc in re.findall(r"<loc>\s*([^<]+)\s*</loc>", r.text):
                loc = loc.strip()
                if loc.endswith(".xml"):
                    try:
                        rr = S.get(loc, timeout=20)
                        queue += [norm(x.strip()) for x in re.findall(r"<loc>\s*([^<]+)\s*</loc>", rr.text) if same(x.strip()) and not x.strip().endswith(".xml")]
                    except Exception: pass
                elif same(loc): queue.append(norm(loc))
    except Exception: pass

def text_md(soup):
    for t in soup(["script", "style", "noscript", "svg", "iframe"]): t.decompose()
    out = []
    for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "figcaption", "button", "a", "span", "td", "th", "label"]):
        if el.find_parent(["p", "li", "blockquote", "button", "a", "td", "th"]) and el.name in ("span", "a"): continue
        txt = " ".join(el.get_text(" ", strip=True).split())
        if not txt or len(txt) < 2: continue
        if el.name.startswith("h"): out.append("#" * int(el.name[1]) + " " + txt)
        elif el.name == "li": out.append("- " + txt)
        elif el.name == "blockquote": out.append("> " + txt)
        elif el.name in ("button",): out.append(f"[button] {txt}")
        elif el.name == "a": out.append(f"[link] {txt} → {el.get('href', '')}")
        else: out.append(txt)
    dedup = []
    for line in out:
        if not dedup or dedup[-1] != line: dedup.append(line)
    return "\n\n".join(dedup)

while queue and len(pages) < 150:
    u = queue.pop(0)
    if u in seen: continue
    seen.add(u)
    if re.search(r"\.(jpg|jpeg|png|webp|gif|pdf|zip|mp4|css|js)$", u, re.I) or "/wp-admin" in u or "/cart" in u or "/checkout" in u or "/my-account" in u: continue
    try:
        r = S.get(u, timeout=25)
    except Exception as e:
        print("fail", u, e); continue
    if not r.ok or "text/html" not in r.headers.get("content-type", ""): continue
    soup = BeautifulSoup(r.text, "html.parser")
    meta = {
        "url": u, "status": r.status_code,
        "title": (soup.title.string.strip() if soup.title and soup.title.string else ""),
        "description": (soup.find("meta", attrs={"name": "description"}) or {}).get("content", ""),
        "og": {m.get("property"): m.get("content") for m in soup.find_all("meta") if (m.get("property") or "").startswith("og:")},
        "headings": [h.get_text(" ", strip=True) for h in soup.find_all(["h1", "h2", "h3"])],
        "links": sorted({norm(up.urljoin(u, a["href"])) for a in soup.find_all("a", href=True) if a["href"].startswith(("http", "/"))}),
        "images": [], "generator": (soup.find("meta", attrs={"name": "generator"}) or {}).get("content", ""),
    }
    for img in soup.find_all("img"):
        src = img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
        if img.get("srcset"):
            cands = [c.strip().split(" ")[0] for c in img["srcset"].split(",") if c.strip()]
            if cands: src = cands[-1]
        if not src or src.startswith("data:"): continue
        full = up.urljoin(u, src)
        meta["images"].append({"src": full, "alt": img.get("alt", "")})
        images.setdefault(full, img.get("alt", ""))
    for tag in soup.find_all(style=re.compile(r"background-image")):
        for m in re.findall(r"url\(['\"]?([^'\")]+)", tag["style"]):
            full = up.urljoin(u, m); images.setdefault(full, ""); meta["images"].append({"src": full, "alt": "(background)"})
    s = slug(u)
    with open(f"{OUT}/pages/{s}.md", "w") as f: f.write(f"<!-- {u} -->\n# {meta['title']}\n\n{text_md(BeautifulSoup(r.text, 'html.parser'))}\n")
    with open(f"{OUT}/pages/{s}.json", "w") as f: json.dump(meta, f, ensure_ascii=False, indent=1)
    pages.append({"url": u, "slug": s, "title": meta["title"]})
    for l in meta["links"]:
        if same(l) and l not in seen: queue.append(l)
    time.sleep(0.3)

# WordPress / WooCommerce REST, if exposed: cleanest source for products and pages.
wp = {}
for ep in ["wp-json/wp/v2/pages?per_page=100", "wp-json/wp/v2/posts?per_page=100", "wp-json/wp/v2/product?per_page=100",
           "wp-json/wc/store/v1/products?per_page=100", "wp-json/wc/store/products?per_page=100", "wp-json/wp/v2/media?per_page=100",
           "wp-json/wp/v2/categories?per_page=100", "wp-json"]:
    try:
        r = S.get(up.urljoin(BASE, ep), timeout=25)
        if r.ok and r.headers.get("content-type", "").startswith("application/json"):
            name = re.sub(r"[^a-z0-9]+", "-", ep.split("?")[0].lower()).strip("-")
            data = r.json()
            if ep == "wp-json": data = {k: data.get(k) for k in ("name", "description", "url", "home", "namespaces")}
            with open(f"{OUT}/wp/{name}.json", "w") as f: json.dump(data, f, ensure_ascii=False, indent=1)
            wp[name] = len(data) if isinstance(data, list) else "object"
    except Exception as e: print("wp fail", ep, e)

saved = []
for src, alt in list(images.items())[:400]:
    try:
        r = S.get(src, timeout=30, stream=True)
        if not r.ok or not r.headers.get("content-type", "").startswith("image/"): continue
        data = r.content
        if len(data) > 3_000_000: continue
        ext = (r.headers["content-type"].split("/")[1].split(";")[0].replace("jpeg", "jpg").replace("svg+xml", "svg"))
        name = re.sub(r"[^a-zA-Z0-9._-]+", "-", os.path.basename(up.urlparse(src).path))[:80] or hashlib.md5(src.encode()).hexdigest()[:10]
        if not name.lower().endswith("." + ext): name += "." + ext
        with open(f"{OUT}/images/{name}", "wb") as f: f.write(data)
        saved.append({"file": name, "src": src, "alt": alt, "bytes": len(data)})
    except Exception as e: print("img fail", src, e)

json.dump({"base": BASE, "crawled": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "pages": pages, "wp": wp, "images": saved},
          open(f"{OUT}/index.json", "w"), ensure_ascii=False, indent=1)
print(f"pages={len(pages)} images={len(saved)} wp={wp}")
