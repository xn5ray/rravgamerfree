'use strict';

/* ---------- Menu i start ---------- */
function showMenu() {
  if (typeof netClose === 'function') netClose();
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
  b.onclick = () => showCharSelect(1);
  const b2 = h('button', 'btn', 'Co-op lokalny (2 graczy)');
  b2.id = 'newGameCoop';
  b2.onclick = () => showCharSelect(2);
  const b3 = h('button', 'btn', 'Online (P2P, 2 graczy)');
  b3.id = 'newGameOnline';
  b3.onclick = () => showLobby();
  const bs = h('div', 'choices');
  bs.append(b, b2, b3);
  box.append(bs);
  s.append(box);
}

function showCharSelect(count = 1, picked = [], onPick = null) {
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.append(h('h2', '', count > 1 ? `Gracz ${picked.length + 1}: wybierz postać` : onPick ? 'Wybierz swoją postać' : 'Wybierz postać'));
  const row = h('div', 'row chars');
  Object.entries(CHARACTERS).forEach(([id, c]) => {
    const b = h('button', 'panel charcard');
    b.dataset.char = id;
    const relics = c.relics.map(r => `${art('relics', r, RELICS[r].icon)} ${RELICS[r].name}`).join(', ');
    b.innerHTML = `<div class="portrait">${art('characters', id, c.icon)}</div><div class="cname">${c.name}</div>` +
      `<div class="hp">♥ ${c.hp} HP · 🪙 ${c.gold}</div><p class="lead">${c.desc}</p>` +
      `<div class="relicline">${relics}</div>`;
    b.onclick = () => {
      if (onPick) { onPick(id); return; }
      const all = [...picked, id];
      if (all.length >= count) startRun(count > 1 ? all : id); else showCharSelect(count, all);
    };
    row.append(b);
  });
  box.append(row);
  const back = h('button', 'btn', 'Wstecz');
  back.onclick = () => (picked.length ? showCharSelect(count, picked.slice(0, -1)) : showMenu());
  box.append(back);
  s.append(box);
}

function startRun(charIds) {
  const ids = Array.isArray(charIds) ? charIds : [charIds];
  const coop = ids.length > 1;
  const players = ids.map(id => {
    const c = CHARACTERS[id];
    return { char: id, hp: c.hp, max: c.hp, deck: c.deck.map(d => ({ id: d, up: false })), relics: [], potions: [], pasUsed: false };
  });
  const gold = ids.reduce((a, id) => a + CHARACTERS[id].gold, 0) / ids.length;
  G = { players, ap: NET ? NET.me : 0, screen: 'map', gold: Math.round(gold * (coop ? COOP.goldScale : 1)), node: null, map: genMap(), removals: 0, reward: null };
  delegate(G, PLAYER_KEYS, 'players');
  ids.forEach((id, i) => withPlayer(i, () => CHARACTERS[id].relics.forEach(gainRelic)));
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
  let r = rand() * w.reduce((a, b) => a + b[1], 0);
  for (const [t, n] of w) { if ((r -= n) < 0) return t; }
  return 'fight';
}

function genMap() {
  const floors = [];
  for (let f = 0; f < ROWS; f++) {
    const n = f === 0 ? 3 : f === ROWS - 1 ? 1 : rnd(2, 4);
    const nodes = [];
    for (let j = 0; j < n; j++) {
      nodes.push({ f, j, x: (j + 0.5) / n + (n > 1 ? (rand() - 0.5) * 0.06 : 0), type: pickType(f), next: [], done: false });
    }
    floors.push(nodes);
  }
  for (let f = 0; f < ROWS - 1; f++) {
    const A = floors[f], B = floors[f + 1];
    A.forEach(a => {
      const sorted = [...B].sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x));
      a.next.push(sorted[0]);
      if (sorted[1] && Math.abs(sorted[1].x - a.x) < 0.4 && rand() < 0.5) a.next.push(sorted[1]);
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
  G.screen = 'map';
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
    b.onclick = () => act('node', n.f, n.j);
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
function leaveNode() { G.node.done = true; setActive(NET ? NET.me : 0); showMap(); }

/* ---------- Nagrody ---------- */
function showReward() {
  const r = G.reward;
  G.screen = 'reward';
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  const multi = isCoop();
  const me = viewIndex();
  box.append(h('h2', '', 'Zwycięstwo'));
  box.append(h('p', 'lead', `Zdobywasz <b>${r.gold}</b> złota.`));
  if (r.relic) {
    const R = RELICS[r.relic];
    box.append(h('p', 'lead', `Relikt${multi ? ` dla gracza ${r.relicFor + 1}` : ''}: ${R.icon} <b>${R.name}</b> – ${R.desc}`));
  }
  r.pc.forEach((pc, i) => {
    const sec = h('div', multi ? `rewardsec p${i}` : 'rewardsec solo');
    if (multi) sec.append(h('h3', '', `Gracz ${i + 1}: ${playerName(i)}${NET && i === me ? ' (Ty)' : ''}`));
    // w trybie online każdy wybiera tylko za siebie; lokalnie wybiera się za każdego
    const mine = !NET || i === me;
    if (pc.potion) {
      const P = POTIONS[pc.potion];
      const b = h('button', 'btn', `${P.icon} Weź: ${P.name} (${P.desc})`);
      b.disabled = !mine;
      b.onclick = () => act('rewardPotion', i);
      sec.append(b);
    }
    if (pc.taken) { sec.append(h('p', 'lead', 'Wybór zrobiony.')); box.append(sec); return; }
    if (!mine) { sec.append(h('p', 'lead', 'Partner wybiera kartę…')); box.append(sec); return; }
    sec.append(h('p', 'lead', 'Wybierz kartę do talii:'));
    const row = h('div', 'row');
    pc.cards.forEach((inst, ci) => {
      const e = cardEl(inst);
      e.classList.add('clickable');
      e.tabIndex = 0;
      e.onclick = () => act('rewardCard', i, ci);
      e.onkeydown = ev => { if (ev.key === 'Enter') e.onclick(); };
      row.append(e);
    });
    sec.append(row);
    const skip = h('button', 'btn', 'Pomiń kartę');
    skip.onclick = () => act('rewardCard', i, -1);
    sec.append(skip);
    box.append(sec);
  });
  s.append(box);
}

/* ---------- Ognisko ---------- */
function showRest() { inView(drawRest); }
function drawRest() {
  const n = G.node;
  if (!n.rest) n.rest = G.players.map(() => false);
  G.screen = 'rest';
  const me = G.ap;
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.innerHTML = `<div class="emoji-big">🔥</div><h2>Ognisko</h2><p class="lead">Płomień trzyma sztorm na dystans. Masz chwilę.</p>` +
    (isCoop() ? `<p class="lead who p${me}">Gracz ${me + 1}: ${playerName(me)}</p>` : '');
  if (n.rest[me]) {
    box.append(h('p', 'lead', isCoop() ? 'Odpoczynek zakończony. Czekasz na partnera…' : 'Odpoczynek zakończony.'));
    s.append(box);
    return;
  }
  const choices = h('div', 'choices');
  const amount = Math.floor(G.max * 0.3);
  const rest = h('button', 'btn', `Odpocznij: lecz ${amount} HP`);
  rest.onclick = () => act('restHeal');
  const upgradable = G.deck.filter(c => !c.up);
  const up = h('button', 'btn', 'Ulepsz kartę');
  up.disabled = !upgradable.length;
  up.onclick = () => showDeck(upgradable, 'Wybierz kartę do ulepszenia', inst => act('restUp', G.deck.indexOf(inst)));
  choices.append(rest, up);
  box.append(choices);
  s.append(box);
}
function restDone() {
  G.node.rest[G.ap] = true;
  if (G.node.rest.every(Boolean)) { leaveNode(); return; }
  if (!NET) setActive(G.node.rest.findIndex(d => !d)); // lokalnie: przejdź do tego, kto jeszcze nie odpoczął
  showRest();
}

/* ---------- Sklep ---------- */
/**
 * Przy pierwszej wizycie zapisuje ofertę sklepu w bieżącym węźle, potem ją wyświetla.
 * Karty są unikalne i dostępne dla aktualnej postaci; kolejne wizyty zachowują ofertę.
 */
function showShop() {
  const n = G.node;
  if (!n.shop) {
    const price = id => Math.round(CARD_PRICE[CARDS[id].rarity] * (0.9 + rand() * 0.25));
    const ids = [];
    const rarities = ['common', 'common', 'uncommon', 'uncommon', 'rare'];
    if (isCoop()) rarities.push('common', 'uncommon');
    rarities.forEach((r, k) => {
      const pool = withPlayer(k % G.players.length, () => cardPool(r)).filter(id => !ids.includes(id));
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

function drawShop() { inView(drawShopBody); }
function drawShopBody() {
  const sh = G.node.shop;
  G.screen = 'shop';
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.append(h('h2', '', 'Sklep'), h('p', 'lead', 'Handlarz z wraku sprzedaje to, co wyłowił.'));
  if (isCoop()) box.append(h('p', `lead who p${G.ap}`, `Kupujesz dla: gracz ${G.ap + 1} (${playerName(G.ap)}). ${NET ? 'Złoto jest wspólne, wyjście ze sklepu kończy go obu graczom.' : 'Przełącz gracza u góry. Złoto jest wspólne.'}`));
  const row = h('div', 'row');
  sh.cards.forEach(item => {
    const w = h('div', 'shop-item' + (item.sold ? ' sold' : ''));
    const e = cardEl(item.inst);
    e.classList.add('clickable');
    const buy = h('button', 'btn small', `Kup za ${item.price} 🪙`);
    const foreign = !!CARDS[item.inst.id].char && CARDS[item.inst.id].char !== G.char;
    buy.disabled = G.gold < item.price || foreign;
    if (foreign) buy.textContent = 'Inna postać';
    const doBuy = () => act('shopCard', sh.cards.indexOf(item));
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
    b.onclick = () => act('shopRelic');
    row2.append(b);
  }
  sh.potions.forEach(p => {
    const P = POTIONS[p.id];
    const b = h('button', 'btn', `${P.icon} ${P.name} (${p.price} 🪙)`);
    b.title = P.desc;
    b.disabled = p.sold || G.gold < p.price || G.potions.length >= 3;
    b.onclick = () => act('shopPotion', sh.potions.indexOf(p));
    row2.append(b);
  });
  const cost = 75 + G.removals * 25;
  const rm = h('button', 'btn', `Usuń kartę z talii (${cost} 🪙)`);
  rm.disabled = sh.removed || G.gold < cost || G.deck.length <= 5;
  rm.onclick = () => showDeck(G.deck, 'Wybierz kartę do usunięcia', inst => act('shopRemove', G.deck.indexOf(inst)));
  row2.append(rm);
  box.append(row2);

  const leave = h('button', 'btn primary', 'Wyjdź ze sklepu');
  leave.onclick = () => act('leave');
  box.append(leave);
  s.append(box);
}

/* ---------- Wydarzenia ----------
   Wybór dotyczy gracza, który go zrobił. `pick` ('up' albo 'rm') oznacza, że wybierający wskazuje
   jeszcze kartę z własnej talii (trafia do fn jako `inst`). */
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
      { label: 'Oddaj krew (−7 HP, ulepsz kartę)', pick: 'up', fn: (done, inst) => {
        loseHpSafe(7);
        if (!inst) return done('Nie masz już czego ulepszać. Syrena śmieje się i znika.');
        inst.up = true; done('Karta lśni zimnym światłem.');
      } },
      { label: 'Zatkaj uszy i odejdź', fn: done => done('Pieśń cichnie za twoimi plecami.') }
    ]
  },
  {
    icon: '📦', title: 'Zardzewiała skrzynia',
    text: 'Skrzynia jest zamknięta na zardzewiały zamek. Może być pusta, a może pułapka.',
    choices: [
      { label: 'Otwórz (50%: relikt, 50%: −12 HP)', fn: done => {
        if (rand() < 0.5) {
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
      { label: 'Pozbądź się karty (usuń kartę z talii)', pick: 'rm', fn: (done, inst) => {
        if (!inst) return done('Masz zbyt małą talię.');
        G.deck.splice(G.deck.indexOf(inst), 1); done('Karta znika w płomieniu.');
      } }
    ]
  }
];

/* Lista kart, spośród których wybierający wskazuje kartę dla wyboru wydarzenia (puste: nie trzeba). */
function eventPickList(c) {
  if (c.pick === 'up') return G.deck.filter(x => !x.up);
  if (c.pick === 'rm') return G.deck.length > 5 ? G.deck : [];
  return [];
}

function showEvent() { inView(drawEvent); }
function drawEvent() {
  const n = G.node;
  if (n.eventIdx === undefined) n.eventIdx = rnd(0, EVENTS.length - 1);
  const ev = EVENTS[n.eventIdx];
  G.screen = 'event';
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.innerHTML = `<div class="emoji-big">${ev.icon}</div><h2>${ev.title}</h2><p class="lead">${ev.text}</p>`;
  if (n.evResult) {
    const by = n.evResult.by;
    if (isCoop()) box.append(h('p', `lead who p${by}`, `Zdecydował: gracz ${by + 1} (${playerName(by)})`));
    box.append(h('p', 'lead', n.evResult.text));
    const c = h('button', 'btn primary', 'Dalej');
    c.onclick = () => act('eventNext');
    box.append(c);
    s.append(box);
    return;
  }
  if (isCoop()) box.append(h('p', `lead who p${G.ap}`, NET
    ? 'Wybór zrobi ten z was, kto pierwszy kliknie. Dotyczy tylko jego.'
    : `Decyduje: gracz ${G.ap + 1} (${playerName(G.ap)}). Przełącz gracza u góry. Wybór dotyczy tylko jego.`));
  const choices = h('div', 'choices');
  ev.choices.forEach((c, ci) => {
    const b = h('button', 'btn', c.label);
    b.onclick = () => {
      const list = eventPickList(c);
      if (c.pick && list.length) {
        showDeck(list, c.pick === 'up' ? 'Wybierz kartę do ulepszenia' : 'Wybierz kartę do usunięcia', inst => act('eventChoice', ci, G.deck.indexOf(inst)));
      } else act('eventChoice', ci, -1);
    };
    choices.append(b);
  });
  box.append(choices);
  s.append(box);
}

/* ---------- Koniec ---------- */
function showEnd(win) {
  closeModal();
  G.screen = 'end';
  renderHud();
  if (win) { try { localStorage.setItem('latarnia_wins', String((+localStorage.getItem('latarnia_wins') || 0) + 1)); } catch (e) { /* brak pamięci */ } }
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  const floor = G.node ? G.node.f + 1 : 0;
  box.innerHTML = win
    ? `<div class="emoji-big">🌅</div><h1>Światło wróciło</h1><p class="lead">Serce Głębiny przestaje bić, a latarnia znów świeci nad morzem.</p>`
    : `<div class="emoji-big">🌊</div><h1>Pochłonęła cię woda</h1><p class="lead">Dotarłeś na piętro ${floor} z ${ROWS}.</p>`;
  G.players.forEach((p, i) => box.append(h('p', 'lead', `${isCoop() ? `Gracz ${i + 1} (${CHARACTERS[p.char].name}): ` : ''}talia: ${p.deck.length} kart · relikty: ${p.relics.length}`)));
  box.append(h('p', 'lead', `Złoto: ${G.gold}`));
  const b = h('button', 'btn primary', 'Zagraj ponownie');
  b.id = 'again';
  b.onclick = showMenu;
  box.append(b);
  s.append(box);
}

/* ---------- Akcje (patrz act() w core.js) ---------- */
ACTIONS.node = (f, j) => {
  if (G.screen !== 'map' || (C && !C.over)) return;
  const n = G.map[f] && G.map[f][j];
  if (n && (G.node ? G.node.next : G.map[0]).includes(n)) enterNode(n);
};
ACTIONS.rewardPotion = i => {
  const r = G.reward, pc = r && r.pc[i];
  if (G.screen !== 'reward' || !pc || !pc.potion) return;
  if (G.players[i].potions.length >= 3) { toast('Masz komplet mikstur'); return; }
  G.players[i].potions.push(pc.potion); pc.potion = null;
  showReward();
};
ACTIONS.rewardCard = (i, ci) => {
  const r = G.reward, pc = r && r.pc[i];
  if (G.screen !== 'reward' || !pc || pc.taken) return;
  if (ci >= 0 && pc.cards[ci]) G.players[i].deck.push({ ...pc.cards[ci] });
  else if (ci >= 0) return;
  pc.taken = true;
  if (r.pc.every(x => x.taken)) leaveNode(); else showReward();
};
ACTIONS.restHeal = () => {
  if (G.screen !== 'rest' || G.node.rest[G.ap]) return;
  heal(Math.floor(G.max * 0.3));
  restDone();
};
ACTIONS.restUp = di => {
  if (G.screen !== 'rest' || G.node.rest[G.ap]) return;
  const inst = G.deck[di];
  if (!inst || inst.up) return;
  inst.up = true;
  restDone();
};
ACTIONS.shopCard = ci => {
  const sh = G.screen === 'shop' && G.node.shop, item = sh && sh.cards[ci];
  if (!item || item.sold || G.gold < item.price) return;
  if (CARDS[item.inst.id].char && CARDS[item.inst.id].char !== G.char) return;
  G.gold -= item.price; item.sold = true; G.deck.push({ ...item.inst });
  drawShop();
};
ACTIONS.shopRelic = () => {
  const sh = G.screen === 'shop' && G.node.shop, it = sh && sh.relic;
  if (!it || it.sold || G.gold < it.price) return;
  G.gold -= it.price; it.sold = true; gainRelic(it.id);
  drawShop();
};
ACTIONS.shopPotion = pi => {
  const sh = G.screen === 'shop' && G.node.shop, it = sh && sh.potions[pi];
  if (!it || it.sold || G.gold < it.price || G.potions.length >= 3) return;
  G.gold -= it.price; it.sold = true; G.potions.push(it.id);
  drawShop();
};
ACTIONS.shopRemove = di => {
  const sh = G.screen === 'shop' && G.node.shop, inst = G.deck[di];
  const cost = 75 + G.removals * 25;
  if (!sh || !inst || sh.removed || G.gold < cost || G.deck.length <= 5) return;
  G.gold -= cost; G.removals++; sh.removed = true;
  G.deck.splice(di, 1);
  drawShop();
};
ACTIONS.leave = () => { if (G.screen === 'shop') leaveNode(); };
ACTIONS.eventChoice = (ci, di) => {
  const n = G.node;
  if (G.screen !== 'event' || n.evResult) return;
  const c = EVENTS[n.eventIdx].choices[ci];
  if (!c) return;
  let inst = null;
  if (c.pick) {
    const list = eventPickList(c);
    inst = di >= 0 && list.includes(G.deck[di]) ? G.deck[di] : null;
    if (list.length && !inst) return;
  }
  c.fn(text => { n.evResult = { text, by: G.ap }; showEvent(); }, inst);
};
ACTIONS.eventNext = () => {
  if (G.screen !== 'event' || !G.node.evResult) return;
  if (G.players.every(p => p.hp <= 0)) showEnd(false); else leaveNode();
};
