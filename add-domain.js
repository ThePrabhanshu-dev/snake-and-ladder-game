#!/usr/bin/env node


const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT = "snake-and-ladder";
const ACCOUNT_ID = "656e4126558b864ab542971ac273d27c";
const API = "https://api.cloudflare.com/client/v4";

function wranglerToken() {
  const candidates = [
    path.join(os.homedir(), "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml"),
    path.join(os.homedir(), ".config", ".wrangler", "config", "default.toml"),
    path.join(os.homedir(), ".wrangler", "config", "default.toml")
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const m = fs.readFileSync(file, "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  throw new Error("No Wrangler OAuth token found. Run `npx wrangler login` first.");
}

async function main() {
  const args = process.argv.slice(2);
  const remove = args.includes("--remove");
  const domain = (args.find((a) => !a.startsWith("--")) || "").trim().toLowerCase();
  if (!domain) {
    console.error(`Usage: node add-domain.js ${remove ? "--remove " : ""}yourdomain.com`);
    process.exit(1);
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    console.error(`"${domain}" does not look like a domain name.`);
    process.exit(1);
  }

  const token = wranglerToken();
  const url = `${API}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains${
    remove ? "/" + domain : ""
  }`;
  const res = await fetch(url, {
    method: remove ? "DELETE" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: remove ? undefined : JSON.stringify({ name: domain })
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok || !body.success) {
    const errors = (body.errors || []).map((e) => `${e.code}: ${e.message}`).join("; ");
    console.error(`Failed to ${remove ? "remove" : "add"} ${domain}: ${errors || res.status}`);
    process.exit(1);
  }

  if (remove) {
    console.log(`Removed domain: ${domain}`);
    return;
  }

  const d = body.result || {};
  console.log(`Added domain: ${d.name}`);
  console.log(`Status: ${d.status}`);
  console.log(
    "Next: make sure the domain's nameservers point at Cloudflare " +
      "(Cloudflare > Registrar > your domain > Nameservers), then SSL is issued automatically."
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
