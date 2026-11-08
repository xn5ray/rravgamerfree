'use strict';

/* ---------- Menu i start ---------- */
function showMenu() {
  G = null; C = null;
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const wins = (() => { try { return +localStorage.getItem('latarnia_wins') || 0; } catch (e) { return 0; } })();
  const box = h('div', 'center');
  box.innerHTML = `<div class="emoji-big">🏮</div><h1>Latarnia</h1>
    <p class="lead">Wspinaj się po zatopionej latarni. Walcz kartami, zbieraj relikty i dotrzymaj do Serca Głębiny na szczycie.</p>
    <p class="lead">Każda tura: 3 energii, 5 kart. Przeciwnicy pokazują, co zrobią. Planuj z wyprzedzeniem.</p>
    ${wins ? `<p class="lead">Wygrane przebiegi: <b>${wins}</b></p>` : ''}`;
  const b = h('button', 'btn primary', 'Nowa gra');
  b.id = 'newGame';
  b.onclick = showCharSelect;
  box.append(b);
  s.append(box);
}

function showCharSelect() {
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.append(h('h2', '', 'Wybierz postać'));
  const row = h('div', 'row chars');
  Object.entries(CHARACTERS).forEach(([id, c]) => {
    const b = h('button', 'panel charcard');
    b.dataset.char = id;
    const relics = c.relics.map(r => `${art('relics', r, RELICS[r].icon)} ${RELICS[r].name}`).join(', ');
    b.innerHTML = `<div class="portrait">${art('characters', id, c.icon)}</div><div class="cname">${c.name}</div>` +
      `<div class="hp">♥ ${c.hp} HP · 🪙 ${c.gold}</div><p class="lead">${c.desc}</p>` +
      `<div class="relicline">${relics}</div>`;
    b.onclick = () => startRun(id);
    row.append(b);
  });
  box.append(row);
  const back = h('button', 'btn', 'Wstecz');
  back.onclick = showMenu;
  box.append(back);
  s.append(box);
}

function startRun(charId) {
  const c = CHARACTERS[charId];
  G = {
    char: charId, hp: c.hp, max: c.hp, gold: c.gold,
    deck: c.deck.map(id => ({ id, up: false })),
    relics: [], potions: [], node: null, map: genMap(), removals: 0
  };
  c.relics.forEach(gainRelic);
  showMap();
}

/* ---------- Mapa ---------- */
function pickType(f) {
  if (f === 0) return 'fight';
  if (f === ROWS - 1) return 'boss';
  if (f === ROWS - 2) return 'rest';
  const w = [['fight', 45], ['event', 22]];
  if (f >= 2) w.push(['shop', 8]);
  if (f >= 3) w.push(['rest', 12]);
  if (f >= 4) w.push(['elite', 13]);
  let r = Math.random() * w.reduce((a, b) => a + b[1], 0);
  for (const [t, n] of w) { if ((r -= n) < 0) return t; }
  return 'fight';
}

function genMap() {
  const floors = [];
  for (let f = 0; f < ROWS; f++) {
    const n = f === 0 ? 3 : f === ROWS - 1 ? 1 : rnd(2, 4);
    const nodes = [];
    for (let j = 0; j < n; j++) {
      nodes.push({ f, j, x: (j + 0.5) / n + (n > 1 ? (Math.random() - 0.5) * 0.06 : 0), type: pickType(f), next: [], done: false });
    }
    floors.push(nodes);
  }
  for (let f = 0; f < ROWS - 1; f++) {
    const A = floors[f], B = floors[f + 1];
    A.forEach(a => {
      const sorted = [...B].sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x));
      a.next.push(sorted[0]);
      if (sorted[1] && Math.abs(sorted[1].x - a.x) < 0.4 && Math.random() < 0.5) a.next.push(sorted[1]);
    });
    B.forEach(b => {
      if (!A.some(a => a.next.includes(b))) {
        [...A].sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x))[0].next.push(b);
      }
    });
  }
  return floors;
}

const NODE_ICON = { fight: '⚔️', elite: '💀', rest: '🔥', shop: '🛒', event: '❓', boss: '🫀' };
const NODE_NAME = { fight: 'Walka', elite: 'Elita', rest: 'Ognisko', shop: 'Sklep', event: 'Wydarzenie', boss: 'Boss' };

function showMap() {
  closeModal();
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const wrap = h('div', 'map-wrap');
  const STEP = 84, H = ROWS * STEP + 60;
  const map = h('div', 'map');
  map.style.height = H + 'px';
  const y = f => H - 40 - f * STEP;
  const avail = G.node ? G.node.next : G.map[0];

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  G.map.forEach(row => row.forEach(a => a.next.forEach(b => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', a.x * 100 + '%'); l.setAttribute('y1', y(a.f));
    l.setAttribute('x2', b.x * 100 + '%'); l.setAttribute('y2', y(b.f));
    if (a.done && (b.done || G.node === b)) l.setAttribute('class', 'walked');
    svg.append(l);
  })));
  map.append(svg);

  G.map.forEach(row => row.forEach(n => {
    const can = avail.includes(n);
    const b = h('button', `node ${n.type}${can ? ' avail' : ''}${n.done ? ' done' : ''}`, art('nodes', n.type, NODE_ICON[n.type]));
    b.style.left = n.x * 100 + '%';
    b.style.top = y(n.f) + 'px';
    b.title = NODE_NAME[n.type];
    b.disabled = !can;
    b.onclick = () => enterNode(n);
    map.append(b);
  }));
  wrap.append(map);
  s.append(wrap);
  const targetF = G.node ? G.node.f : 0;
  wrap.scrollTop = Math.max(0, y(targetF) - wrap.clientHeight * 0.65);
}

function enterNode(n) {
  G.node = n;
  if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startCombat(n.type);
  else if (n.type === 'rest') showRest();
  else if (n.type === 'shop') showShop();
  else showEvent();
}
function leaveNode() { G.node.done = true; showMap(); }

/* ---------- Nagrody ---------- */
function showReward(r) {
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.append(h('h2', '', 'Zwycięstwo'));
  box.append(h('p', 'lead', `Zdobywasz <b>${r.gold}</b> złota.`));
  if (r.relic) {
    const R = RELICS[r.relic];
    box.append(h('p', 'lead', `Relikt: ${R.icon} <b>${R.name}</b> – ${R.desc}`));
  }
  if (r.potion) {
    const P = POTIONS[r.potion];
    const b = h('button', 'btn', `${P.icon} Weź: ${P.name} (${P.desc})`);
    b.onclick = () => {
      if (G.potions.length >= 3) { toast('Masz komplet mikstur'); return; }
      G.potions.push(r.potion); b.remove(); renderHud();
    };
    box.append(b);
  }
  box.append(h('p', 'lead', 'Wybierz kartę do talii:'));
  const row = h('div', 'row');
  r.cards.forEach(inst => {
    const e = cardEl(inst);
    e.classList.add('clickable');
    e.tabIndex = 0;
    const take = () => {
      if (r.taken) return;
      r.taken = true; G.deck.push({ ...inst }); leaveNode();
    };
    e.onclick = take;
    e.onkeydown = ev => { if (ev.key === 'Enter') take(); };
    row.append(e);
  });
  box.append(row);
  const skip = h('button', 'btn', 'Pomiń kartę');
  skip.onclick = () => { if (!r.taken) { r.taken = true; leaveNode(); } };
  box.append(skip);
  s.append(box);
}

/* ---------- Ognisko ---------- */
function showRest() {
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.innerHTML = `<div class="emoji-big">🔥</div><h2>Ognisko</h2><p class="lead">Płomień trzyma sztorm na dystans. Masz chwilę.</p>`;
  const choices = h('div', 'choices');
  const amount = Math.floor(G.max * 0.3);
  const rest = h('button', 'btn', `Odpocznij: lecz ${amount} HP`);
  rest.onclick = () => { heal(amount); leaveNode(); };
  const upgradable = G.deck.filter(c => !c.up);
  const up = h('button', 'btn', 'Ulepsz kartę');
  up.disabled = !upgradable.length;
  up.onclick = () => showDeck(upgradable, 'Wybierz kartę do ulepszenia', inst => { inst.up = true; leaveNode(); });
  choices.append(rest, up);
  box.append(choices);
  s.append(box);
}

/* ---------- Sklep ---------- */
function showShop() {
  const n = G.node;
  if (!n.shop) {
    const price = id => Math.round(CARD_PRICE[CARDS[id].rarity] * (0.9 + Math.random() * 0.25));
    const ids = [];
    ['common', 'common', 'uncommon', 'uncommon', 'rare'].forEach(r => {
      const pool = Object.keys(CARDS).filter(id => CARDS[id].rarity === r && !ids.includes(id));
      ids.push(pick(pool));
    });
    const rel = randomRelic();
    n.shop = {
      cards: ids.map(id => ({ inst: { id, up: false }, price: price(id), sold: false })),
      relic: rel ? { id: rel, price: rnd(140, 190), sold: false } : null,
      potions: shuffle(Object.keys(POTIONS)).slice(0, 2).map(id => ({ id, price: rnd(45, 65), sold: false })),
      removed: false
    };
  }
  drawShop();
}

function drawShop() {
  const sh = G.node.shop;
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.append(h('h2', '', 'Sklep'), h('p', 'lead', 'Handlarz z wraku sprzedaje to, co wyłowił.'));
  const row = h('div', 'row');
  sh.cards.forEach(item => {
    const w = h('div', 'shop-item' + (item.sold ? ' sold' : ''));
    const e = cardEl(item.inst);
    e.classList.add('clickable');
    const buy = h('button', 'btn small', `Kup za ${item.price} 🪙`);
    buy.disabled = G.gold < item.price;
    const doBuy = () => { if (G.gold < item.price || item.sold) return; G.gold -= item.price; item.sold = true; G.deck.push({ ...item.inst }); drawShop(); };
    e.onclick = doBuy; buy.onclick = doBuy;
    w.append(e, buy);
    row.append(w);
  });
  box.append(row);

  const row2 = h('div', 'row');
  if (sh.relic) {
    const R = RELICS[sh.relic.id];
    const b = h('button', 'btn', `${R.icon} ${R.name} – ${R.desc} (${sh.relic.price} 🪙)`);
    b.disabled = sh.relic.sold || G.gold < sh.relic.price;
    b.onclick = () => { G.gold -= sh.relic.price; sh.relic.sold = true; gainRelic(sh.relic.id); drawShop(); };
    row2.append(b);
  }
  sh.potions.forEach(p => {
    const P = POTIONS[p.id];
    const b = h('button', 'btn', `${P.icon} ${P.name} (${p.price} 🪙)`);
    b.title = P.desc;
    b.disabled = p.sold || G.gold < p.price || G.potions.length >= 3;
    b.onclick = () => { G.gold -= p.price; p.sold = true; G.potions.push(p.id); drawShop(); };
    row2.append(b);
  });
  const cost = 75 + G.removals * 25;
  const rm = h('button', 'btn', `Usuń kartę z talii (${cost} 🪙)`);
  rm.disabled = sh.removed || G.gold < cost || G.deck.length <= 5;
  rm.onclick = () => showDeck(G.deck, 'Wybierz kartę do usunięcia', inst => {
    G.gold -= cost; G.removals++; sh.removed = true;
    G.deck.splice(G.deck.indexOf(inst), 1); drawShop();
  });
  row2.append(rm);
  box.append(row2);

  const leave = h('button', 'btn primary', 'Wyjdź ze sklepu');
  leave.onclick = leaveNode;
  box.append(leave);
  s.append(box);
}

/* ---------- Wydarzenia ---------- */
const EVENTS = [
  {
    icon: '🚢', title: 'Wrak statku',
    text: 'Z mielizny wystaje kadłub zatopionego statku. W ładowni coś błyszczy, ale pokład trzeszczy.',
    choices: [
      { label: 'Przeszukaj ładownię (+60 złota, −8 HP)', fn: done => { G.gold += 60; loseHpSafe(8); done('Znajdujesz mokrą sakiewkę. Deski kaleczą ci dłonie.'); } },
      { label: 'Odejdź', fn: done => done('Zostawiasz wrak falom.') }
    ]
  },
  {
    icon: '🧜', title: 'Syrena w grocie',
    text: 'Syrena zaprasza cię do wody. Obiecuje, że jej pieśń wyostrzy twój oręż. Za darmo nic nie dostaniesz.',
    choices: [
      { label: 'Oddaj krew (−7 HP, ulepsz kartę)', fn: done => {
        const up = G.deck.filter(c => !c.up);
        loseHpSafe(7);
        if (!up.length) return done('Nie masz już czego ulepszać. Syrena śmieje się i znika.');
        showDeck(up, 'Wybierz kartę do ulepszenia', inst => { inst.up = true; done('Karta lśni zimnym światłem.'); });
      } },
      { label: 'Zatkaj uszy i odejdź', fn: done => done('Pieśń cichnie za twoimi plecami.') }
    ]
  },
  {
    icon: '📦', title: 'Zardzewiała skrzynia',
    text: 'Skrzynia jest zamknięta na zardzewiały zamek. Może być pusta, a może pułapka.',
    choices: [
      { label: 'Otwórz (50%: relikt, 50%: −12 HP)', fn: done => {
        if (Math.random() < 0.5) {
          const r = randomRelic();
          if (r) { gainRelic(r); return done(`W środku leży ${RELICS[r].icon} ${RELICS[r].name}.`); }
          G.gold += 60; return done('W środku jest tylko 60 złota.');
        }
        loseHpSafe(12); done('Pułapka! Zardzewiałe ostrze rani ci ramię.');
      } },
      { label: 'Zostaw skrzynię', fn: done => done('Nie ryzykujesz.') }
    ]
  },
  {
    icon: '🕯️', title: 'Stara latarnia',
    text: 'Na półpiętrze pali się knot. Możesz odpocząć przy jego świetle albo przetopić coś ze swojej talii.',
    choices: [
      { label: 'Odpocznij (lecz 15 HP)', fn: done => { heal(15); done('Światło koi rany.'); } },
      { label: 'Pozbądź się karty (usuń kartę z talii)', fn: done => {
        if (G.deck.length <= 5) return done('Masz zbyt małą talię.');
        showDeck(G.deck, 'Wybierz kartę do usunięcia', inst => { G.deck.splice(G.deck.indexOf(inst), 1); done('Karta znika w płomieniu.'); });
      } }
    ]
  }
];

function showEvent() {
  const ev = G.node.event || (G.node.event = pick(EVENTS));
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.innerHTML = `<div class="emoji-big">${ev.icon}</div><h2>${ev.title}</h2><p class="lead">${ev.text}</p>`;
  const choices = h('div', 'choices');
  const finish = text => {
    renderHud();
    s.innerHTML = '';
    const b2 = h('div', 'center');
    b2.append(h('p', 'lead', text));
    const c = h('button', 'btn primary', 'Dalej');
    c.onclick = () => { if (G.hp <= 0) showEnd(false); else leaveNode(); };
    b2.append(c);
    s.append(b2);
  };
  ev.choices.forEach(c => {
    const b = h('button', 'btn', c.label);
    b.onclick = () => { choices.querySelectorAll('button').forEach(x => x.disabled = true); c.fn(finish); };
    choices.append(b);
  });
  box.append(choices);
  s.append(box);
}

/* ---------- Koniec ---------- */
function showEnd(win) {
  closeModal();
  renderHud();
  if (win) { try { localStorage.setItem('latarnia_wins', String((+localStorage.getItem('latarnia_wins') || 0) + 1)); } catch (e) { /* brak pamięci */ } }
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  const floor = G.node ? G.node.f + 1 : 0;
  box.innerHTML = win
    ? `<div class="emoji-big">🌅</div><h1>Światło wróciło</h1><p class="lead">Serce Głębiny przestaje bić, a latarnia znów świeci nad morzem.</p>`
    : `<div class="emoji-big">🌊</div><h1>Pochłonęła cię woda</h1><p class="lead">Dotarłeś na piętro ${floor} z ${ROWS}.</p>`;
  box.append(h('p', 'lead', `Talia: ${G.deck.length} kart · relikty: ${G.relics.length} · złoto: ${G.gold}`));
  const b = h('button', 'btn primary', 'Zagraj ponownie');
  b.id = 'again';
  b.onclick = showMenu;
  box.append(b);
  s.append(box);
}
