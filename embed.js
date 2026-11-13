/* Drop-in embeddable widget for partner websites.
 *
 * Usage — add this to any page on another site:
 *
 *   <div class="snl-game-embed" data-ref="partnerName"></div>
 *   <script src="https://theprabhanshu-dev.github.io/snake-and-ladder-game/embed.js" async></script>
 *
 * It renders a styled "Play Snake & Ladder" card that links to the live game
 * and tags the click with ?ref=<partner> so referrals can be measured.
 */
(function () {
  "use strict";

  var GAME_URL = "https://theprabhanshu-dev.github.io/snake-and-ladder-game/";

  var CSS = `
.snl-widget{display:flex;align-items:center;gap:14px;max-width:520px;margin:18px 0;
  padding:14px 18px;border-radius:16px;text-decoration:none;overflow:hidden;
  background:linear-gradient(135deg,#1e2639,#151b28);border:1px solid #2f3852;
  box-shadow:0 10px 30px rgba(0,0,0,.35);
  font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
  transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
.snl-widget:hover{transform:translateY(-3px);border-color:#5b8cff;
  box-shadow:0 14px 38px rgba(91,140,255,.28)}
.snl-widget-art{width:56px;height:56px;flex:none;border-radius:14px;
  display:flex;align-items:center;justify-content:center;font-size:30px;
  background:linear-gradient(140deg,#2a3348,#1a2131);border:1px solid #3a465f}
.snl-widget-body{flex:1;min-width:0}
.snl-widget-title{color:#eef2ff;font-weight:700;font-size:15.5px;line-height:1.25}
.snl-widget-sub{color:#8b93a7;font-size:12.5px;margin-top:3px;line-height:1.4}
.snl-widget-cta{color:#5b8cff;font-size:12.5px;font-weight:700;margin-top:6px;
  display:inline-flex;align-items:center;gap:5px}
.snl-widget:hover .snl-widget-cta{color:#8fb0ff}
.snl-widget-badge{position:absolute;opacity:0}
.snl-widget-mini{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:99px;
  background:linear-gradient(180deg,#6b96ff,#4472e6);color:#fff;font-weight:700;font-size:13px;
  text-decoration:none;font-family:"Segoe UI",system-ui,sans-serif;
  box-shadow:0 6px 16px rgba(68,114,230,.35)}
.snl-widget-mini:hover{filter:brightness(1.08)}
`;

  function injectCss() {
    if (document.getElementById("snl-widget-css")) return;
    var s = document.createElement("style");
    s.id = "snl-widget-css";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function buildLink(ref) {
    var url = new URL(GAME_URL);
    if (ref) url.searchParams.set("ref", ref);
    url.searchParams.set("utm_source", ref || "embed");
    url.searchParams.set("utm_medium", "embed");
    return url.toString();
  }

  function widget(node) {
    var ref = node.getAttribute("data-ref") || "embed";
    var variant = node.getAttribute("data-variant") || "card";
    var href = buildLink(ref);

    if (variant === "button") {
      var a = document.createElement("a");
      a.className = "snl-widget-mini";
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener sponsored";
      a.textContent = "🎲 Play Snake & Ladder";
      node.innerHTML = "";
      node.appendChild(a);
      return;
    }

    var link = document.createElement("a");
    link.className = "snl-widget";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener sponsored";
    link.innerHTML =
      '<span class="snl-widget-art">🐍</span>' +
      '<span class="snl-widget-body">' +
        '<span class="snl-widget-title">Snake &amp; Ladder</span>' +
        '<span class="snl-widget-sub">Classic board game · 2–4 players · play instantly in your browser</span>' +
        '<span class="snl-widget-cta">Play now free →</span>' +
      "</span>";
    node.innerHTML = "";
    node.appendChild(link);
  }

  function scan() {
    injectCss();
    var nodes = document.querySelectorAll(".snl-game-embed");
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].dataset.snlDone) {
        nodes[i].dataset.snlDone = "1";
        widget(nodes[i]);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
  // Re-scan for dynamically injected embeds.
  if (window.MutationObserver) {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }
  window.SnakeLadderEmbed = { scan: scan, link: buildLink };
})();
