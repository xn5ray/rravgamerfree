'use strict';

/* ---------- Narzędzia ---------- */
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
/* Cała losowość gry idzie przez rand(). W trybie online obie strony ustawiają ten sam seed
   (seedRng), dzięki czemu liczą identyczną grę z tych samych akcji. */
let rand = Math.random;
function seedRng(seed) {
  let a = seed >>> 0;
  rand = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = a => a[Math.floor(rand() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* setTimeout, o którym wie tryb online: dopóki coś czeka, nie stosuje się cudzych akcji. */
function defer(fn, ms) {
  if (NET) NET.pending++;
  setTimeout(() => { if (NET) NET.pending--; fn(); }, ms);
}
const screen = () => $('#screen');

/* ---------- Wielu graczy ----------
   G.players[i] trzyma trwały stan gracza, a C.ps[i] stan jego walki. Pola takie jak G.hp, G.deck,
   C.hand czy C.block są "delegowane" do aktywnego gracza (G.ap / C.ap), więc cały kod napisany
   dla jednego gracza działa dla aktualnie wybranego. Do innego gracza przechodzi się przez
   setActive() albo withPlayer(). Tryb solo to po prostu lista z jednym graczem. */
const PLAYER_KEYS = ['char', 'hp', 'max', 'deck', 'relics', 'potions', 'pasUsed'];
const COMBAT_KEYS = ['draw', 'hand', 'discard', 'exhaust', 'energy', 'maxEnergy', 'block', 'st', 'orbs', 'slots', 'nextEnergy', 'minions', 'minionSlots', 'spawn', 'ready'];

function delegate(obj, keys, listKey) {
  keys.forEach(k => Object.defineProperty(obj, k, {
    get() { return this[listKey][this.ap][k]; },
    set(v) { this[listKey][this.ap][k] = v; },
    enumerable: true, configurable: true
  }));
}
function setActive(i) { G.ap = i; if (C) C.ap = i; }
function withPlayer(i, fn) {
  const prev = G.ap;
  setActive(i);
  try { return fn(); } finally { setActive(prev); }
}
const isCoop = () => !!G && G.players.length > 1;
const isAlive = i => G.players[i].hp > 0;
const alivePlayers = () => G.players.map((p, i) => i).filter(isAlive);
const pickTarget = () => { const a = alivePlayers(); return a.length ? pick(a) : 0; };
const playerEl = () => document.getElementById('player-' + (C ? C.ap : 0));
const playerName = i => CHARACTERS[G.players[i].char].name;

/* ---------- Akcje graczy ----------
   Każde kliknięcie zmieniające grę idzie przez act(nazwa, ...argumenty). Lokalnie wykonuje się od
   razu dla widocznego gracza, a online jest wysyłane do hosta, numerowane i wykonywane identycznie
   u obu graczy (patrz net.js). Same akcje rejestrują się w ACTIONS (combat.js, screens.js). */
const ACTIONS = {};
let NET = null;   // stan sesji online (null poza trybem online)
const viewIndex = () => (NET ? NET.me : G.ap);
const inView = fn => withPlayer(viewIndex(), fn);
function act(name, ...args) {
  if (!G) return;
  if (NET) { NET.submit(name, args); return; }
  runAction(G.ap, name, args);
}
function runAction(p, name, args) {
  const fn = ACTIONS[name];
  if (!fn || !G || !(p >= 0 && p < G.players.length)) return;
  if (p === G.ap) fn(...args); else withPlayer(p, () => fn(...args));
}

const SWITCH_SCREENS = ['shop', 'event', 'rest'];
const canSwitchView = () => !!G && !NET && isCoop() && ((C && !C.over) || SWITCH_SCREENS.includes(G.screen));

/* Odświeża bieżący ekran (po przełączeniu widoku gracza). */
function refreshView() {
  if (C && !C.over) { renderCombat(); return; }
  const f = { map: showMap, reward: () => showReward(), rest: showRest, shop: drawShop, event: showEvent }[G.screen];
  if (f) f();
}

/* Przełącza, którego gracza rękę i ekwipunek widać (tylko lokalnie). */
function switchPlayer(i) {
  if (!canSwitchView() || i === G.ap || i < 0 || i >= G.players.length) return;
  if (C && !C.over) {
    if (!isAlive(i)) { toast('Ten gracz poległ'); return; }
    C.selected = null;
  }
  setActive(i);
  refreshView();
}

/* Zwraca <img> ze sprite'a z sprites.js albo emoji, gdy sprite'a brak lub się nie wczyta. */
function art(kind, id, fallback) {
  const src = SPRITES[kind] && SPRITES[kind][id];
  if (!src) return fallback;
  return `<img class="sprite" src="${src}" alt="" draggable="false" data-fb="${fallback}" onerror="this.outerHTML=this.dataset.fb">`;
}

let G = null; // stan przebiegu
let C = null; // stan walki

/* ---------- Karty ---------- */
function cardDef(inst) {
  const b = CARDS[inst.id];
  const d = { ...b, ...(inst.up ? b.up : {}) };
  d.id = inst.id;
  if (inst.up) d.name = b.name + '+';
  return d;
}

function plural(n, one, few, many) {
  return n === 1 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? few : many;
}

/**
 * Buduje polski opis HTML efektów karty na podstawie jej definicji.
 * @param {Object} d - Definicja karty z uwzględnieniem ulepszenia.
 * @returns {string} Opisy aktywnych efektów połączone spacjami.
 */
function cardText(d) {
  const p = [];
  const all = d.aoe ? ' wszystkim wrogom' : '';
  if (d.selfdmg) p.push(`Strać <b>${d.selfdmg}</b> HP.`);
  if (d.energy) p.push(`Zyskaj <b>${d.energy}</b> energii.`);
  if (d.block) p.push(`Zyskaj <b>${d.block}</b> pancerza.`);
  if (d.heal) p.push(`Lecz <b>${d.heal}</b> HP.`);
  if (d.doubleBlock) p.push('Podwój pancerz.');
  if (d.blockDmg) p.push('Zadaj obrażenia równe pancerzowi.');
  if (d.dmg) p.push(d.perOrb ? `Zadaj <b>${d.dmg}</b> obrażeń za każdą kulę.` : d.perMinion ? `Zadaj <b>${d.dmg}</b> obrażeń za każdego sługę.` :`Zadaj <b>${d.dmg}</b> obrażeń${d.hits > 1 ? ` <b>${d.hits}</b>×` : ''}${all}.`);
  if (d.strMul) p.push(`Siła liczy się <b>${d.strMul}</b>×.`);
  if (d.vulnBonus) p.push(`<b>+${d.vulnBonus}</b>, jeśli wróg ma Podatność.`);
  if (d.vuln) p.push(`Nałóż <b>${d.vuln}</b> Podatności${all}.`);
  if (d.weak) p.push(`Nałóż <b>${d.weak}</b> Osłabienia${all}.`);
  if (d.str) p.push(`Zyskaj <b>${d.str}</b> Siły.`);
  if (d.draw) p.push(`Dobierz <b>${d.draw}</b> ${plural(d.draw, 'kartę', 'karty', 'kart')}.`);
  if (d.ritual) p.push(`Na początku tury zyskaj <b>${d.ritual}</b> Siły.`);
  if (d.plating) p.push(`Na koniec tury zyskaj <b>${d.plating}</b> pancerza.`);
  if (d.thorns) p.push(`Zyskaj <b>${d.thorns}</b> Kolców.`);
  if (d.regen) p.push(`Na początku tury lecz <b>${d.regen}</b> HP.`);
  if (d.focus) p.push(`Zyskaj <b>${d.focus}</b> Skupienia.`);
  if (d.slots) p.push(`Zyskaj <b>${d.slots}</b> ${plural(d.slots, 'miejsce', 'miejsca', 'miejsc')} na kule.`);
  if (d.loop) p.push(`Na koniec tury pierwsza kula działa dodatkowo <b>${d.loop}</b>×.`);
  if (d.channel) p.push(`Stwórz ${d.channel.length > 1 ? 'kule' : 'kulę'}: ${d.channel.map(o => `${ORBS[o].icon} ${ORBS[o].name}`).join(', ')}.`);
  if (d.evokeAll) p.push('Uwolnij wszystkie kule.');
  else if (d.evoke) p.push(`Uwolnij pierwszą kulę${d.evoke > 1 ? ` <b>${d.evoke}</b>×` : ''}.`);
  if (d.bonusIfMinion) p.push(`Jeśli masz sługę, zadaj dodatkowo <b>${d.bonusIfMinion}</b>.`);
  if (d.sacrifice) p.push('Poświęć pierwszego sługę.');
  if (d.sacrificeAll) p.push(`Poświęć wszystkich sług. Zadaj <b>${d.blast}</b> obrażeń wszystkim wrogom za każdego.`);
  if (d.healAll) p.push('Lecz wszystkich sług do pełna.');
  else if (d.healMinions) p.push(`Lecz wszystkich sług o <b>${d.healMinions}</b>.`);
  if (d.summon) p.push(`Przywołaj ${d.summon.length > 1 ? 'sługi' : 'sługę'}: ${d.summon.map(m => `${MINIONS[m].icon} ${MINIONS[m].name}`).join(', ')}.`);
  if (d.commandAll) p.push('Każdy sługa działa natychmiast.');
  if (d.necro) p.push(`Słudzy zadają i dają o <b>${d.necro}</b> więcej.`);
  if (d.spawnEach) p.push(`Na początku każdej tury przywołaj: ${MINIONS[d.spawnEach].icon} ${MINIONS[d.spawnEach].name}.`);
  if (d.exhaust) p.push('<i>Wyczerp.</i>');
  return p.join(' ');
}

function cardEl(inst) {
  const d = cardDef(inst);
  const text = cardText(d);
  const long = text.replace(/<[^>]+>/g, '').length > 55; // długie opisy dostają mniejszą czcionkę
  const e = h('div', `card ${d.type} ${d.rarity} ${inst.up ? 'up' : ''}`);
  e.innerHTML = `<div class="cost">${d.cost}</div><div class="cname">${d.name}</div>` +
    `<div class="art">${art('cards', d.id, d.icon)}</div><div class="ctype">${TYPE_PL[d.type]}</div><div class="ctext${long ? ' long' : ''}">${text}</div>`;
  return e;
}

/**
 * Sprawdza, czy obrażenia lub osłabienia karty wymagają wskazania jednego wroga.
 * @param {Object} d - Definicja karty; efekty obszarowe nie wymagają celu.
 * @returns {boolean} Czy gracz musi wybrać cel.
 */
function needsTarget(d) {
  return !d.aoe && (d.dmg || d.blockDmg || d.vuln || d.weak) ? true : false;
}

/**
 * Zwraca karty danej rzadkości dostępne dla aktualnej postaci (wspólne + jej własne).
 * Karty klasowe (pole `char`) trafiają się 3 razy częściej niż neutralne.
 * @param {string} rarity - Wymagana rzadkość karty.
 * @returns {string[]} Identyfikatory pasujących kart (z powtórzeniami jako wagami).
 */
function cardPool(rarity) {
  const out = [];
  Object.keys(CARDS).forEach(id => {
    const c = CARDS[id];
    if (c.rarity !== rarity || (c.char && c.char !== G.char)) return;
    for (let k = 0; k < (c.char ? 3 : 1); k++) out.push(id);
  });
  return out;
}

/**
 * Losuje kartę dostępną dla aktualnej postaci: 60% common, 30% uncommon, 10% rare.
 * @param {number} [rarityRoll] - Wynik losowania w przedziale [0, 1); domyślnie losowy.
 * @returns {string} Identyfikator wylosowanej karty.
 */
function randomCard(rarityRoll) {
  const r = rarityRoll ?? rand();
  const rarity = r < 0.6 ? 'common' : r < 0.9 ? 'uncommon' : 'rare';
  return pick(cardPool(rarity));
}

function cardChoices(n, bonusRare) {
  const ids = new Set();
  let guard = 0;
  while (ids.size < n && guard++ < 100) {
    ids.add(randomCard(bonusRare ? rand() * 0.8 + 0.2 : rand()));
  }
  return [...ids].map(id => ({ id, up: false }));
}

/* ---------- Przebieg ---------- */
const hasRelic = id => G.relics.includes(id);
function heal(n) { G.hp = Math.min(G.max, G.hp + n); }

function gainRelic(id) {
  G.relics.push(id);
  if (id === 'perla') { G.max += 10; G.hp += 10; }
  if (id === 'kufer') G.gold += 60;
}

function randomRelic() {
  const pool = Object.keys(RELICS).filter(id => RELICS[id].rarity !== 'start' && !G.relics.includes(id));
  return pool.length ? pick(pool) : null;
}

/* ---------- Interfejs wspólny ---------- */
function renderHud() {
  if (!G) { $('#hud').innerHTML = ''; return; }
  inView(drawHud);
}
function drawHud() {
  const hud = $('#hud');
  hud.innerHTML = '';
  const floor = G.node ? G.node.f + 1 : 0;
  if (isCoop()) {
    const canSwitch = canSwitchView();
    G.players.forEach((pl, i) => {
      const b = h(canSwitch ? 'button' : 'span', `pbadge p${i}${i === G.ap ? ' active' : ''}${pl.hp <= 0 ? ' dead' : ''}`,
        `<b>${i + 1}</b> ${CHARACTERS[pl.char].name} ♥ ${Math.max(0, pl.hp)}/${pl.max}${NET && i === NET.me ? ' (Ty)' : ''}`);
      if (canSwitch) b.onclick = () => switchPlayer(i);
      hud.append(b);
    });
  } else {
    hud.append(h('span', 'stat hp', `♥ ${G.hp}/${G.max}`));
  }
  hud.append(
    h('span', 'stat gold', `🪙 ${G.gold}`),
    h('span', 'stat', `Piętro ${floor}/${ROWS}`)
  );
  const relics = h('div', 'relics');
  G.relics.forEach(id => {
    const r = h('span', 'relic', art('relics', id, RELICS[id].icon));
    r.title = `${RELICS[id].name}: ${RELICS[id].desc}`;
    relics.append(r);
  });
  hud.append(relics, h('span', 'grow'));
  const pots = h('div', 'potions');
  for (let i = 0; i < 3; i++) {
    const id = G.potions[i];
    const s = h('button', 'potion-slot' + (id ? ' full' : ''), id ? art('potions', id, POTIONS[id].icon) : '');
    if (id) {
      s.title = `${POTIONS[id].name}: ${POTIONS[id].desc}`;
      s.onclick = () => act('potion', i);
    } else s.disabled = true;
    pots.append(s);
  }
  hud.append(pots);
  const deck = h('button', 'btn small', `Talia (${G.deck.length})`);
  deck.onclick = () => showDeck(G.deck, isCoop() ? `Talia gracza ${G.ap + 1}` : 'Twoja talia');
  hud.append(deck);
}

function openModal(title, content, closable = true) {
  const m = $('#modal');
  m.hidden = false;
  m.innerHTML = '';
  const inner = h('div', 'inner');
  const head = h('header');
  head.append(h('h2', '', title));
  if (closable) {
    const x = h('button', 'btn small', 'Zamknij');
    x.onclick = closeModal;
    head.append(x);
  }
  inner.append(head, content);
  m.append(inner);
  m.scrollTop = 0;
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }

function showDeck(cards, title, onPick) {
  const grid = h('div', 'grid');
  const list = onPick ? cards : [...cards].sort((a, b) => CARDS[a.id].cost - CARDS[b.id].cost || CARDS[a.id].name.localeCompare(CARDS[b.id].name, 'pl'));
  if (!list.length) grid.append(h('p', 'lead', 'Brak kart.'));
  list.forEach(inst => {
    const e = cardEl(inst);
    if (onPick) {
      e.classList.add('clickable');
      e.tabIndex = 0;
      e.onclick = () => { closeModal(); onPick(inst); };
      e.onkeydown = ev => { if (ev.key === 'Enter') e.onclick(); };
    }
    grid.append(e);
  });
  openModal(title, grid, true);
}

let toastTimer;
function toast(msg) {
  if (NET && NET.applyP != null && NET.applyP !== NET.me) return; // komunikat o cudzej akcji
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1400);
}

function floatAt(el, text, cls) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const f = h('div', `floaty ${cls}`, text);
  f.style.left = `${r.left + r.width / 2 - 14}px`;
  f.style.top = `${r.top + r.height / 3}px`;
  document.body.append(f);
  setTimeout(() => f.remove(), 1000);
}

function loseHpSafe(n) { G.hp = Math.max(1, G.hp - n); }
