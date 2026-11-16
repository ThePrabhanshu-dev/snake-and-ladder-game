#!/usr/bin/env node
/**
 * Check that the live site is actually serving an ad setup that can earn.
 *
 *   node verify-money.js
 *   node verify-money.js https://yourdomain.com
 *
 * Reports whether the deployed site has AdSense switched on, whether the
 * publisher id is present and whether the ad slots are in the page.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_SITE = "https://snake-and-ladder-2q0.pages.dev";
const site = (process.argv[2] || DEFAULT_SITE).replace(/\/$/, "");

function localConfig() {
  const adsSrc = fs.readFileSync(path.join(__dirname, "ads.js"), "utf8");
  const approved = /adsenseApproved:\s*(true|false)/.exec(adsSrc);
  const client = /adsenseClient:\s*"([^"]*)"/.exec(adsSrc);
  return {
    adsenseApproved: approved ? approved[1] === "true" : false,
    adsenseClient: client ? client[1].trim() : ""
  };
}

async function get(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: "", error: err.message };
  }
}

async function main() {
  const local = localConfig();
  console.log(`Site: ${site}\n`);

  const [index, adsJs] = await Promise.all([
    get(`${site}/index.html`),
    get(`${site}/ads.js`)
  ]);

  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, pass, detail });

  ok("index.html reachable", index.status === 200, `HTTP ${index.status}`);
  ok("ads.js reachable", adsJs.status === 200, `HTTP ${adsJs.status}`);

  const liveApproved = /adsenseApproved:\s*true/.test(adsJs.body);
  ok(
    "live ads.js has the ad network switch",
    /adsenseApproved:\s*(true|false)/.test(adsJs.body),
    `adsenseApproved=${liveApproved}`
  );

  const liveClient = /adsenseClient:\s*"([^"]*)"/.exec(adsJs.body);
  const liveClientId = liveClient ? liveClient[1].trim() : "";
  ok(
    "live ads.js has a publisher id",
    /^ca-pub-\d{16}$/.test(liveClientId),
    liveClientId || "(none)"
  );

  const slotCount = (index.body.match(/class="ad-slot"/g) || []).length;
  ok("ad slots are present in the page", slotCount > 0, `${slotCount} slot(s)`);

  if (liveApproved) {
    ok("AdSense is the active network", true, "adsenseApproved=true");
  } else {
    ok("AdSense is the active network", false, "adsenseApproved=false - the site earns nothing");
  }

  if (local.adsenseApproved !== liveApproved) {
    ok("deployed ads.js matches the local one", false, "run: node deploy.js");
  } else {
    ok("deployed ads.js matches the local one", true, "ok");
  }

  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed++;
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " - " + c.detail : ""}`);
  }
  console.log(`\n${checks.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("Verification failed:", e.message);
  process.exit(1);
});
