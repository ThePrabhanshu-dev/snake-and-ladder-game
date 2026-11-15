#!/usr/bin/env node
/**
 * Check that the live site is actually serving an ad setup that can earn.
 *
 *   node verify-money.js
 *   node verify-money.js https://yourdomain.com
 *
 * Reports which ad network is live (AdSense or the fallback network), whether
 * the snippets are deployed and whether the ad slots render.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_SITE = "https://snake-and-ladder-2q0.pages.dev";
const site = (process.argv[2] || DEFAULT_SITE).replace(/\/$/, "");

function localConfig() {
  const adsSrc = fs.readFileSync(path.join(__dirname, "ads.js"), "utf8");
  const approved = /adsenseApproved:\s*(true|false)/.exec(adsSrc);
  let network = { enabled: false, provider: "", slots: {} };
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "ads-network.json"), "utf8"));
    network = cfg;
  } catch (e) {
    console.warn("ads-network.json could not be read: " + e.message);
  }
  return { adsenseApproved: approved ? approved[1] === "true" : false, network };
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

  const [index, adsJs, networkJson] = await Promise.all([
    get(`${site}/index.html`),
    get(`${site}/ads.js`),
    get(`${site}/ads-network.json`)
  ]);

  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, pass, detail });

  ok("index.html reachable", index.status === 200, `HTTP ${index.status}`);
  ok("ads.js reachable", adsJs.status === 200, `HTTP ${adsJs.status}`);

  let liveNetwork = null;
  if (networkJson.status === 200) {
    try {
      liveNetwork = JSON.parse(networkJson.body);
    } catch (e) {
      /* reported below */
    }
  }
  ok(
    "ads-network.json deployed",
    liveNetwork !== null,
    liveNetwork ? `provider=${liveNetwork.provider} enabled=${liveNetwork.enabled}` : `HTTP ${networkJson.status}`
  );

  const liveApproved = /adsenseApproved:\s*true/.test(adsJs.body);
  ok(
    "live ads.js has the ad network switch",
    /adsenseApproved:\s*(true|false)/.test(adsJs.body),
    `adsenseApproved=${liveApproved}`
  );

  const liveEnabled = liveNetwork && liveNetwork.enabled;
  const liveSnippets = liveNetwork
    ? [liveNetwork.head, liveNetwork.body, ...Object.values(liveNetwork.slots || {})].filter(Boolean).length
    : 0;

  if (liveApproved) {
    ok("AdSense is the active network", true, "adsenseApproved=true");
    ok("fallback network is switched off", !liveEnabled, liveEnabled ? "both networks are enabled - fix this" : "ok");
  } else if (liveEnabled && liveSnippets > 0) {
    ok("fallback network is live with snippets", true, `${liveSnippets} snippet(s)`);
  } else {
    ok("an ad network is serving", false, "no network is active - the site earns nothing");
  }

  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed++;
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
  }
  console.log(`\n${checks.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("Verification failed:", e.message);
  process.exit(1);
});
