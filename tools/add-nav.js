/* One-off helper: injects the shared top navigation bar into every page.
   Run with:  node tools/add-nav.js
   It is idempotent - running it twice does not add the bar twice, and it
   refreshes a bar that is already there so links stay in sync. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const SITE_UI_VERSION = "1.6.0";
const SITE_UI_JS_VERSION = "1.0.0";

const PAGES = [
  { file: "index.html", current: "index.html" },
  { file: "play.html", current: "index.html" },
  { file: "ludo.html", current: "ludo.html" },
  { file: "how-to-play.html", current: "how-to-play.html" },
  { file: "strategy.html", current: "strategy.html" },
  { file: "daily-challenge.html", current: "daily-challenge.html" },
  { file: "about.html", current: "about.html" },
  { file: "contact.html", current: "contact.html" },
  { file: "privacy.html", current: "privacy.html" },
  { file: "404.html", current: null }
];

const LINKS = [
  { href: "index.html", label: "Play" },
  { href: "how-to-play.html", label: "How to play" },
  { href: "strategy.html", label: "Strategy" },
  { href: "daily-challenge.html", label: "Daily challenge" },
  { href: "ludo.html", label: "Ludo" },
  { href: "about.html", label: "About" },
  { href: "contact.html", label: "Contact" },
  { href: "privacy.html", label: "Privacy" }
];

function navHtml(current) {
  const links = LINKS.map((l) => {
    const attr = l.href === current ? ' aria-current="page"' : "";
    return `      <a href="${l.href}"${attr}>${l.label}</a>`;
  }).join("\n");

  return `<nav class="topnav" aria-label="Main">
    <a class="topnav-brand" href="index.html"><span class="topnav-emoji" aria-hidden="true">🐍</span> Snake &amp; Ladder</a>
    <div class="topnav-links">
${links}
    </div>
  </nav>`;
}

for (const page of PAGES) {
  const file = path.join(ROOT, page.file);
  let html = fs.readFileSync(file, "utf8");

  // 1. stylesheet link in <head> - refresh the version so browsers pick
  //    up the latest shared chrome.
  if (/<link rel="stylesheet" href="site-ui\.css[^"]*" \/>/.test(html)) {
    html = html.replace(
      /<link rel="stylesheet" href="site-ui\.css[^"]*" \/>/,
      `<link rel="stylesheet" href="site-ui.css?v=${SITE_UI_VERSION}" />`
    );
  } else {
    html = html.replace(/<\/head>/i, `  <link rel="stylesheet" href="site-ui.css?v=${SITE_UI_VERSION}" />\n</head>`);
  }

  // 2. the shared behaviour script. It is loaded in <head> without defer so
  //    the theme is applied before the page paints.
  if (!/<script src="site-ui\.js/.test(html)) {
    html = html.replace(
      /<\/head>/i,
      `  <script src="site-ui.js?v=${SITE_UI_JS_VERSION}"></script>\n</head>`
    );
  }

  // 3. the nav bar right after <body>. Replace an existing bar so the
  //    links never drift apart between pages.
  const nav = navHtml(page.current);
  if (/<nav class="topnav"[\s\S]*?<\/nav>/.test(html)) {
    html = html.replace(/<nav class="topnav"[\s\S]*?<\/nav>/, nav);
  } else {
    html = html.replace(/<body>\s*\n/i, `<body>\n  ${nav}\n`);
  }

  // 4. exactly one skip link, always as the first thing in the body.
  html = html.replace(/[ \t]*<a class="skip-link"[^>]*>[\s\S]*?<\/a>\r?\n?/g, "");
  html = html.replace(/<body>\s*\n/i, `<body>\n  <a class="skip-link" href="#main">Skip to content</a>\n`);

  // 5. give the page content a skip-link target
  if (!html.includes('id="main"')) {
    html = html.replace(/<div class="wrap">/i, `<div class="wrap" id="main">`);
  }

  fs.writeFileSync(file, html, "utf8");
  console.log("updated", page.file);
}
