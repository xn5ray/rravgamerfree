'use strict';

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (!$('#modal').hidden) return;
  if ((e.key === 'e' || e.key === 'E') && C && !C.over) endTurn();
});

showMenu();
