#!/usr/bin/env node


const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PAGES_DEV_ORIGIN = "https://snake-and-ladder-2q0.pages.dev";
const GITHUB_PAGES_ORIGIN = "https://theprabhanshu-dev.github.io/snake-and-ladder-game";

const SCAN_EXTENSIONS = new Set([
  ".html", ".js", ".json", ".md", ".py", ".txt", ".webmanifest", ".xml"
]);
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".wrangler", ".cache"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function currentOrigin() {
  try {
    const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
    const m = xml.match(/<loc>(https:\/\/[^/]+)\//);
    if (m) return m[1].replace(/\/$/, "");
  } catch (e) {

  }
  return PAGES_DEV_ORIGIN;
}

function updateReadme(src, canonical) {
  const mirrorBlock = new RegExp(
    "Mirror:\\s*" + GITHUB_PAGES_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "[^\\n]*(?:\\n[^\\n]*)?"
  );
  const wording = canonical === PAGES_DEV_ORIGIN
    ? "Mirror: " + GITHUB_PAGES_ORIGIN + "/ (GitHub Pages — the canonical\nURL on every page points at the Cloudflare Pages domain)."
    : "Mirror: " + GITHUB_PAGES_ORIGIN + "/ (GitHub Pages — the canonical\nURL on every page points at the custom domain above).";
  return src.replace(mirrorBlock, wording);
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const withRedirect = argv.includes("--with-redirect");
  const reset = argv.includes("--reset");

  const arg = argv.find((a) => !a.startsWith("--"));
  let target;

  if (reset) {
    target = PAGES_DEV_ORIGIN;
  } else {
    if (!arg) {
      console.error(
        "Usage: node set-domain.js yourdomain.com [--with-redirect] [--dry-run]\n" +
        "       node set-domain.js --reset [--dry-run]"
      );
      process.exit(1);
    }
    const host = arg.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      console.error(`"${arg}" does not look like a domain name.`);
      process.exit(1);
    }
    target = "https://" + host;
  }

  const from = currentOrigin();
  if (from === target) {
    console.log(`Site already points at ${target} — nothing to do.`);
    return;
  }

  const files = walk(ROOT);
  const changed = [];

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    let next = original.split(from).join(target);

    if (path.basename(file) === "README.md") {
      next = updateReadme(next, target);
    }

    if (next !== original) {
      changed.push(path.relative(ROOT, file));
      if (!dryRun) fs.writeFileSync(file, next, "utf8");
    }
  }

  const redirectFile = path.join(ROOT, "_redirects");
  if (withRedirect && target !== PAGES_DEV_ORIGIN) {
    const body =
      "# Redirect the old *.pages.dev host to the canonical domain (301).\n" +
      "# Cloudflare Pages reads this file from the deployed site root.\n" +
      PAGES_DEV_ORIGIN + "/* " + target + "/:splat 301\n";
    if (!dryRun) fs.writeFileSync(redirectFile, body, "utf8");
    changed.push("_redirects");
  }

  console.log(`Canonical origin: ${from}  ->  ${target}`);
  console.log(`${dryRun ? "Would update" : "Updated"} ${changed.length} file(s):`);
  for (const f of changed) console.log("  " + f);

  if (dryRun) {
    console.log("\n(dry run — no files written)");
    return;
  }

  console.log("\nNext steps:");
  if (target === PAGES_DEV_ORIGIN) {
    console.log("  node deploy.js");
  } else {
    console.log("  1. Point the domain's nameservers at Cloudflare (Cloudflare > Registrar > your domain).");
    console.log("  2. Attach it to the Pages project:  node add-domain.js " + target.replace("https://", ""));
    console.log("  3. Deploy:                         node deploy.js");
    console.log("  4. Confirm it serves the site, then lock the old host:");
    console.log("       node set-domain.js " + target.replace("https://", "") + " --with-redirect");
    console.log("  5. In AdSense > Sites, add " + target + " as a new site and request review.");
  }
}

main();
