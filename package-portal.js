#!/usr/bin/env node
/**
 * Build a self-contained HTML5 build of the game for third-party portals
 * (itch.io, Newgrounds, CrazyGames, GameDistribution, ...) plus the listing
 * metadata needed to fill in each portal's submission form.
 *
 *   node package-portal.js          # build the package
 *   node package-portal.js --list   # only print the listing metadata
 *
 * Output (git-ignored):
 *   dist/snake-and-ladder-portal.zip   the uploadable build
 *   dist/listing.txt                   copy/paste metadata for every portal
 *   dist/cover.png, dist/thumb.png     cover art + square thumbnail
 *
 * The build strips Google AdSense (portals forbid ad scripts in submissions)
 * and leaves the ad slots empty, so the game never ships a malformed tag.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const ZIP_NAME = "snake-and-ladder-portal.zip";

/* ---------- listing metadata ---------- */

const LISTING = {
  title: "Snake & Ladder",
  tagline: "Classic board game — roll the dice, climb the ladders, dodge the snakes.",
  shortDescription:
    "Play the classic Snake & Ladder board game free in your browser. 2-4 players, " +
    "9 ladders, 6 snakes, a daily challenge with the same board for everyone, and a board quiz.",
  longDescription: [
    "Snake & Ladder is the classic board game, rebuilt as a fast, clean browser game - no " +
    "download, no signup, no waiting.",
    "Roll a six to roll again. Land on a ladder base and climb to the top. Land on a snake " +
    "head and slide back to its tail. You need an exact 100 to win, so overshooting ends your " +
    "turn, and three sixes in a row sends you back to the start.",
    "Features: 2-4 players (or play against the computer), an animated board with a board " +
    "explorer you can hover or tap, a Daily Challenge that gives every player worldwide the " +
    "same seeded board, a board quiz, 11 badges and a 7-day play calendar, sound effects, " +
    "keyboard play and a responsive layout that works on phones and tablets.",
    "Everything is client side, so the game is instant and works offline once loaded."
  ].join("\n\n"),
  tags: [
    "snake and ladder", "snakes and ladders", "board game", "multiplayer", "casual",
    "family", "offline", "html5", "2 players", "party game"
  ],
  category: "Board / Casual / Family",
  url: "https://snake-and-ladder-2q0.pages.dev/",
  embedSnippet:
    '<div class="snl-game-embed" data-ref="partnerName"></div>\n' +
    '<script src="https://snake-and-ladder-2q0.pages.dev/embed.js?v=1.1.0" async></script>'
};

/* ---------- build the portal variants of the source files ---------- */

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function portalIndex() {
  let html = read("index.html");
  // No Google AdSense inside a portal build - portals reject ad scripts.
  html = html.replace(/<script[^>]*googlesyndication\.com[^>]*>\s*<\/script>\s*/g, "");
  // Keep only the local game scripts (ads.js stays, it renders share buttons).
  return html;
}

function portalAds() {
  let src = read("ads.js");
  // Portals serve their own ads, so no AdSense client.
  src = src.replace(/adsenseClient:\s*"[^"]*"/, 'adsenseClient: ""');
  src = src.replace(/adsenseApproved:\s*(true|false)/, "adsenseApproved: false");
  return src;
}

function portalInfo() {
  return [
    "Snake & Ladder - HTML5 game build",
    "",
    "Open index.html in a browser (serve it over http:// so the sibling .js files load).",
    "The game is fully client side - no server, no build step, no dependencies.",
    "",
    "Title: " + LISTING.title,
    "Category: " + LISTING.category,
    "Tags: " + LISTING.tags.join(", "),
    "Live URL: " + LISTING.url,
    "",
    LISTING.shortDescription,
    "",
    "Embed snippet (for sites that allow iframes):",
    LISTING.embedSnippet
  ].join("\n");
}

/* ---------- minimal, dependency-free zip writer ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time, day };
}

function zip(files) {
  const now = new Date();
  const { time, day } = dosTime(now);
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const raw = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuf, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(day, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt16LE(0, 30);
    dir.writeUInt16LE(0, 32);
    dir.writeUInt16LE(0, 34);
    dir.writeUInt16LE(0, 36);
    dir.writeUInt32LE(0, 38);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, end]);
}

/* ---------- main ---------- */

function buildListingText() {
  const lines = [
    "Snake & Ladder - portal listing metadata",
    "=========================================",
    "",
    "TITLE",
    LISTING.title,
    "",
    "SHORT DESCRIPTION (use for portals with a ~160 char field)",
    LISTING.shortDescription,
    "",
    "LONG DESCRIPTION",
    LISTING.longDescription,
    "",
    "CATEGORY",
    LISTING.category,
    "",
    "TAGS / KEYWORDS",
    LISTING.tags.join(", "),
    "",
    "LIVE URL",
    LISTING.url,
    "",
    "EMBED SNIPPET (partner sites and portals that allow iframes)",
    LISTING.embedSnippet,
    "",
    "UPLOAD FILES",
    "  dist/snake-and-ladder-portal.zip  - the game build (unzip and upload the files inside)",
    "  dist/cover.png                   - 630x315 cover / feature image",
    "  dist/thumb.png                   - 512x512 square thumbnail",
    ""
  ];
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(DIST, { recursive: true });

  const listing = buildListingText();
  fs.writeFileSync(path.join(DIST, "listing.txt"), listing);

  if (process.argv.includes("--list")) {
    console.log(listing);
    return;
  }

  const files = [
    { name: "index.html", data: portalIndex() },
    { name: "rules.js", data: read("rules.js") },
    { name: "loader.js", data: read("loader.js") },
    { name: "fx.js", data: read("fx.js") },
    { name: "game.js", data: read("game.js") },
    { name: "rewards.js", data: read("rewards.js") },
    { name: "quiz.js", data: read("quiz.js") },
    { name: "site-ui.css", data: read("site-ui.css") },
    { name: "site-ui.js", data: read("site-ui.js") },
    { name: "snake-ladder.css", data: read("snake-ladder.css") },
    { name: "ads.js", data: portalAds() },
    { name: "favicon.svg", data: read("favicon.svg") },
    { name: "cover.png", data: fs.readFileSync(path.join(DIST, "cover.png")) },
    { name: "thumb.png", data: fs.readFileSync(path.join(DIST, "thumb.png")) },
    { name: "portal-info.txt", data: portalInfo() }
  ];

  const zipPath = path.join(DIST, ZIP_NAME);
  fs.writeFileSync(zipPath, zip(files));

  const kb = (fs.statSync(zipPath).size / 1024).toFixed(1);
  console.log("Built " + path.relative(ROOT, zipPath) + " (" + kb + " KB, " + files.length + " files)");
  console.log("Listing metadata: dist/listing.txt");
  console.log("Next: python tools/make-thumbnails.py   (regenerate cover.png / thumb.png)");
}

main();
