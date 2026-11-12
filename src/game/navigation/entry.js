// One official title entrance, while preserving existing independent scene HTMLs.
// This is a navigation guard, not security/authentication. Tickets are one-use and
// scoped to this browser tab, exact destination path/query, and a short lifetime.
(function () {
  'use strict';
  const script = document.currentScript;
  const root = new URL('../../../', script.src);
  const ticketKey = 'kikokuno-hanamusubi-next-entry';
  const ticketLifetimeMs = 120000; // Allows a slow iPhone Safari navigation.
  const scenePaths = new Set([
    'src/opening/',
    'src/game/village/',
    'src/game/interiors/',
    'src/field/',
    'src/game/tenyo/',
  ].map(path => new URL(path, root).pathname));

  function consumeTicket() {
    try {
      const raw = sessionStorage.getItem(ticketKey);
      sessionStorage.removeItem(ticketKey); // A reload or copied link must not reuse it.
      if (!raw) return false;
      const ticket = JSON.parse(raw);
      return ticket.route === location.pathname + location.search &&
        Number.isFinite(ticket.expiresAt) && Date.now() <= ticket.expiresAt;
    } catch {
      return false;
    }
  }

  function go(target) {
    const destination = new URL(target, location.href);
    if (destination.origin !== root.origin || !scenePaths.has(destination.pathname)) {
      throw new Error('本編の遷移先ではありません: ' + destination.href);
    }
    try {
      sessionStorage.setItem(ticketKey, JSON.stringify({
        route: destination.pathname + destination.search,
        expiresAt: Date.now() + ticketLifetimeMs,
      }));
    } catch {
      // Never bypass the guard when private browsing blocks storage.
      document.documentElement.style.visibility = 'hidden';
      location.replace(root.href);
      return;
    }
    location.assign(destination.href);
  }

  window.KIKOKU_ROUTE = Object.freeze({ go });
  if (script.dataset?.entry === 'title') {
    try { sessionStorage.removeItem(ticketKey); } catch { /* unavailable */ }
  } else if (script.dataset?.entry === 'game' && !consumeTicket()) {
    // Run synchronously in <head> before scene modules or assets are loaded.
    document.documentElement.style.visibility = 'hidden';
    location.replace(root.href);
  }
})();
