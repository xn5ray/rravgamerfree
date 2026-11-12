'use strict';

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (!$('#modal').hidden) return;
  if ((e.key === 'e' || e.key === 'E') && C && !C.over) act('ready');
  if (canSwitchView()) {
    if (e.key === 'Tab') { e.preventDefault(); switchPlayer((G.ap + 1) % G.players.length); }
    else if (e.key === '1' || e.key === '2') switchPlayer(+e.key - 1);
  }
});

if (SPRITE_OPTIONS.pixelArt) document.body.classList.add('pixel');

showMenu();
