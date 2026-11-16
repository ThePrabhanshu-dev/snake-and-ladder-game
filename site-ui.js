/* Shared site chrome behaviour: the light/dark theme switch, the back-to-top
   button and the auto-generated "On this page" table of contents.

   The file is loaded in <head> on every page. The theme is applied straight
   away so the page never flashes the wrong colours, and the parts that need
   the DOM wait for DOMContentLoaded. */
(function () {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const THEME_KEY = "snl-theme-v1";

  /* ---------- theme ---------- */

  function systemTheme() {
    try {
      return root.matchMedia && root.matchMedia("(prefers-color-scheme: light)").matches
        ? "light" : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function storedTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      if (value === "light" || value === "dark") return value;
    } catch (e) { /* storage blocked - fall back to the system setting */ }
    return null;
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    const btn = doc.getElementById("themeToggle");
    if (btn) {
      const next = theme === "light" ? "dark" : "light";
      btn.textContent = theme === "light" ? "🌙" : "☀";
      btn.setAttribute("aria-label", "Switch to the " + next + " theme");
      btn.setAttribute("title", "Switch to the " + next + " theme");
      btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    }
  }

  // Runs before the page body is painted.
  applyTheme(storedTheme() || systemTheme());

  function toggleTheme() {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  }

  /* ---------- helpers ---------- */

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section";
  }

  /* ---------- DOM parts ---------- */

  function buildThemeToggle() {
    if (doc.getElementById("themeToggle")) return;
    const nav = doc.querySelector(".topnav");
    if (!nav) return;
    const btn = doc.createElement("button");
    btn.id = "themeToggle";
    btn.type = "button";
    btn.className = "topnav-theme";
    btn.addEventListener("click", toggleTheme);
    const links = nav.querySelector(".topnav-links");
    if (links) nav.insertBefore(btn, links);
    else nav.appendChild(btn);
    applyTheme(root.getAttribute("data-theme") || "dark");
  }

  function buildBackToTop() {
    if (doc.getElementById("toTop")) return;
    const btn = doc.createElement("button");
    btn.id = "toTop";
    btn.type = "button";
    btn.className = "to-top";
    btn.setAttribute("aria-label", "Back to top of page");
    btn.title = "Back to top";
    btn.textContent = "↑";
    btn.addEventListener("click", function () {
      try { window.scrollTo({ top: 0, behavior: "smooth" }); }
      catch (e) { window.scrollTo(0, 0); }
    });
    doc.body.appendChild(btn);
    let ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        btn.classList.toggle("show", window.scrollY > 420);
        ticking = false;
      });
    }, { passive: true });
  }

  function buildToc() {
    const main = doc.getElementById("main");
    if (!main) return;
    // The game pages put the board first, so a table of contents there
    // would only push the game further down the screen.
    if (doc.getElementById("board") || doc.getElementById("ludoBoard")) return;
    if (main.querySelector(".toc")) return;

    // Only the headings that belong to the article, never ones inside a
    // dialog or a footer.
    const headings = Array.prototype.filter.call(
      main.querySelectorAll("h2, h3"),
      (h) => !h.closest(".win-overlay") && !h.closest("footer")
    );
    const h2s = headings.filter((h) => h.tagName === "H2");
    if (h2s.length < 3) return;      // too short to be worth a table of contents

    const nav = doc.createElement("nav");
    nav.className = "toc";
    nav.setAttribute("aria-label", "On this page");
    const title = doc.createElement("b");
    title.className = "toc-title";
    title.textContent = "On this page";
    nav.appendChild(title);

    const list = doc.createElement("ul");
    let lastH2Item = null;
    headings.forEach(function (h) {
      if (!h.id) h.id = slug(h.textContent);
      const li = doc.createElement("li");
      const a = doc.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      if (h.tagName === "H2") {
        list.appendChild(li);
        lastH2Item = li;
      } else if (lastH2Item) {
        // An h3 belongs under the h2 above it.
        let sub = lastH2Item.querySelector("ul.toc-sub");
        if (!sub) {
          sub = doc.createElement("ul");
          sub.className = "toc-sub";
          lastH2Item.appendChild(sub);
        }
        sub.appendChild(li);
      } else {
        // An h3 before any h2 - treat it as a top level entry.
        list.appendChild(li);
      }
    });
    nav.appendChild(list);

    const h1 = main.querySelector("h1");
    if (h1 && h1.parentNode) h1.parentNode.insertBefore(nav, h1.nextSibling);
  }

  function init() {
    buildThemeToggle();
    buildBackToTop();
    buildToc();
    // The game pages pin their controls to the bottom of the screen on
    // narrow viewports, so the back-to-top button has to clear them.
    if (doc.getElementById("roll")) doc.body.classList.add("has-game-bar");
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();

  /* ---------- modal dialog helper ----------
     Both games show a "you win" dialog. This opens it properly for
     keyboard and screen reader users: focus moves into the dialog,
     Tab stays inside it, Escape closes it and focus goes back to
     wherever it came from. */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  root.SiteDialog = {
    open: function (overlay, onClose) {
      if (!overlay) return;
      root.__siteDialogReturnFocus = doc.activeElement;
      overlay.classList.add("show");
      overlay.__siteDialogOnClose = onClose || null;
      const first = overlay.querySelector(FOCUSABLE);
      if (first) first.focus();
      else overlay.focus();
    },

    close: function (overlay) {
      if (!overlay) return;
      const wasOpen = overlay.classList.contains("show");
      overlay.classList.remove("show");
      const cb = overlay.__siteDialogOnClose;
      overlay.__siteDialogOnClose = null;
      if (wasOpen && cb) cb();
      const back = root.__siteDialogReturnFocus;
      root.__siteDialogReturnFocus = null;
      if (back && typeof back.focus === "function" && doc.contains(back)) back.focus();
    },

    /* Called from a document-level keydown handler. */
    handleKey: function (overlay, e) {
      if (!overlay || !overlay.classList.contains("show")) return false;
      if (e.key === "Escape") {
        e.preventDefault();
        this.close(overlay);
        return true;
      }
      if (e.key === "Tab") {
        const items = Array.prototype.filter.call(
          overlay.querySelectorAll(FOCUSABLE),
          (el) => el.offsetParent !== null
        );
        if (!items.length) return false;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && doc.activeElement === first) {
          e.preventDefault();
          last.focus();
          return true;
        }
        if (!e.shiftKey && doc.activeElement === last) {
          e.preventDefault();
          first.focus();
          return true;
        }
      }
      return false;
    }
  };
})();
