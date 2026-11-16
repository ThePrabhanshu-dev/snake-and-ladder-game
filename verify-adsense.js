#!/usr/bin/env node


const fs = require("fs");
const path = require("path");

const DEFAULT_SITE = "https://snake-and-ladder-2q0.pages.dev";
const site = (process.argv[2] || DEFAULT_SITE).replace(/\/$/, "");

function localClientId() {
  const src = fs.readFileSync(path.join(__dirname, "ads.js"), "utf8");
  const m = src.match(/adsenseClient:\s*"([^"]*)"/);
  return m ? m[1].trim() : "";
}

async function get(url) {
  const res = await fetch(url, { redirect: "follow" });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  const local = localClientId();
  console.log(`Site:   ${site}`);
  console.log(`Local:  ads.js publisher id = ${local || "(not set)"}`);
  console.log("");

  const [adsJs, adsTxt, index] = await Promise.all([
    get(`${site}/ads.js`),
    get(`${site}/ads.txt`),
    get(`${site}/index.html`)
  ]);

  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, pass, detail });

  ok("ads.js reachable", adsJs.status === 200, `HTTP ${adsJs.status}`);
  ok("ads.txt reachable", adsTxt.status === 200, `HTTP ${adsTxt.status}`);
  ok("index.html reachable", index.status === 200, `HTTP ${index.status}`);

  if (local) {
    ok("publisher id deployed in ads.js", adsJs.body.includes(local), local);

    const adsTxtId = local.replace(/^ca-/, "");
    ok(
      "ads.txt lists the publisher id",
      adsTxt.body.includes(adsTxtId),
      `expected ${adsTxtId}`
    );
    ok(
      "site-verification meta tag present",
      index.body.includes(`google-adsense-account`) && index.body.includes(local),
      'meta name="google-adsense-account"'
    );
  } else {
    ok("publisher id configured locally", false, "set it with: node set-adsense.js --client ca-pub-…");
  }

  ok("page loads ads.js", index.body.includes("ads.js"), "script tag present");
  ok(
    "compliance pages linked",
    index.body.includes("privacy.html") &&
      index.body.includes("about.html") &&
      index.body.includes("contact.html"),
    "privacy / about / contact"
  );

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
