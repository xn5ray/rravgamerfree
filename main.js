'use strict';

/* Klawiatura w walce. Zwraca true, gdy klawisz został obsłużony.
   1-9 (0 = dziesiąta): wybór karty z ręki, Enter: zagraj ją. Gdy trzeba wskazać wroga (kilku żywych),
   cyfry wybierają wroga, a Enter zagrywa kartę. Esc cofa wybór. */
function combatKey(e) {
  if (!G || !C || C.over) return false;
  const targeting = C.selected !== null;
  if (/^[0-9]$/.test(e.key)) {
    if (targeting) {
      const i = +e.key - 1;
      if (C.enemies[i] && !C.enemies[i].dead) { KEYSEL.target = i; renderCombat(); }
    } else {
      const i = (+e.key + 9) % 10;
      if (i < C.hand.length) { KEYSEL.card = i; renderCombat(); }
    }
    return true;
  }
  if (e.key === 'Enter') {
    if (targeting) {
      if (KEYSEL.target === null) return true;
      act('play', C.selected, KEYSEL.target);
      return true;
    }
    if (KEYSEL.card === null) return false;
    onCardClick(KEYSEL.card);
    return true;
  }
  if (e.key === 'Escape' && (targeting || KEYSEL.card !== null)) {
    C.selected = null; KEYSEL.card = null; KEYSEL.target = null;
    renderCombat();
    return true;
  }
  return false;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (!$('#modal').hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey || /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
  if ((e.key === 'e' || e.key === 'E') && C && !C.over) act('ready');
  if (canSwitchView() && e.key === 'Tab') { e.preventDefault(); switchPlayer((G.ap + 1) % G.players.length); }
  if (combatKey(e)) e.preventDefault();
});

if (SPRITE_OPTIONS.pixelArt) document.body.classList.add('pixel');

showMenu();
