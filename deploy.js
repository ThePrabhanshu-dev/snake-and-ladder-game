#!/usr/bin/env node
/**
 * One-command free deploy to Cloudflare Pages.
 *
 *   node deploy.js
 *
 * Requires a Cloudflare account and a one-time `npx wrangler login`.
 * Staging files in the system temp dir so that .git / tests are never uploaded.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT = "snake-and-ladder";
const BRANCH = process.env.DEPLOY_BRANCH || "main";
const SITE_FILES = [
  "index.html",
  "play.html",
  "how-to-play.html",
  "strategy.html",
  "daily-challenge.html",
  "ludo.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "404.html",
  "rules.js",
  "ludo-rules.js",
  "ludo.js",
  "loader.js",
  "fx.js",
  "ads.js",
  "game.js",
  "rewards.js",
  "quiz.js",
  "site-ui.css",
  "site-ui.js",
  "snake-ladder.css",
  "ads-network.json",
  "embed.js",
  "favicon.svg",
  "og-image.svg",
  "og-image.png",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "ads.txt",
  "README.md"
];

const root = __dirname;
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "snl-deploy-"));

for (const file of SITE_FILES) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn(`skip (missing): ${file}`);
    continue;
  }
  fs.copyFileSync(src, path.join(stage, file));
}

/* ---------- ads.txt ---------- *
 * The AdSense publisher id lives in ads.js (CONFIG.adsenseClient). Mirror it
 * into ads.txt so the file always matches the id the site actually serves.
 */
function adsenseClientId() {
  const adsSrc = fs.readFileSync(path.join(root, "ads.js"), "utf8");
  const m = adsSrc.match(/adsenseClient:\s*"([^"]*)"/);
  const client = m ? m[1].trim() : "";
  return /^ca-pub-\d{16}$/.test(client) ? client : "";
}

const client = adsenseClientId();
const adsTxtPath = path.join(stage, "ads.txt");
if (client) {
  const pubId = client.replace(/^ca-/, "");
  fs.writeFileSync(
    adsTxtPath,
    `# ads.txt for ${client}\n` +
      `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`
  );
  console.log(`ads.txt generated for ${client}`);
} else {
  console.log(
    "ads.txt: no valid AdSense publisher id in ads.js yet (set CONFIG.adsenseClient)"
  );
}

console.log(`Staged ${fs.readdirSync(stage).length} files in ${stage}`);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const args = [
  "--yes",
  "wrangler@latest",
  "pages",
  "deploy",
  stage,
  "--project-name=" + PROJECT,
  "--branch=" + BRANCH
];

try {
  if (process.platform === "win32") {
    // .cmd shims cannot be spawned directly on modern Node without a shell.
    execFileSync("cmd.exe", ["/d", "/s", "/c", "npx " + args.join(" ")], {
      stdio: "inherit",
      cwd: root
    });
  } else {
    execFileSync(npx, args, { stdio: "inherit", cwd: root });
  }
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
