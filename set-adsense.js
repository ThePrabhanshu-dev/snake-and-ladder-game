#!/usr/bin/env node
/**
 * Wire a Google AdSense publisher id + ad-slot ids into ads.js.
 *
 *   node set-adsense.js --client ca-pub-1234567890123456
 *   node set-adsense.js --client ca-pub-1234567890123456 --slots top=111,side=222,foot=333
 *
 * Then run `node deploy.js` to publish the change (ads.txt is regenerated
 * automatically from the same publisher id).
 *
 * Use --dry-run to preview the changes without writing them.
 */

const fs = require("fs");
const path = require("path");

const ADS_FILE = path.join(__dirname, "ads.js");

function parseArgs(argv) {
  const out = { client: "", slots: {}, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--client") out.client = (argv[++i] || "").trim();
    else if (a === "--slots") {
      for (const pair of (argv[++i] || "").split(",")) {
        const [k, v] = pair.split("=");
        if (k && v) out.slots[k.trim()] = v.trim();
      }
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.client) {
    console.error("Usage: node set-adsense.js --client ca-pub-XXXXXXXXXXXXXXXX [--slots top=1,side=2,foot=3]");
    process.exit(1);
  }
  if (!/^ca-pub-\d{16}$/.test(args.client)) {
    console.error(`"${args.client}" is not a valid AdSense publisher id (expected ca-pub- + 16 digits).`);
    process.exit(1);
  }

  let src = fs.readFileSync(ADS_FILE, "utf8");

  // Publisher id
  const clientRe = /(adsenseClient:\s*")[^"]*(")/;
  if (!clientRe.test(src)) {
    console.error("Could not find adsenseClient in ads.js — update the CONFIG block manually.");
    process.exit(1);
  }
  src = src.replace(clientRe, `$1${args.client}$2`);

  // Ad-slot ids
  const slotNames = ["top", "side", "foot"];
  for (const name of slotNames) {
    const value = args.slots[name];
    if (!value) continue;
    const re = new RegExp(`(${name}:\\s*")[^"]*(")`);
    if (!re.test(src)) {
      console.warn(`Could not find slot "${name}" in ads.js — add it manually.`);
      continue;
    }
    src = src.replace(re, `$1${value}$2`);
  }

  if (args.dryRun) {
    console.log("--- dry run, nothing written ---");
    console.log(src.match(/var CONFIG = \{[\s\S]*?\};/)[0]);
    return;
  }

  fs.writeFileSync(ADS_FILE, src);
  console.log(`Publisher id set to ${args.client} in ads.js`);
  for (const name of slotNames) {
    if (args.slots[name]) console.log(`  slot ${name} -> ${args.slots[name]}`);
  }
  console.log("Next: node deploy.js");
}

main();
