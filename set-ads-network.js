#!/usr/bin/env node
/**
 * Turn the fallback ad network on or off and check the money setup.
 *
 *   node set-ads-network.js --enable  --provider adsterra
 *   node set-ads-network.js --disable
 *   node set-ads-network.js --slot top --script "<script ...></script>"
 *   node set-ads-network.js --status
 *
 * The snippets live in ads-network.json (no JavaScript edits needed). Adsterra,
 * HilltopAds, Exoclick and PropellerAds all accept sites hosted on a
 * subdomain such as *.pages.dev, so you can earn from the site while the
 * AdSense review for your custom domain is still running.
 *
 * Remember: never run two ad networks on the same page. As soon as AdSense
 * approves the domain, run --disable here and set adsenseApproved to true in
 * ads.js.
 */

const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "ads-network.json");
const ADS_FILE = path.join(__dirname, "ads.js");

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error("ads-network.json is missing - recreate it or run --init.");
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch (err) {
    console.error("ads-network.json is not valid JSON: " + err.message);
    process.exit(1);
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

function parseArgs(argv) {
  const out = {
    enable: false,
    disable: false,
    status: false,
    init: false,
    provider: "",
    slot: "",
    script: "",
    adsenseApproved: null
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--enable") out.enable = true;
    else if (a === "--disable") out.disable = true;
    else if (a === "--status") out.status = true;
    else if (a === "--init") out.init = true;
    else if (a === "--provider") out.provider = (argv[++i] || "").trim();
    else if (a === "--slot") out.slot = (argv[++i] || "").trim();
    else if (a === "--script") out.script = argv[++i] || "";
    else if (a === "--adsense-approved") out.adsenseApproved = true;
    else if (a === "--adsense-pending") out.adsenseApproved = false;
  }
  return out;
}

function setAdsenseApproved(flag) {
  let src = fs.readFileSync(ADS_FILE, "utf8");
  const re = /(adsenseApproved:\s*)(true|false)/;
  if (!re.test(src)) {
    console.warn("Could not find adsenseApproved in ads.js - edit it manually.");
    return;
  }
  src = src.replace(re, `$1${flag}`);
  fs.writeFileSync(ADS_FILE, src);
  console.log(`adsenseApproved = ${flag} in ads.js`);
}

function status() {
  const cfg = readConfig();
  const adsSrc = fs.readFileSync(ADS_FILE, "utf8");
  const clientMatch = adsSrc.match(/adsenseClient:\s*"([^"]*)"/);
  const approvedMatch = adsSrc.match(/adsenseApproved:\s*(true|false)/);
  const client = clientMatch ? clientMatch[1] : "";
  const approved = approvedMatch ? approvedMatch[1] === "true" : false;

  console.log("Money setup");
  console.log("------------");
  console.log(`AdSense client     : ${client || "(not set)"}`);
  console.log(`AdSense approved   : ${approved ? "yes" : "no (site still under review)"}`);
  console.log(`Fallback network   : ${cfg.enabled ? "ON (" + (cfg.provider || "unnamed") + ")" : "off"}`);
  console.log(`Fallback head slot : ${cfg.head ? "set" : "empty"}`);
  console.log(`Fallback body slot : ${cfg.body ? "set" : "empty"}`);
  for (const name of ["top", "side", "foot"]) {
    const v = cfg.slots && cfg.slots[name];
    console.log(`Fallback ${name.padEnd(9)}   : ${v ? "set" : "empty"}`);
  }
  console.log("");

  if (approved && cfg.enabled) {
    console.log("WARNING: both networks are enabled. Only one ad network may run per page.");
  } else if (!approved && !cfg.enabled) {
    console.log("No ad network is running yet - no ad will be served on the site.");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.init) {
    const cfg = readConfig();
    cfg.enabled = false;
    cfg.head = "";
    cfg.body = "";
    cfg.slots = { top: "", side: "", foot: "" };
    writeConfig(cfg);
    console.log("ads-network.json reset (disabled, empty snippets).");
    return;
  }

  if (args.status) {
    status();
    return;
  }

  const cfg = readConfig();

  if (args.provider) cfg.provider = args.provider;
  if (args.slot) {
    if (!["top", "side", "foot"].includes(args.slot)) {
      console.error("--slot must be one of: top, side, foot");
      process.exit(1);
    }
    if (!cfg.slots) cfg.slots = {};
    cfg.slots[args.slot] = args.script;
    console.log(`slot "${args.slot}" snippet saved (${args.script.length} chars)`);
  }
  if (args.enable) cfg.enabled = true;
  if (args.disable) cfg.enabled = false;

  writeConfig(cfg);
  console.log(`Fallback network ${cfg.enabled ? "ENABLED" : "disabled"} (${cfg.provider || "no provider set"})`);
  console.log("Next: node deploy.js");

  if (args.adsenseApproved !== null) {
    setAdsenseApproved(args.adsenseApproved);
  }
}

main();
