// Authorize the official title -> opening -> game-shell sequence.
// Legacy per-scene documents render only inside the persistent gameplay shell.
// A direct link / reload to any playable screen returns to the title.
(function () {
  'use strict';
  const script = document.currentScript;
  const root = new URL('../../../', script.src);
  const ticketKey = 'kikokuno-hanamusubi-field-comparison-next-entry';
  const lifetime = 120000;
  const scenePaths = new Set([
    'src/opening/', 'src/game/', 'src/game/village/',
    'src/game/interiors/', 'src/field/', 'src/game/tenyo/', 'src/game/battle/',
  ].map(path => new URL(path, root).pathname));
  function consumeTicket() {
    try {
      const raw = sessionStorage.getItem(ticketKey);
      sessionStorage.removeItem(ticketKey);
      if (!raw) return false;
      const ticket = JSON.parse(raw);
      return ticket.route === location.pathname + location.search &&
        Number.isFinite(ticket.expiresAt) && Date.now() <= ticket.expiresAt;
    } catch {
      return false;
    }
  }
  function hostedGame() {
    if (!window.parent || window.parent === window) return null;
    try {
      const host = window.parent.KIKOKU_GAME;
      return host?.acceptsChild?.(location.href, window) ? host : null;
    } catch {
      return null;
    }
  }
  const mode = script.dataset?.entry;
  const host = mode === 'game' ? hostedGame() : null;
  function go(target) {
    const destination = new URL(target, location.href);
    if (destination.origin !== root.origin || !scenePaths.has(destination.pathname)) {
      throw new Error('本編の遷移先ではありません: ' + destination.href);
    }
    if (host) {
      // Inner scenes never navigate their own document on a normal area change.
      host.navigate(destination.href, window);
      return;
    }
    try {
      sessionStorage.setItem(ticketKey, JSON.stringify({
        route: destination.pathname + destination.search,
        expiresAt: Date.now() + lifetime,
      }));
    } catch {
      document.documentElement.style.visibility = 'hidden';
      location.replace(root.href);
      return;
    }
    location.assign(destination.href);
  }
  let admitted = true;
  if (mode === 'title') {
    try { sessionStorage.removeItem(ticketKey); } catch {}
  } else if (mode === 'shell') {
    admitted = consumeTicket();
  } else if (mode === 'game') {
    admitted = Boolean(host) || consumeTicket();
  }
  window.KIKOKU_ROUTE = Object.freeze({go, admitted});
  if (!admitted) {
    document.documentElement.style.visibility = 'hidden';
    location.replace(root.href);
  }
})();
