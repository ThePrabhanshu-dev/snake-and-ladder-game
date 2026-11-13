# 🐍 Snake & Ladder

A classic **Snake & Ladder** board game that runs in the browser. No build step, no dependencies — just open the file and play.

## 🔗 Live

**https://theprabhanshu-dev.github.io/snake-and-ladder-game/**

| Page | URL | Purpose |
|---|---|---|
| Game | [`/`](https://theprabhanshu-dev.github.io/snake-and-ladder-game/) | The full game with the interactive loader |
| Landing page | [`/play.html`](https://theprabhanshu-dev.github.io/snake-and-ladder-game/play.html) | SEO/landing page for traffic coming from other sites — ad slots + FAQ + CTA |
| Embed widget | [`/embed.js`](https://theprabhanshu-dev.github.io/snake-and-ladder-game/embed.js) | Drop-in "Play Snake & Ladder" card for any other website |

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
| `test.js` | Node test suite for `rules.js` |
| `og-image.svg`, `favicon.svg`, `manifest.webmanifest` | Social preview, icon, PWA manifest |
| `robots.txt`, `sitemap.xml` | Search-engine discovery |

## 🚀 Getting traffic from other websites

### 1. Enable real ads (AdSense)

1. Create a free [Google AdSense](https://www.google.com/adsense/start/) account and add your domain.
2. Open [`ads.js`](ads.js) and set your publisher id:

```js
var CONFIG = {
  adsenseClient: "ca-pub-XXXXXXXXXXXXXXXX",   // <- your publisher id
  adsenseSlots: { top: "1234567890", side: "2345678901", foot: "3456789012" },
  ...
};
```

3. Push the change — the house-ad placeholders are replaced automatically by live AdSense units.

Three slots exist: `top` (above the board), `side` (in the sidebar), `foot` (below the board). `play.html` adds more via `data-ad="..."`.

### 2. Embed the game on another website

Add this to any page on a partner site:

```html
<div class="snl-game-embed" data-ref="partnerName"></div>
<script src="https://theprabhanshu-dev.github.io/snake-and-ladder-game/embed.js?v=1.0.1" async></script>
```

Use `data-variant="button"` for a small button instead of the full card. Every click is tagged with
`?ref=partnerName&utm_source=partnerName` so you can see which partners send players.

### 3. Programmatic referral links

```js
window.GamePromo.partnerLink("mysite.com");
// -> https://theprabhanshu-dev.github.io/snake-and-ladder-game/?ref=mysite.com&utm_source=mysite.com&utm_medium=partner
```

Visitors arriving with `?ref=` see a "You were invited by …" banner and the code is stored in `localStorage`
under `snl_ref`.

### 4. SEO & sharing

`robots.txt`, `sitemap.xml`, Open Graph / Twitter cards and a social preview image (`og-image.svg`) are all
included, so links shared on WhatsApp, Facebook, X, Reddit and Telegram render a rich preview.

## Tests

```bash
node test.js
```

Covers board coordinate mapping, ladder/snake resolution, movement, overshoot handling,
the win condition, the three-sixes penalty, and runs 500 randomized full games to confirm
no game can loop forever or push a pawn outside the 0–100 range.

```
43 passed, 0 failed
```

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
