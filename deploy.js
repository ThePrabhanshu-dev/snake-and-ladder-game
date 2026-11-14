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
  "rules.js",
  "loader.js",
  "ads.js",
  "embed.js",
  "favicon.svg",
  "og-image.svg",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
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
