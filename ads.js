/* Ad + cross-promotion manager for the Snake & Ladder game.
 *
 * Two jobs:
 *  1. Render ad slots. If a Google AdSense publisher id is configured
 *     (CONFIG.adsenseClient below) the real AdSense unit is loaded, otherwise a
 *     tasteful house-ad placeholder is shown so the layout never breaks.
 *  2. Drive traffic from other websites: share buttons, a "More games" promo
 *     strip and a referral-link builder that other sites can use to send
 *     players here (utm-tagged so referrals are measurable).
 */
(function () {
  "use strict";

  /* ---------- configuration ---------- */
  var CONFIG = {
    // Put your real Google AdSense publisher id here (ca-pub-XXXXXXXXXXXXXXXX)
    // to switch the placeholders over to live AdSense units.
    adsenseClient: "",
    adsenseSlots: {
      top: "0000000000",
      side: "0000000000",
      foot: "0000000000"
    },
    // Sites that list browser games — used by the "Play us there" strip.
    portals: [
      { name: "CrazyGames", url: "https://www.crazygames.com/", emoji: "🎮" },
      { name: "Poki", url: "https://poki.com/", emoji: "🕹️" },
      { name: "itch.io", url: "https://itch.io/games", emoji: "🧩" },
      { name: "Coolmath Games", url: "https://www.coolmathgames.com/", emoji: "➗" },
      { name: "Addicting Games", url: "https://www.addictinggames.com/", emoji: "🔥" }
    ]
  };

  var SHARE_TEXT = "Snake & Ladder — classic board game, play it in your browser! 🐍🎲";
  // Always share/point at the game itself, whatever page the visitor is on.
  var GAME_PATH = "index.html";
  var SHARE_URL = (location.protocol === "file:")
    ? "https://theprabhanshu-dev.github.io/snake-and-ladder-game/"
    : new URL(GAME_PATH, location.href.split("#")[0]).toString();

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

  function renderAd(container, slot, label) {
    if (!container) return;
    container.innerHTML = "";

    if (CONFIG.adsenseClient) {
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
      return;
    }

    // House ad / promo placeholder — drives players to the referral link
    // and to the other game portals.
    var box = el("div", "house-ad");
    box.appendChild(el("div", "house-ad-tag", label || "Sponsored"));
    box.appendChild(el("div", "house-ad-title", "Enjoying Snake &amp; Ladder?"));
    box.appendChild(el("div", "house-ad-text",
      "Invite a friend with your personal link — every friend who plays is tracked, " +
      "and more games are coming soon."));
    var row = el("div", "house-ad-actions");
    var copy = el("button", "ad-btn primary", "Copy my invite link");
    copy.addEventListener("click", function () {
      copyReferral(copy);
    });
    var more = el("a", "ad-btn ghost", "See more games");
    more.href = "#more-games";
    row.appendChild(copy);
    row.appendChild(more);
    box.appendChild(row);
    container.appendChild(box);
  }

  function copyReferral(btn) {
    var link = referralLink();
    var done = function () {
      var old = btn.textContent;
      btn.textContent = "Link copied! ✅";
      btn.classList.add("copied");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("copied"); }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, function () { fallbackCopy(link, done); });
    } else {
      fallbackCopy(link, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- referral / UTM links ---------- */
  function referralLink() {
    var ref = "web";
    try {
      var r = new URLSearchParams(location.search).get("ref");
      if (r) ref = r.slice(0, 24);
    } catch (e) {}
    var url = new URL(SHARE_URL);
    url.searchParams.set("ref", ref);
    url.searchParams.set("utm_source", "referral");
    url.searchParams.set("utm_medium", "game_link");
    return url.toString();
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

  /* ---------- "more games" strip ---------- */
  function buildPortals(container) {
    if (!container) return;
    container.innerHTML = "";
    CONFIG.portals.forEach(function (p) {
      var a = el("a", "portal-card");
      a.href = p.url;
      a.target = "_blank";
      a.rel = "noopener sponsored";
      a.innerHTML = '<span class="portal-emoji">' + p.emoji + "</span>" +
        '<span class="portal-name">' + p.name + "</span>" +
        '<span class="portal-cta">Find us there →</span>';
      container.appendChild(a);
    });
  }

  /* ---------- outbound referral links for other websites ----------
   * Any partner site can link players here and get credit via ?ref=<code>.
   * Expose the builder so a partner can generate a link for their page.
   */
  window.GamePromo = {
    referralLink: referralLink,
    shareUrl: SHARE_URL,
    /** Build a tracked link for a partner site. */
    partnerLink: function (partner) {
      var url = new URL(SHARE_URL);
      url.searchParams.set("ref", partner);
      url.searchParams.set("utm_source", partner);
      url.searchParams.set("utm_medium", "partner");
      return url.toString();
    }
  };

  /* ---------- boot ---------- */
  function init() {
    loadAdSense();

    // Any element with data-ad="<slotName>" is treated as an ad slot, so extra
    // pages (like play.html) can declare their own slots without changes here.
    var declared = document.querySelectorAll("[data-ad]");
    for (var i = 0; i < declared.length; i++) {
      var node = declared[i];
      var name = node.getAttribute("data-ad");
      var label = node.getAttribute("data-ad-label") || "Sponsored";
      if (node.id !== "adTop" && node.id !== "adSide" && node.id !== "adFoot") {
        renderAd(node, name, label);
      }
    }

    renderAd(document.getElementById("adTop"), "top", "Sponsored");
    renderAd(document.getElementById("adSide"), "side", "Sponsored");
    renderAd(document.getElementById("adFoot"), "foot", "Sponsored");

    buildShare(document.getElementById("shareRow"));
    buildPortals(document.getElementById("portalRow"));

    // Track the referral that brought the player in.
    var ref = new URLSearchParams(location.search).get("ref");
    if (ref) {
      try { localStorage.setItem("snl_ref", ref); } catch (e) {}
      var note = document.getElementById("refNote");
      if (note) {
        note.textContent = "Welcome! You were invited by “" + ref + "” — enjoy the game! 🎉";
        note.style.display = "block";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
