# 🐍 Snake & Ladder

A classic **Snake & Ladder** board game that runs in the browser. No build step, no dependencies — just open the file and play.

## 🔗 Live

**https://snake-and-ladder-2q0.pages.dev/**

Mirror: https://theprabhanshu-dev.github.io/snake-and-ladder-game/ (GitHub Pages — the canonical
URL on every page points at the Cloudflare Pages domain).

| Page | URL | Purpose |
|---|---|---|
| Game | [`/`](https://snake-and-ladder-2q0.pages.dev/) | The full game with the interactive loader |
| Landing page | [`/play.html`](https://snake-and-ladder-2q0.pages.dev/play.html) | SEO/landing page for traffic coming from other sites — ad slots + FAQ + CTA |
| How to play | [`/how-to-play.html`](https://snake-and-ladder-2q0.pages.dev/how-to-play.html) | Full rules + board map |
| Strategy | [`/strategy.html`](https://snake-and-ladder-2q0.pages.dev/strategy.html) | Openings, safe squares, decision guide |
| Daily challenge | [`/daily-challenge.html`](https://snake-and-ladder-2q0.pages.dev/daily-challenge.html) | Same seeded board + dice sequence for everyone |
| Embed widget | [`/embed.js`](https://snake-and-ladder-2q0.pages.dev/embed.js) | Drop-in "Play Snake & Ladder" card for any other website |

Repository: https://github.com/ThePrabhanshu-dev/snake-and-ladder-game (deployed via GitHub Pages from `main`).

## Play locally

```bash
cd D:\Go_Go && python -m http.server 8000
# then visit http://localhost:8000
```

Serving over `http://` is needed so the browser loads the sibling `.js` files.

## Features

- **10×10 board** with authentic boustrophedon numbering (1 at bottom-left, 100 at top-left)
- **9 ladders and 6 snakes**, drawn as SVG and precisely aligned to the squares they connect
- **2–4 players** — press **Add Player** to add up to 4 (restarting the game)
- **Animated dice** with a shake-and-roll effect
- **Token animation** — the pawn walks square by square, then rides the ladder or slides down the snake
- **Correct classic rules**:
  - Roll a **6** to roll again
  - Land on a ladder base → climb to the top
  - Land on a snake head → slide to the tail
  - You need an **exact 100** to win; overshooting ends your turn
  - **Three 6s in a row** sends you back to the start
- **Responsive layout** — board and side panel stack on narrow screens
- **Live position readout** for every player
- **Interactive loading screen** — animated ladder, slithering snake, tumbling dice, progress bar and rotating tips, with a skip button
- **Ad slots** wired up and AdSense-ready, with a house-ad fallback so the layout never breaks
- **Daily Challenge** — a date-seeded dice sequence so every player worldwide gets the same board,
  plus a shareable `?challenge=YYYY-MM-DD` link and a "Challenge a friend" button
- **Cross-promotion** — share buttons, referral links and a game-portal strip

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup, styling and the browser game (UI/animation layer) |
| `rules.js` | Shared game rules — board coordinates, ladders/snakes, turn resolution |
| `loader.js` | Interactive loading screen |
| `ads.js` | Ad slots (AdSense-ready) + share/referral/portal promo system |
| `embed.js` | Drop-in widget for embedding the game on other websites |
| `play.html` | Landing page for external traffic (ad slots, FAQ, CTA) |
| `how-to-play.html` | Rules + board map guide page (SEO content, AdSense approval) |
| `strategy.html` | Decision guide — openings, safe squares, when to chase a ladder |
| `daily-challenge.html` | Daily Challenge landing page (same board for everyone) |
| `about.html`, `contact.html`, `privacy.html` | Required compliance pages for AdSense |
| `ads.txt` | Authorised sellers list for the domain (auto-generated on deploy) |
| `deploy.js` | One-command free deploy to Cloudflare Pages |
| `set-adsense.js` | Wire an AdSense publisher id + slot ids into `ads.js` |
| `verify-adsense.js` | Check that the live site really serves the AdSense setup |
| `add-domain.js` | Attach/remove a custom domain on the Pages project |
| `test.js` | Node test suite for `rules.js` |
| `og-image.svg`, `og-image.png`, `favicon.svg`, `manifest.webmanifest` | Social preview, icon, PWA manifest |
| `robots.txt`, `sitemap.xml` | Search-engine discovery |
| `tools/check-site.py` | Source sanity checks (encoding, canonical, AdSense tag, JSON-LD) |
| `tools/make-og-image.py` | Regenerates `og-image.png` from the SVG design |
| `tools/fix-encoding.py` | Repairs mojibake in text files |

## 🚀 Getting traffic from other websites

### 1. Enable real ads (AdSense)

> AdSense requires a **custom domain** — a `*.pages.dev` or `*.github.io` subdomain is not approved.
> Buy a domain, point it at Cloudflare Pages (free SSL) and use that URL in AdSense.

**Step A — get a domain and attach it**

Buy a `.com` (≈ ₹900/yr) or a cheaper `.fun` / `.games` / `.app` (₹250–600/yr) at
[Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (at-cost, no markup) or any
registrar, then point the nameservers at Cloudflare and attach it to the Pages project:

```bash
node add-domain.js yourdomain.com          # attach
node add-domain.js --remove yourdomain.com # detach
```

**Step B — create the AdSense account**

1. Sign up at [adsense.google.com/start](https://www.google.com/adsense/start/) with your Google account.
2. Choose **"Websites"** as the site type, enter `https://yourdomain.com` and confirm.
3. Turn on **Auto ads** (or create manual units for the `top` / `side` / `foot` slots) and copy the
   three ad-slot IDs.
4. Paste your publisher id and (optionally) the three ad-slot ids into the site:

```bash
node set-adsense.js --client ca-pub-XXXXXXXXXXXXXXXX
node set-adsense.js --client ca-pub-XXXXXXXXXXXXXXXX --slots top=111,side=222,foot=333
```

5. Deploy — the house-ad placeholders are replaced automatically by live AdSense units and
   [`ads.txt`](ads.txt) is regenerated with your publisher id automatically:

```bash
node deploy.js
```

6. Verify the live site is really serving the ads:

```bash
node verify-adsense.js            # checks the pages.dev site
node verify-adsense.js https://yourdomain.com
```

7. In AdSense → **Sites**, request review for your domain. Approval usually takes 1–14 days.

Three slots exist: `top` (above the board), `side` (in the sidebar), `foot` (below the board). `play.html` adds more via `data-ad="..."`.

**Approval checklist (all already on the site):**

| Requirement | Where |
|---|---|
| Privacy policy | [`privacy.html`](privacy.html) |
| About page | [`about.html`](about.html) |
| Contact page | [`contact.html`](contact.html) |
| `ads.txt` at domain root | [`ads.txt`](ads.txt) (auto-generated) |
| `robots.txt` + `sitemap.xml` | already present |
| AdSense script + `ins` slots | loaded by [`ads.js`](ads.js) |

### 2. Embed the game on another website

Add this to any page on a partner site:

```html
<div class="snl-game-embed" data-ref="partnerName"></div>
<script src="https://snake-and-ladder-2q0.pages.dev/embed.js?v=1.1.0" async></script>
```

Use `data-variant="button"` for a small button instead of the full card. Every click is tagged with
`?ref=partnerName&utm_source=partnerName` so you can see which partners send players.

### 3. Programmatic referral links

```js
window.GamePromo.partnerLink("mysite.com");
// -> https://snake-and-ladder-2q0.pages.dev/?ref=mysite.com&utm_source=mysite.com&utm_medium=partner
```

Visitors arriving with `?ref=` see a "You were invited by …" banner and the code is stored in `localStorage`
under `snl_ref`.

### 4. SEO & sharing

`robots.txt`, `sitemap.xml`, Open Graph / Twitter cards and a social preview image (`og-image.png`) are all
included, so links shared on WhatsApp, Facebook, X, Reddit and Telegram render a rich preview.

### 5. Daily Challenge links

The game accepts a `?challenge=YYYY-MM-DD` query parameter, which seeds the dice generator with that
date so every player gets the exact same sequence of rolls:

```
https://snake-and-ladder-2q0.pages.dev/?challenge=2026-11-14
```

Use it to share today's board, or to replay yesterday's board. The seed comes from
`Rules.hashSeed(date)` and `Rules.mulberry32(seed)` in [`rules.js`](rules.js), both covered by the test suite.

## Tests

```bash
node test.js
```

Covers board coordinate mapping, ladder/snake resolution, movement, overshoot handling,
the win condition, the three-sixes penalty, the seeded RNG used by the Daily Challenge, and runs
500 randomized full games to confirm no game can loop forever or push a pawn outside the 0–100 range.

```
52 passed, 0 failed
```

## 🌐 Free hosting (Cloudflare Pages)

The game is published free on **Cloudflare Pages** (unlimited bandwidth, no cost) — this is the
canonical domain used by every page's `<link rel="canonical">`:

**https://snake-and-ladder-2q0.pages.dev/**

Deploy an update with one command:

```bash
npx wrangler login   # one-time browser auth (only needed once)
node deploy.js       # stages the site files and uploads them
```

`deploy.js` copies only the site assets into a temp folder (never `.git`, tests or scripts)
and runs `wrangler pages deploy` against the `snake-and-ladder` project on branch `main`.
A custom domain can be attached in the Cloudflare dashboard — SSL is issued free and auto-renewed.

## Extending

Board layouts live in one place — the `JUMPS` map in `rules.js`:

```js
const JUMPS = {
  1: 38,   // ladder: square 1  → 38
  16: 6,   // snake:  square 16 → 6
  ...
};
```

A higher value is a ladder (up), a lower value is a snake (down). Add or remove entries
there and both the game board and the tests pick up the change automatically.

## Deploying

The site is published with GitHub Pages from the `main` branch. To publish a change:

```bash
git add -A
git commit -m "your message"
git push origin main
```

Pages rebuilds automatically (~1 minute). Check the deployment at
**Repo → Settings → Pages**.

The same files are mirrored to Cloudflare Pages with `node deploy.js` (see
[Free hosting](#-free-hosting-cloudflare-pages)).

### Before you deploy

```bash
node test.js             # game rules + seeded RNG unit tests
python tools/check-site.py   # encoding, canonical URLs, AdSense tag, JSON-LD, assets
node verify-adsense.js   # checks the *live* site serves the AdSense setup
```
