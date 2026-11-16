/* Ad manager for the Snake & Ladder game.
 *
 * Two jobs:
 *  1. Render the ad slots. Once AdSense approves the site (CONFIG.adsenseApproved)
 *     the real AdSense units are loaded; until then the slot stays empty and the
 *     layout does not break.
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
    // Set to true once AdSense approves the site. AdSense units do not fill on
    // an unapproved site, so the slots stay empty until then.
    adsenseApproved: false
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

  /* ---------- ad slots ---------- */
  function renderAd(container, slot) {
    if (!container) return;
    container.innerHTML = "";

    // Google AdSense (once the site is approved).
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

    renderSlots();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
