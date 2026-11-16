#!/usr/bin/env python3
"""Sanity checks for the site's source files.

Verifies that every HTML page is valid UTF-8, has a canonical URL pointing at
the live domain, and carries the AdSense publisher tag + script.

Usage:  python tools/check-site.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://snake-and-ladder-2q0.pages.dev"
PUB = "ca-pub-8439899281485854"
PAGES = [
    "index.html", "play.html", "how-to-play.html", "about.html",
    "contact.html", "privacy.html", "strategy.html", "daily-challenge.html",
    "ludo.html",
]

failures = []


def check(cond, message):
    if cond:
        print("  PASS  " + message)
    else:
        print("  FAIL  " + message)
        failures.append(message)


def main():
    print("File encoding")
    for name in os.listdir(ROOT):
        if not name.endswith((".html", ".js", ".txt", ".xml", ".json", ".webmanifest")):
            continue
        path = os.path.join(ROOT, name)
        try:
            raw = open(path, "rb").read()
            text = raw.decode("utf-8")
        except UnicodeDecodeError as e:
            check(False, f"{name} is not valid UTF-8 ({e})")
            continue
        bad = sum(text.count(m) for m in ("Ã", "â€", "Â"))
        check(bad == 0, f"{name} is clean UTF-8 (mojibake={bad})")

    print("\nPer-page SEO + AdSense")
    for page in PAGES:
        path = os.path.join(ROOT, page)
        if not os.path.exists(path):
            print(f"  SKIP  {page} (missing)")
            continue
        text = open(path, encoding="utf-8").read()

        m = re.search(r'<link rel="canonical" href="([^"]+)"', text)
        check(bool(m), f"{page} has a canonical link")
        if m:
            check(m.group(1).startswith(SITE), f"{page} canonical points at the live domain")

        check(f'<meta name="google-adsense-account" content="{PUB}"' in text,
              f"{page} declares the AdSense publisher id")
        check("adsbygoogle.js?client=" + PUB in text,
              f"{page} loads the AdSense script")
        check('<meta name="description"' in text, f"{page} has a meta description")
        check(re.search(r'<h1[\s>]', text) is not None, f"{page} has exactly one h1")
        check(text.count("<h1") == 1, f"{page} has a single h1 (found {text.count('<h1')})")
        check("application/ld+json" in text, f"{page} has JSON-LD structured data")

    print("\nShared assets")
    for asset in ("ads.js", "rules.js", "loader.js", "ads.txt", "og-image.png",
                  "sitemap.xml", "robots.txt", "404.html", "ludo.html",
                  "ludo.js", "ludo-rules.js"):
        check(os.path.exists(os.path.join(ROOT, asset)), f"{asset} exists")

    ads_txt = open(os.path.join(ROOT, "ads.txt"), encoding="utf-8").read()
    check("pub-8439899281485854" in ads_txt,
          "ads.txt lists the real publisher id")
    check("pub-0000000000000000" not in ads_txt,
          "ads.txt has no placeholder publisher id")

    ads_js = open(os.path.join(ROOT, "ads.js"), encoding="utf-8").read()
    slots = re.search(r"adsenseSlots:\s*\{([^}]+)\}", ads_js).group(1)
    ids = re.findall(r'"\s*(\d+)\s*"', slots)
    check(len(ids) == 3 and all(re.fullmatch(r"\d{6,}", i) for i in ids),
          f"ads.js has three real ad-slot ids ({ids})")

    print("\n" + ("ALL CHECKS PASSED" if not failures else f"{len(failures)} FAILURES"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
