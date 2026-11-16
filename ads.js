/* Ad manager for the Snake & Ladder game.
 *
 * Two jobs:
 *  1. Render the ad slots. If a Google AdSense publisher id is configured
 *     (CONFIG.adsenseClient below) the real AdSense unit is loaded, otherwise
 *     a fallback ad network can be used. Until one of them is live the slot
 *     stays empty - the layout does not break.
 *  2. Build the "share the game" buttons.
 */
(function () {
  "use strict";

  /* ---------- configuration ---------- */
  var CONFIG = {
    // Put your real Google AdSense publisher id here (ca-pub-XXXXXXXXXXXXXXXX)
    // to switch the placeholders over to live AdSense units.
    adsenseClient: "ca-pub-8439899281485854",
    adsenseSlots: {
      top: "4959474672",
      side: "7394066327",
      foot: "9828657971"
    },
    // Set to true once AdSense approves the site. Until then the slots are
    // filled by the fallback ad network (see fallbackNetwork below), because
    // AdSense units do not fill on an unapproved site.
    adsenseApproved: false,
    // Fallback ad network - earn money on the *.pages.dev domain while AdSense
    // review is pending. Paste the snippets from your network's dashboard
    // (Adsterra, HilltopAds, Exoclick, PropellerAds all accept subdomain
    // sites). Managed with: node set-ads-network.js
    fallbackNetwork: {
      enabled: false,
      provider: "",
      // Global snippet injected at the end of <head> (e.g. a popunder loader).
      head: "",
      // Global snippet injected at the end of <body> (e.g. a social bar).
      body: "",
      // Snippet per on-page ad slot.
      slots: { top: "", side: "", foot: "" }
    }
  };

  var SHARE_TEXT = "Snake & Ladder — classic board game, play it in your browser! 🐍🎲";
  // Always share/point at the game itself, whatever page the visitor is on.
  var SHARE_URL = (location.protocol === "file:")
    ? "https://snake-and-ladder-2q0.pages.dev/"
    : new URL("index.html", location.href.split("#")[0]).toString();

  /* ---------- helpers ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  /* ---------- AdSense ---------- */
  function addPreconnect() {
    [
      "https://pagead2.googlesyndication.com",
      "https://googleads.g.doubleclick.net",
      "https://tpc.googlesyndication.com"
    ].forEach(function (origin) {
      if (document.querySelector('link[href="' + origin + '"]')) return;
      var l = document.createElement("link");
      l.rel = "preconnect";
      l.href = origin;
      (document.head || document.documentElement).appendChild(l);
    });
  }

  function loadAdSense() {
    if (!CONFIG.adsenseClient) return false;
    addPreconnect();
    // The pages already include Google's AdSense script in <head> (site
    // verification requirement) — don't load it twice.
    if (document.getElementById("adsense-script")) return true;
    var s = document.createElement("script");
    s.id = "adsense-script";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(CONFIG.adsenseClient);
    (document.head || document.documentElement).appendChild(s);
    return true;
  }

  function validSlotId(slot) {
    var id = (CONFIG.adsenseSlots[slot] || "").trim();
    // Placeholder / empty ids would produce invalid ad tags ("slot id missing"),
    // which AdSense counts against site quality. Skip them instead.
    if (!id || /^0+$/.test(id) || /^1+$/.test(id)) return "";
    if (!/^\d{6,}$/.test(id)) return "";
    return id;
  }

  /* ---------- fallback ad network ---------- */
  // Snippets pasted from an ad network dashboard (Adsterra, HilltopAds,
  // Exoclick, PropellerAds...). They are injected as real <script> elements
  // so the network's loader actually executes.
  function parseSnippet(html) {
    // A <template> keeps the snippet as a fragment. DOMParser is not used on
    // purpose: it parses a full document and moves a leading <script> into
    // <head>, which would silently drop the snippet.
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    return Array.prototype.slice.call(tpl.content.childNodes);
  }

  function appendSnippet(target, html) {
    if (!target || !html) return;
    var nodes = parseSnippet(html);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.nodeType === 1 && node.tagName === "SCRIPT") {
        // Imported scripts do not run - recreate them so the code executes.
        var s = document.createElement("script");
        for (var j = 0; j < node.attributes.length; j++) {
          s.setAttribute(node.attributes[j].name, node.attributes[j].value);
        }
        s.text = node.textContent || "";
        target.appendChild(s);
      } else {
        target.appendChild(document.importNode(node, true));
      }
    }
  }

  function injectGlobal(snippet, where) {
    if (!snippet) return;
    appendSnippet(where === "head" ? document.head : document.body, snippet);
  }

  function fallbackEnabled() {
    var fn = CONFIG.fallbackNetwork || {};
    if (!fn.enabled) return false;
    // Once AdSense is approved, AdSense takes priority - do not run two
    // ad networks on the same page (Google rejects that as invalid traffic).
    if (CONFIG.adsenseApproved && CONFIG.adsenseClient) return false;
    return true;
  }

  /* ---------- config loading ---------- */
  // The fallback network snippets live in ads-network.json so they can be
  // pasted (and edited) without touching any JavaScript. If the file cannot
  // be read - or the page is opened from disk - the built-in defaults apply.
  function loadNetworkConfig(done) {
    if (location.protocol === "file:") return done();
    fetch("ads-network.json", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cfg) {
        if (cfg) applyNetworkConfig(cfg);
      })
      .catch(function () {})
      .then(function () { done(); });
  }

  function applyNetworkConfig(cfg) {
    var fn = CONFIG.fallbackNetwork;
    if (!fn) return;
    if (typeof cfg.enabled === "boolean") fn.enabled = cfg.enabled;
    if (typeof cfg.provider === "string") fn.provider = cfg.provider;
    if (typeof cfg.head === "string") fn.head = cfg.head;
    if (typeof cfg.body === "string") fn.body = cfg.body;
    if (cfg.slots && typeof cfg.slots === "object") {
      ["top", "side", "foot"].forEach(function (name) {
        if (typeof cfg.slots[name] === "string") fn.slots[name] = cfg.slots[name];
      });
    }
  }

  /* ---------- ad slots ---------- */
  function renderAd(container, slot) {
    if (!container) return;
    container.innerHTML = "";

    // 1. Fallback network (money now, while AdSense review is pending).
    if (fallbackEnabled()) {
      var snippet = (CONFIG.fallbackNetwork.slots || {})[slot] || "";
      if (snippet) {
        appendSnippet(container, snippet);
        return;
      }
    }

    // 2. Google AdSense (once the site is approved).
    if (CONFIG.adsenseApproved && CONFIG.adsenseClient) {
      var slotId = validSlotId(slot);
      // No manual unit for this position: leave the slot empty and let AdSense
      // Auto ads (enabled in the AdSense dashboard) fill the page instead.
      if (!slotId) return;
      var ins = el("ins", "adsbygoogle ad-slot");
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", CONFIG.adsenseClient);
      ins.setAttribute("data-ad-slot", slotId);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      // AdSense policy: ads must be distinguishable from site content.
      ins.setAttribute("aria-label", "Advertisement");
      container.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }

  function renderSlots() {
    // Any element with data-ad="<slotName>" is treated as an ad slot, so extra
    // pages (like play.html) can declare their own slots without changes here.
    var declared = document.querySelectorAll("[data-ad]");
    for (var i = 0; i < declared.length; i++) {
      renderAd(declared[i], declared[i].getAttribute("data-ad"));
    }

    renderAd(document.getElementById("adTop"), "top");
    renderAd(document.getElementById("adSide"), "side");
    renderAd(document.getElementById("adFoot"), "foot");
  }

  /* ---------- share buttons ---------- */
  function buildShare(container) {
    if (!container) return;
    container.innerHTML = "";
    var items = [
      { label: "WhatsApp", emoji: "💬", url: "https://wa.me/?text=" + encodeURIComponent(SHARE_TEXT + " " + SHARE_URL) },
      { label: "Facebook", emoji: "👍", url: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(SHARE_URL) },
      { label: "X", emoji: "𝕏", url: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(SHARE_TEXT) + "&url=" + encodeURIComponent(SHARE_URL) },
      { label: "Reddit", emoji: "🤖", url: "https://www.reddit.com/submit?url=" + encodeURIComponent(SHARE_URL) + "&title=" + encodeURIComponent(SHARE_TEXT) },
      { label: "Telegram", emoji: "✈️", url: "https://t.me/share/url?url=" + encodeURIComponent(SHARE_URL) + "&text=" + encodeURIComponent(SHARE_TEXT) }
    ];
    items.forEach(function (it) {
      var a = el("a", "share-btn");
      a.href = it.url;
      a.target = "_blank";
      a.rel = "noopener sponsored";
      a.innerHTML = '<span class="share-emoji">' + it.emoji + '</span><span>' + it.label + "</span>";
      container.appendChild(a);
    });
  }

  /* ---------- boot ---------- */
  function init() {
    // AdSense units are only requested once the site is approved - on an
    // unapproved site they serve nothing. The static adsbygoogle.js tag stays
    // in the page <head> because Google needs it for site verification.
    if (CONFIG.adsenseApproved && CONFIG.adsenseClient) {
      loadAdSense();
    }

    // The share buttons do not depend on the ad config.
    buildShare(document.getElementById("shareRow"));

    // Ad slots wait for ads-network.json so the fallback snippets are known.
    loadNetworkConfig(function () {
      if (fallbackEnabled()) {
        injectGlobal(CONFIG.fallbackNetwork.head, "head");
        injectGlobal(CONFIG.fallbackNetwork.body, "body");
      }
      renderSlots();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
