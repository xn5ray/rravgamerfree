'use strict';

/* ---------- Przeciwnicy ---------- */
function mkEnemy(id) {
  const def = ENEMIES[id];
  const hp = rnd(def.hp[0], def.hp[1]);
  const e = {
    id, def, name: def.name, icon: def.icon, hp, max: hp, block: 0,
    st: { str: 0, weak: 0, vuln: 0 }, turn: 0, dead: false,
    off: def.fixed ? 0 : rnd(0, def.moves.length - 1), intent: null
  };
  setIntent(e);
  return e;
}
function setIntent(e) {
  e.intent = e.def.moves[(e.turn + e.off) % e.def.moves.length];
}

function calcDmg(base, atk, def) {
  let d = base + (atk.str || 0);
  if (atk.weak > 0) d = Math.floor(d * 0.75);
  if (def.vuln > 0) d = Math.floor(d * 1.5);
  return Math.max(0, d);
}

/* ---------- Start walki ---------- */
function startCombat(kind) {
  let ids;
  if (kind === 'boss') ids = ['serce'];
  else if (kind === 'elite') ids = [pick(ELITES)];
  else ids = pick(G.node.f < 4 ? ENC_EASY : ENC_HARD);
  C = {
    kind, enemies: ids.map(mkEnemy),
    draw: shuffle(G.deck.map(c => ({ ...c }))), hand: [], discard: [], exhaust: [],
    energy: 0, maxEnergy: 3 + (hasRelic('lampa') ? 1 : 0),
    block: 0, st: { str: (hasRelic('zab') ? 1 : 0) + (hasRelic('rum') ? 2 : 0), weak: 0, vuln: 0, ritual: 0, plating: 0, regen: 0, thorns: hasRelic('beczka') ? 2 : 0 },
    turn: 0, selected: null, phase: 'player', busy: false, over: false
  };
  if (hasRelic('rum')) loseHpSafe(3);
  if (hasRelic('dzwon')) C.enemies.forEach(e => { e.st.weak += 1; e.st.vuln += 1; });
  startTurn();
}

function startTurn() {
  C.turn++;
  C.block = (C.turn === 1 && hasRelic('kotwica')) ? 10 : 0;
  C.st.str += C.st.ritual;
  if (C.st.regen) { heal(C.st.regen); floatAt($('#player'), `+${C.st.regen}`, 'heal'); }
  C.energy = C.maxEnergy + (hasRelic('zegar') && C.turn % 3 === 0 ? 1 : 0);
  C.phase = 'player';
  drawCards(5 + (hasRelic('muszla') ? 1 : 0) + (C.turn === 1 && hasRelic('kompas') ? 2 : 0));
  renderCombat();
}

function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (!C.draw.length) {
      if (!C.discard.length) break;
      C.draw = shuffle(C.discard);
      C.discard = [];
    }
    const c = C.draw.pop();
    if (C.hand.length >= 10) C.discard.push(c); else C.hand.push(c);
  }
}

/* ---------- Zagrywanie kart ---------- */
const aliveEnemies = () => C.enemies.filter(e => !e.dead);
const enemyEl = e => document.getElementById('en-' + C.enemies.indexOf(e));

function hitEnemy(t, base) {
  const d = calcDmg(base, C.st, t.st);
  let rem = d;
  if (t.block > 0) { const ab = Math.min(t.block, rem); t.block -= ab; rem -= ab; }
  t.hp -= rem;
  const el = enemyEl(t);
  floatAt(el, rem > 0 ? `-${rem}` : '🛡️', rem > 0 ? 'dmg' : 'blk');
  if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  if (t.hp <= 0) { t.hp = 0; t.dead = true; }
}

function resolveCard(d, target) {
  const targets = d.aoe ? aliveEnemies() : (target ? [target] : []);
  if (d.selfdmg) { G.hp -= d.selfdmg; floatAt($('#player'), `-${d.selfdmg}`, 'dmg'); }
  if (d.energy) C.energy += d.energy;
  if (d.block) { C.block += d.block; floatAt($('#player'), `+${d.block}`, 'blk'); }
  if (d.heal) { heal(d.heal); floatAt($('#player'), `+${d.heal}`, 'heal'); }
  if (d.doubleBlock) { C.block *= 2; floatAt($('#player'), `🛡️ ${C.block}`, 'blk'); }
  if (d.dmg || d.blockDmg) {
    const base = d.blockDmg ? C.block : d.dmg;
    for (let i = 0; i < (d.hits || 1); i++) targets.forEach(t => {
      if (t.dead) return;
      hitEnemy(t, base + (d.strMul ? C.st.str * (d.strMul - 1) : 0) + (d.vulnBonus && t.st.vuln > 0 ? d.vulnBonus : 0));
    });
  }
  targets.forEach(t => {
    if (t.dead) return;
    if (d.vuln) t.st.vuln += d.vuln + (hasRelic('soczewka') ? 1 : 0);
    if (d.weak) t.st.weak += d.weak;
  });
  if (d.str) C.st.str += d.str;
  if (d.ritual) C.st.ritual += d.ritual;
  if (d.plating) C.st.plating += d.plating;
  if (d.regen) C.st.regen += d.regen;
  if (d.thorns) C.st.thorns += d.thorns;
  if (d.draw) drawCards(d.draw);
}

function playCard(i, target) {
  if (C.phase !== 'player' || C.busy || C.over) return;
  const inst = C.hand[i];
  if (!inst) return;
  const d = cardDef(inst);
  if (d.cost > C.energy) { toast('Za mało energii'); return; }
  C.energy -= d.cost;
  C.hand.splice(i, 1);
  C.selected = null;
  resolveCard(d, target);
  if (d.type === 'attack' && hasRelic('lancuch')) { C.block += 1; floatAt($('#player'), '+1', 'blk'); }
  if (d.type !== 'power') (d.exhaust ? C.exhaust : C.discard).push(inst);
  renderCombat();
  checkEnd();
}

function onCardClick(i) {
  if (C.phase !== 'player' || C.busy || C.over) return;
  const d = cardDef(C.hand[i]);
  if (C.selected === i) { C.selected = null; renderCombat(); return; }
  if (d.cost > C.energy) { toast('Za mało energii'); return; }
  if (needsTarget(d)) {
    const alive = aliveEnemies();
    if (alive.length === 1) playCard(i, alive[0]);
    else { C.selected = i; renderCombat(); }
  } else playCard(i);
}

function onEnemyClick(i) {
  const e = C.enemies[i];
  if (C.selected === null || e.dead) return;
  playCard(C.selected, e);
}

/* ---------- Mikstury ---------- */
function usePotion(i) {
  if (!C || C.over || C.phase !== 'player' || C.busy) { toast('Mikstury działają tylko w walce'); return; }
  const id = G.potions[i];
  if (id === 'zdrowie') { heal(15); floatAt($('#player'), '+15', 'heal'); }
  else if (id === 'sila') C.st.str += 2;
  else if (id === 'tarcza') C.block += 12;
  else if (id === 'energia') C.energy += 2;
  else if (id === 'ogien') aliveEnemies().forEach(t => {
    t.hp -= Math.max(0, 12 - t.block); t.block = Math.max(0, t.block - 12);
    floatAt(enemyEl(t), '-12', 'dmg');
    if (t.hp <= 0) { t.hp = 0; t.dead = true; }
  });
  G.potions.splice(i, 1);
  renderCombat();
  checkEnd();
}

/* ---------- Tura wrogów ---------- */
function damagePlayer(n) {
  let rem = n;
  if (C.block > 0) { const ab = Math.min(C.block, rem); C.block -= ab; rem -= ab; }
  G.hp -= rem;
  const p = $('#player');
  floatAt(p, rem > 0 ? `-${rem}` : '🛡️', rem > 0 ? 'dmg' : 'blk');
  if (p) { p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit'); }
}

function enemyAct(e) {
  const m = e.intent;
  if (m.block) e.block += m.block;
  if (m.str) e.st.str += m.str;
  if (m.heal) {
    e.hp = Math.min(e.max, e.hp + m.heal);
    floatAt(enemyEl(e), `+${m.heal}`, 'heal');
  }
  if (m.dmg) {
    for (let i = 0; i < (m.hits || 1); i++) {
      damagePlayer(calcDmg(m.dmg, e.st, C.st));
      if (C.st.thorns) {
        e.hp -= C.st.thorns;
        floatAt(enemyEl(e), `-${C.st.thorns}`, 'dmg');
        if (e.hp <= 0) { e.hp = 0; e.dead = true; break; }
      }
      if (G.hp <= 0) break;
    }
  }
  if (m.weak) C.st.weak += m.weak;
  if (m.vuln) C.st.vuln += m.vuln;
}

async function endTurn() {
  if (!C || C.phase !== 'player' || C.busy || C.over) return;
  C.busy = true;
  C.selected = null;
  if (C.st.plating) C.block += C.st.plating;
  if (hasRelic('siec')) C.block += C.hand.length;
  if (hasRelic('zagiel') && C.energy >= 2) C.block += 8;
  if (C.st.weak > 0) C.st.weak--;
  if (C.st.vuln > 0) C.st.vuln--;
  C.discard.push(...C.hand);
  C.hand = [];
  C.phase = 'enemy';
  renderCombat();
  for (const e of C.enemies) {
    if (e.dead) continue;
    await sleep(450);
    if (C.over) return;
    e.block = 0;
    enemyAct(e);
    renderCombat();
    if (checkEnd()) return;
  }
  for (const e of C.enemies) {
    if (e.dead) continue;
    e.turn++;
    if (e.st.weak > 0) e.st.weak--;
    if (e.st.vuln > 0) e.st.vuln--;
    setIntent(e);
  }
  await sleep(300);
  if (C.over) return;
  C.busy = false;
  startTurn();
}

/* ---------- Koniec walki ---------- */
function checkEnd() {
  if (C.over) return true;
  if (G.hp <= 0 && hasRelic('pas') && !G.pasUsed) {
    G.pasUsed = true;
    G.hp = Math.min(G.max, 15);
    toast('Pas ratunkowy cię uratował!');
    renderCombat();
    return false;
  }
  if (G.hp <= 0) {
    G.hp = 0; C.over = true;
    renderCombat();
    setTimeout(() => showEnd(false), 700);
    return true;
  }
  if (C.enemies.every(e => e.dead)) {
    C.over = true;
    renderCombat();
    setTimeout(winCombat, 700);
    return true;
  }
  return false;
}

function winCombat() {
  if (hasRelic('pierscien')) heal(6);
  if (hasRelic('lza')) { G.max += 2; G.hp += 2; }
  const kind = C.kind;
  if (kind === 'boss') { showEnd(true); return; }
  let gold = kind === 'elite' ? rnd(25, 35) : rnd(10, 20);
  if (hasRelic('sakiewka')) gold += 10;
  G.gold += gold;
  const rewards = {
    gold,
    cards: cardChoices(3, kind === 'elite'),
    potion: Math.random() < (kind === 'elite' ? 0.6 : 0.35) + (hasRelic('mapa') ? 0.25 : 0) ? pick(Object.keys(POTIONS)) : null,
    relic: kind === 'elite' ? randomRelic() : null,
    taken: false
  };
  if (rewards.relic) gainRelic(rewards.relic);
  C = null;
  showReward(rewards);
}

/* ---------- Rysowanie walki ---------- */
function hpBar(hp, max) {
  const pct = Math.max(0, Math.min(100, hp / max * 100));
  return `<div class="hpbar"><div class="fill" style="width:${pct}%"></div><span>${hp}/${max}</span></div>`;
}
function chips(st) {
  const out = [];
  const add = (v, icon, name) => { if (v) out.push(`<span class="chip" title="${name}">${icon} ${v}</span>`); };
  add(st.str, '💪', 'Siła: zwiększa obrażenia');
  add(st.weak, '💧', 'Osłabienie: −25% obrażeń');
  add(st.vuln, '💔', 'Podatność: +50% otrzymywanych obrażeń');
  add(st.ritual, '🕯️', 'Rytuał: Siła na początku tury');
  add(st.plating, '🧂', 'Zbroja: pancerz na koniec tury');
  add(st.thorns, '🪸', 'Kolce: atakujący otrzymują obrażenia');
  add(st.regen, '🌅', 'Odnowa: leczenie na początku tury');
  return out.join('');
}
function intentHtml(e) {
  const m = e.intent;
  const parts = [];
  if (m.dmg) {
    const d = calcDmg(m.dmg, e.st, C.st);
    parts.push(`⚔️ ${d}${m.hits > 1 ? `×${m.hits}` : ''}`);
  }
  if (m.block) parts.push(`🛡️ ${m.block}`);
  if (m.str) parts.push(`⬆️ ${m.str}`);
  if (m.heal) parts.push(`💚 ${m.heal}`);
  if (m.weak || m.vuln) parts.push('☠️');
  return parts.join(' ');
}

function renderCombat() {
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const root = h('div', 'combat');
  const arena = h('div', 'arena');

  const p = h('div', 'figure player');
  p.id = 'player';
  const ch = CHARACTERS[G.char];
  p.innerHTML = `<div class="portrait">${art('characters', G.char, ch.icon)}</div><div class="name">${ch.name}</div>${hpBar(Math.max(0, G.hp), G.max)}` +
    `<div class="blk">${C.block > 0 ? '🛡️ ' + C.block : '&nbsp;'}</div><div class="chips">${chips(C.st)}</div>`;

  const enemies = h('div', 'enemies');
  C.enemies.forEach((e, i) => {
    const t = C.selected !== null && !e.dead;
    const f = h('div', `figure enemy${e.dead ? ' dead' : ''}${t ? ' targetable' : ''}`);
    f.id = 'en-' + i;
    f.innerHTML = `<div class="intent">${e.dead ? '&nbsp;' : intentHtml(e)}</div><div class="portrait">${art('enemies', e.id, e.icon)}</div>` +
      `<div class="name">${e.name}</div>${hpBar(e.hp, e.max)}<div class="blk">${e.block > 0 ? '🛡️ ' + e.block : '&nbsp;'}</div>` +
      `<div class="chips">${chips(e.st)}</div>`;
    f.onclick = () => onEnemyClick(i);
    enemies.append(f);
  });
  arena.append(p, enemies);

  const bar = h('div', 'bar');
  bar.append(h('div', 'energy', `${C.energy}/${C.maxEnergy}`));
  const draw = h('button', 'pile', `📚 ${C.draw.length}`);
  draw.title = 'Stos dobierania';
  draw.onclick = () => showDeck([...C.draw].sort((a, b) => CARDS[a.id].name.localeCompare(CARDS[b.id].name, 'pl')), 'Stos dobierania');
  const disc = h('button', 'pile', `🗑️ ${C.discard.length}`);
  disc.title = 'Stos odrzuconych';
  disc.onclick = () => showDeck(C.discard, 'Stos odrzuconych');
  bar.append(draw, disc, h('span', 'grow'));
  const end = h('button', 'btn primary', 'Zakończ turę');
  end.id = 'endTurn';
  end.disabled = C.phase !== 'player' || C.busy || C.over;
  end.onclick = endTurn;
  bar.append(end);

  const hand = h('div', 'hand');
  C.hand.forEach((inst, i) => {
    const d = cardDef(inst);
    const e = cardEl(inst);
    e.classList.add('clickable');
    if (d.cost > C.energy) e.classList.add('unplayable');
    if (C.selected === i) e.classList.add('selected');
    e.style.setProperty('--r', `${(i - (C.hand.length - 1) / 2) * 1.6}deg`);
    e.onclick = () => onCardClick(i);
    hand.append(e);
  });

  root.append(arena, bar, hand);
  s.append(root);
}
