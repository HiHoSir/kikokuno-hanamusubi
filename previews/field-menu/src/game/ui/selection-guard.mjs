// Prevent Safari selection handles, image drag ghosts, and long-press
// context menus on gameplay content. Do not block clicks, pointer events,
// or touchstart; those are essential to the D-pad, A/B and dialogue.
const game = document.querySelector('main');
for (const type of ['selectstart', 'contextmenu', 'dragstart']) {
  game?.addEventListener(type, event => event.preventDefault());
}
