'use strict';

/* ---------- Narzędzia ---------- */
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const screen = () => $('#screen');

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

function cardText(d) {
  const p = [];
  const all = d.aoe ? ' wszystkim wrogom' : '';
  if (d.selfdmg) p.push(`Strać <b>${d.selfdmg}</b> HP.`);
  if (d.energy) p.push(`Zyskaj <b>${d.energy}</b> energii.`);
  if (d.block) p.push(`Zyskaj <b>${d.block}</b> pancerza.`);
  if (d.dmg) p.push(`Zadaj <b>${d.dmg}</b> obrażeń${d.hits > 1 ? ` <b>${d.hits}</b>×` : ''}${all}.`);
  if (d.vuln) p.push(`Nałóż <b>${d.vuln}</b> Podatności${all}.`);
  if (d.weak) p.push(`Nałóż <b>${d.weak}</b> Osłabienia${all}.`);
  if (d.str) p.push(`Zyskaj <b>${d.str}</b> Siły.`);
  if (d.draw) p.push(`Dobierz <b>${d.draw}</b> ${plural(d.draw, 'kartę', 'karty', 'kart')}.`);
  if (d.ritual) p.push(`Na początku tury zyskaj <b>${d.ritual}</b> Siły.`);
  if (d.plating) p.push(`Na koniec tury zyskaj <b>${d.plating}</b> pancerza.`);
  if (d.thorns) p.push(`Zyskaj <b>${d.thorns}</b> Kolców.`);
  if (d.exhaust) p.push('<i>Wyczerp.</i>');
  return p.join(' ');
}

function cardEl(inst) {
  const d = cardDef(inst);
  const e = h('div', `card ${d.type} ${d.rarity} ${inst.up ? 'up' : ''}`);
  e.innerHTML = `<div class="cost">${d.cost}</div><div class="cname">${d.name}</div>` +
    `<div class="art">${art('cards', d.id, d.icon)}</div><div class="ctype">${TYPE_PL[d.type]}</div><div class="ctext">${cardText(d)}</div>`;
  return e;
}

function needsTarget(d) {
  return !d.aoe && (d.dmg || d.vuln || d.weak) ? true : false;
}

function randomCard(rarityRoll) {
  const r = rarityRoll ?? Math.random();
  const rarity = r < 0.6 ? 'common' : r < 0.9 ? 'uncommon' : 'rare';
  return pick(Object.keys(CARDS).filter(id => CARDS[id].rarity === rarity));
}

function cardChoices(n, bonusRare) {
  const ids = new Set();
  let guard = 0;
  while (ids.size < n && guard++ < 100) {
    ids.add(randomCard(bonusRare ? Math.random() * 0.8 + 0.2 : Math.random()));
  }
  return [...ids].map(id => ({ id, up: false }));
}

/* ---------- Przebieg ---------- */
const hasRelic = id => G.relics.includes(id);
function heal(n) { G.hp = Math.min(G.max, G.hp + n); }

function gainRelic(id) {
  G.relics.push(id);
  if (id === 'perla') { G.max += 10; G.hp += 10; }
}

function randomRelic() {
  const pool = Object.keys(RELICS).filter(id => RELICS[id].rarity !== 'start' && !G.relics.includes(id));
  return pool.length ? pick(pool) : null;
}

/* ---------- Interfejs wspólny ---------- */
function renderHud() {
  const hud = $('#hud');
  if (!G) { hud.innerHTML = ''; return; }
  hud.innerHTML = '';
  const floor = G.node ? G.node.f + 1 : 0;
  hud.append(
    h('span', 'stat hp', `♥ ${G.hp}/${G.max}`),
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
      s.onclick = () => usePotion(i);
    } else s.disabled = true;
    pots.append(s);
  }
  hud.append(pots);
  const deck = h('button', 'btn small', `Talia (${G.deck.length})`);
  deck.onclick = () => showDeck(G.deck, 'Twoja talia');
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
