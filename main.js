'use strict';

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (!$('#modal').hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey || /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
  if ((e.key === 'e' || e.key === 'E') && C && !C.over) act('ready');
  if (canSwitchView() && e.key === 'Tab') { e.preventDefault(); switchPlayer((G.ap + 1) % G.players.length); }
  if (G && C && !C.over && /^[0-9]$/.test(e.key)) {
    const i = (+e.key + 9) % 10; // 1 -> pierwsza karta, 0 -> dziesiąta
    if (i < C.hand.length) onCardClick(i);
  }
  if (e.key === 'Escape' && G && C && !C.over && C.selected !== null) { C.selected = null; renderCombat(); }
});

if (SPRITE_OPTIONS.pixelArt) document.body.classList.add('pixel');

showMenu();
