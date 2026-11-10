'use strict';

/* ---------- Przeciwnicy ---------- */
function mkEnemy(id) {
  const def = ENEMIES[id];
  const scale = G.players.length > 1 ? COOP.hpScale : 1;
  const hp = Math.round(rnd(def.hp[0], def.hp[1]) * scale);
  const e = {
    id, def, name: def.name, icon: def.icon, hp, max: hp, block: 0,
    st: { str: 0, weak: 0, vuln: 0 }, turn: 0, dead: false,
    off: def.fixed ? 0 : rnd(0, def.moves.length - 1), intent: null, tgt: 0
  };
  setIntent(e);
  return e;
}
function setIntent(e) {
  e.intent = e.def.moves[(e.turn + e.off) % e.def.moves.length];
  e.tgt = pickTarget(); // w co-op wróg wybiera gracza, którego zaatakuje (widać to w zapowiedzi)
}

function calcDmg(base, atk, def) {
  let d = base + (atk.str || 0);
  if (atk.weak > 0) d = Math.floor(d * 0.75);
  if (def.vuln > 0) d = Math.floor(d * 1.5);
  return Math.max(0, d);
}

/* ---------- Start walki ---------- */
/** Tworzy stan walki jednego gracza (stos, ręka, energia, statusy, kule, słudzy). */
function mkPlayerCombat(p) {
  const has = id => p.relics.includes(id);
  return {
    draw: shuffle(p.deck.map(c => ({ ...c }))), hand: [], discard: [], exhaust: [],
    energy: 0, maxEnergy: 3 + (has('lampa') ? 1 : 0), block: 0,
    st: { str: (has('zab') ? 1 : 0) + (has('rum') ? 2 : 0), weak: 0, vuln: 0, ritual: 0, plating: 0, regen: 0, thorns: has('beczka') ? 2 : 0, focus: 0, loop: 0, necro: 0 },
    orbs: [], slots: 3, nextEnergy: 0,
    minions: [], minionSlots: 4, spawn: [],
    ready: false
  };
}

/**
 * Tworzy stan walki, stos dobierania i efekty reliktów, po czym rozpoczyna turę.
 * @param {string} kind - Rodzaj starcia: boss, elite lub zwykła walka.
 */
function startCombat(kind) {
  let ids;
  if (kind === 'boss') ids = ['serce'];
  else if (kind === 'elite') ids = [pick(ELITES)];
  else ids = pick(G.node.f < 4 ? ENC_EASY : ENC_HARD);
  C = {
    kind, enemies: ids.map(id => mkEnemy(id)), ps: G.players.map(mkPlayerCombat), ap: G.ap,
    turn: 0, selected: null, phase: 'player', busy: false, over: false
  };
  delegate(C, COMBAT_KEYS, 'ps');
  G.players.forEach((p, i) => withPlayer(i, () => {
    if (hasRelic('rum')) loseHpSafe(3);
    if (hasRelic('dzwon')) C.enemies.forEach(e => { e.st.weak += 1; e.st.vuln += 1; });
    if (hasRelic('rdzen')) channelOrb('blysk');
    if (hasRelic('amulet')) summonMinion('szkielet');
  }));
  startTurn();
}

/**
 * Rozpoczyna turę gracza: odnawia pancerz i energię, stosuje rytuał i regenerację,
 * dobiera karty z premiami reliktów oraz odświeża widok walki.
 */
function startTurn() {
  C.turn++;
  C.phase = 'player';
  C.selected = null;
  G.players.forEach((p, i) => { if (p.hp > 0) withPlayer(i, startPlayerTurn); });
  const first = alivePlayers()[0];
  setActive(first === undefined ? 0 : first);
  renderCombat();
}

function startPlayerTurn() {
  C.ready = false;
  C.block = (C.turn === 1 && hasRelic('kotwica')) ? 10 : 0;
  C.st.str += C.st.ritual;
  if (C.st.regen) { heal(C.st.regen); floatAt(playerEl(), `+${C.st.regen}`, 'heal'); }
  C.energy = C.maxEnergy + C.nextEnergy + (hasRelic('zegar') && C.turn % 3 === 0 ? 1 : 0);
  C.nextEnergy = 0;
  C.spawn.forEach(id => summonMinion(id));
  drawCards(5 + (hasRelic('muszla') ? 1 : 0) + (C.turn === 1 && hasRelic('kompas') ? 2 : 0));
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

function hitEnemy(t, base) { dealDamage(t, calcDmg(base, C.st, t.st)); }

function dealDamage(t, d) {
  let rem = d;
  if (t.block > 0) { const ab = Math.min(t.block, rem); t.block -= ab; rem -= ab; }
  t.hp -= rem;
  const el = enemyEl(t);
  floatAt(el, rem > 0 ? `-${rem}` : '🛡️', rem > 0 ? 'dmg' : 'blk');
  if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  if (t.hp <= 0) { t.hp = 0; t.dead = true; }
}

/**
 * Stosuje efekty karty do gracza i celu lub wszystkich żywych wrogów.
 * Obrażenia poprzedzają osłabienia; funkcja nie pobiera kosztu energii.
 * @param {Object} d - Definicja karty z uwzględnieniem ulepszenia.
 * @param {Object} [target] - Wróg wybrany dla karty wymagającej celu.
 */
function resolveCard(d, target) {
  const targets = d.aoe ? aliveEnemies() : (target ? [target] : []);
  if (d.selfdmg) { G.hp -= d.selfdmg; floatAt(playerEl(), `-${d.selfdmg}`, 'dmg'); }
  if (d.energy) C.energy += d.energy;
  if (d.block) { C.block += d.block; floatAt(playerEl(), `+${d.block}`, 'blk'); }
  if (d.heal) { heal(d.heal); floatAt(playerEl(), `+${d.heal}`, 'heal'); }
  if (d.doubleBlock) { C.block *= 2; floatAt(playerEl(), `🛡️ ${C.block}`, 'blk'); }
  if (d.dmg || d.blockDmg) {
    const n = d.perOrb ? C.orbs.length : d.perMinion ? C.minions.length : (d.hits || 1);
    const base = (d.blockDmg ? C.block : d.dmg) + (d.bonusIfMinion && C.minions.length ? d.bonusIfMinion : 0) + (d.strMul ? C.st.str * (d.strMul - 1) : 0);
    for (let i = 0; i < n; i++) targets.forEach(t => {
      if (t.dead) return;
      hitEnemy(t, base + (d.vulnBonus && t.st.vuln > 0 ? d.vulnBonus : 0));
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
  if (d.focus) C.st.focus += d.focus;
  if (d.slots) C.slots += d.slots;
  if (d.loop) C.st.loop += d.loop;
  (d.channel || []).forEach(id => channelOrb(id));
  if (d.evokeAll) { while (C.orbs.length) evokeOrb(0, 1); }
  else if (d.evoke) evokeOrb(0, d.evoke);
  if (d.sacrifice) C.minions.splice(0, d.sacrifice);
  if (d.sacrificeAll) {
    const n = C.minions.length;
    C.minions = [];
    aliveEnemies().forEach(t => dealDamage(t, orbDmg(d.blast * n, t)));
  }
  if (d.healAll) C.minions.forEach(m => { m.hp = m.max; });
  else if (d.healMinions) C.minions.forEach(m => { m.hp = Math.min(m.max, m.hp + d.healMinions); });
  (d.summon || []).forEach(id => summonMinion(id));
  if (d.commandAll) C.minions.slice().forEach(m => minionAct(m));
  if (d.necro) C.st.necro += d.necro;
  if (d.spawnEach) C.spawn.push(d.spawnEach);
  if (d.draw) drawCards(d.draw);
}

/* ---------- Sługi ---------- */
function summonMinion(id) {
  if (C.minions.length >= C.minionSlots) return false;
  const def = MINIONS[id];
  C.minions.push({ id, hp: def.hp, max: def.hp });
  return true;
}

function minionAct(m) {
  const def = MINIONS[m.id], bonus = C.st.necro || 0;
  if (def.atk) { const t = randomAlive(); if (t) dealDamage(t, orbDmg(def.atk + bonus, t)); }
  if (def.block) { C.block += def.block + bonus; floatAt(playerEl(), `+${def.block + bonus}`, 'blk'); }
}

/* Wrogowie biją najpierw pierwszego sługę z lewej, nadmiar obrażeń przechodzi na gracza. */
function hitPlayer(n) {
  const m = C.minions[0];
  if (m && n > 0) {
    const ab = Math.min(m.hp, n);
    m.hp -= ab; n -= ab;
    floatAt(document.getElementById('mn-' + C.ap + '-0'), `-${ab}`, 'dmg');
    if (m.hp <= 0) C.minions.shift();
  }
  if (n > 0 || !m) damagePlayer(n);
}

/* Zwraca powód, dla którego karty nie da się teraz zagrać (poza energią), albo null. */
function cantPlay(d) {
  if (d.summon && C.minions.length >= C.minionSlots) return 'Brak miejsca na sługi';
  if ((d.sacrifice || d.sacrificeAll) && !C.minions.length) return 'Potrzebujesz sługi';
  return null;
}

function minionDesc(m) {
  const def = MINIONS[m.id], b = C.st.necro || 0, p = [];
  if (def.atk) p.push(`Na koniec tury zadaje ${def.atk + b} obrażeń losowemu wrogowi.`);
  if (def.block) p.push(`Na koniec tury daje ${def.block + b} pancerza.`);
  p.push('Wrogowie atakują sługi przed Tobą, od lewej.');
  return p.join(' ');
}

function minionsHtml() {
  if (!CHARACTERS[G.char].minions) return '';
  let out = '';
  for (let i = 0; i < C.minionSlots; i++) {
    const m = C.minions[i];
    if (!m) { out += '<span class="minion empty" title="Wolne miejsce na sługę"></span>'; continue; }
    const def = MINIONS[m.id];
    out += `<span class="minion${i === 0 ? ' front' : ''}" id="mn-${C.ap}-${i}" title="${def.name}: ${minionDesc(m)}">` +
      `${art('minions', m.id, def.icon)}<small>${m.hp}/${m.max}</small></span>`;
  }
  return `<div class="minions">${out}</div>`;
}

/* ---------- Kule ---------- */
const focusOf = () => C.st.focus || 0;
const orbDmg = (v, t) => calcDmg(v, { str: 0, weak: 0 }, t.st); // kule nie korzystają z Siły
const randomAlive = () => { const a = aliveEnemies(); return a.length ? pick(a) : null; };
const weakestAlive = () => aliveEnemies().sort((a, b) => a.hp - b.hp)[0] || null;

function orbPassiveVal(o) {
  const f = focusOf();
  if (o.id === 'blysk') return Math.max(0, 3 + f);
  if (o.id === 'szron') return Math.max(0, 2 + f);
  if (o.id === 'mrok') return Math.max(0, 6 + f);
  return 1;
}
function orbEvokeVal(o) {
  const f = focusOf();
  if (o.id === 'blysk') return Math.max(0, 8 + f);
  if (o.id === 'szron') return Math.max(0, 5 + f);
  if (o.id === 'mrok') return o.val;
  return 2;
}
function orbDesc(o) {
  const p = orbPassiveVal(o), e = orbEvokeVal(o);
  if (o.id === 'blysk') return `Na koniec tury: ${p} obrażeń losowemu wrogowi. Uwolniony: ${e}.`;
  if (o.id === 'szron') return `Na koniec tury: ${p} pancerza. Uwolniony: ${e} pancerza.`;
  if (o.id === 'mrok') return `Na koniec tury rośnie o ${p}. Uwolniony: ${e} obrażeń najsłabszemu wrogowi.`;
  return 'Na koniec tury: +1 energii w następnej turze. Uwolniona: +2 energii. Skupienie jej nie wzmacnia.';
}

function channelOrb(id) {
  if (C.slots <= 0) return;
  if (C.orbs.length >= C.slots) evokeOrb(0, 1); // pełne miejsca: najstarsza kula jest uwalniana
  C.orbs.push({ id, val: 6 });
}

function evokeOrb(i, times) {
  const o = C.orbs.splice(i, 1)[0];
  if (!o) return;
  for (let k = 0; k < times; k++) {
    const v = orbEvokeVal(o);
    if (o.id === 'blysk') { const t = randomAlive(); if (t) dealDamage(t, orbDmg(v, t)); }
    else if (o.id === 'mrok') { const t = weakestAlive(); if (t) dealDamage(t, orbDmg(v, t)); }
    else if (o.id === 'szron') { C.block += v; floatAt(playerEl(), `+${v}`, 'blk'); }
    else if (o.id === 'plazma') C.energy += 2;
  }
}

function orbPassive(o) {
  const v = orbPassiveVal(o);
  if (o.id === 'blysk') { const t = randomAlive(); if (t) dealDamage(t, orbDmg(v, t)); }
  else if (o.id === 'szron') { C.block += v; }
  else if (o.id === 'mrok') { o.val += v; }
  else if (o.id === 'plazma') { C.nextEnergy += 1; }
}

function orbsHtml() {
  if (!CHARACTERS[G.char].orbs) return '';
  let out = '';
  for (let i = 0; i < C.slots; i++) {
    const o = C.orbs[i];
    if (!o) { out += '<span class="orb empty" title="Wolne miejsce na kulę"></span>'; continue; }
    const shown = o.id === 'mrok' ? o.val : o.id === 'plazma' ? '+1' : orbPassiveVal(o);
    out += `<span class="orb" title="${ORBS[o.id].name}: ${orbDesc(o)}">${art('orbs', o.id, ORBS[o.id].icon)}<small>${shown}</small></span>`;
  }
  return `<div class="orbs">${out}</div>`;
}

function playCard(i, target) {
  if (C.phase !== 'player' || C.busy || C.over) return;
  if (C.ready) { toast('Jesteś gotowy. Cofnij gotowość, aby zagrać'); return; }
  const inst = C.hand[i];
  if (!inst) return;
  const d = cardDef(inst);
  if (d.cost > C.energy) { toast('Za mało energii'); return; }
  const why = cantPlay(d);
  if (why) { toast(why); return; }
  C.energy -= d.cost;
  C.hand.splice(i, 1);
  C.selected = null;
  resolveCard(d, target);
  if (d.type === 'attack' && hasRelic('lancuch')) { C.block += 1; floatAt(playerEl(), '+1', 'blk'); }
  if (d.type !== 'power') (d.exhaust ? C.exhaust : C.discard).push(inst);
  renderCombat();
  checkEnd();
}

function onCardClick(i) {
  if (C.phase !== 'player' || C.busy || C.over) return;
  if (C.ready) { toast('Jesteś gotowy. Cofnij gotowość, aby zagrać'); return; }
  const d = cardDef(C.hand[i]);
  if (C.selected === i) { C.selected = null; renderCombat(); return; }
  if (d.cost > C.energy) { toast('Za mało energii'); return; }
  const why = cantPlay(d);
  if (why) { toast(why); return; }
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
  if (id === 'zdrowie') { heal(15); floatAt(playerEl(), '+15', 'heal'); }
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
  const p = playerEl();
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
      hitPlayer(calcDmg(m.dmg, e.st, C.st));
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

/* Efekty końca tury jednego gracza. Zwraca true, gdy walka właśnie się skończyła. */
function endPlayerTurn() {
  if (C.st.plating) C.block += C.st.plating;
  if (hasRelic('siec')) C.block += C.hand.length;
  if (hasRelic('zagiel') && C.energy >= 2) C.block += 8;
  C.orbs.forEach((o, i) => {
    orbPassive(o);
    if (i === 0) for (let k = 0; k < (C.st.loop || 0); k++) orbPassive(o);
  });
  if (C.orbs.length) { renderCombat(); if (checkEnd()) return true; }
  if (C.minions.length) {
    C.minions.slice().forEach(m => minionAct(m));
    renderCombat();
    if (checkEnd()) return true;
  }
  if (C.st.weak > 0) C.st.weak--;
  if (C.st.vuln > 0) C.st.vuln--;
  C.discard.push(...C.hand);
  C.hand = [];
  return false;
}

/* Gotowość aktywnego gracza. Tura wrogów zaczyna się, gdy wszyscy żywi gracze są gotowi
   (w trybie solo to po prostu "Zakończ turę"). */
function toggleReady() {
  if (!C || C.phase !== 'player' || C.busy || C.over || !isAlive(C.ap)) return;
  C.ready = !C.ready;
  C.selected = null;
  if (alivePlayers().every(i => C.ps[i].ready)) { renderCombat(); endTurn(); return; }
  if (C.ready) {
    const next = alivePlayers().find(i => !C.ps[i].ready);
    if (next !== undefined) setActive(next);
  }
  renderCombat();
}

async function endTurn() {
  if (!C || C.phase !== 'player' || C.busy || C.over) return;
  C.busy = true;
  C.selected = null;
  for (const i of alivePlayers()) {
    if (withPlayer(i, endPlayerTurn)) return;
  }
  C.phase = 'enemy';
  renderCombat();
  for (const e of C.enemies) {
    if (e.dead) continue;
    await sleep(450);
    if (C.over) return;
    e.block = 0;
    if (!isAlive(e.tgt)) e.tgt = pickTarget();
    withPlayer(e.tgt, () => enemyAct(e));
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
  let saved = false;
  G.players.forEach(p => {
    if (p.hp > 0) return;
    if (p.relics.includes('pas') && !p.pasUsed) { p.pasUsed = true; p.hp = Math.min(p.max, 15); saved = true; return; }
    p.hp = 0;
  });
  if (saved) { toast('Pas ratunkowy cię uratował!'); renderCombat(); }
  if (G.players.every(p => p.hp <= 0)) {
    C.over = true;
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
  if (!isAlive(C.ap)) {
    const a = alivePlayers();
    setActive(a.find(i => !C.ps[i].ready) ?? a[0]);
    renderCombat();
  }
  if (C.phase === 'player' && !C.busy && alivePlayers().every(i => C.ps[i].ready)) setTimeout(endTurn, 0);
  return false;
}

function winCombat() {
  const kind = C.kind;
  const n = G.players.length;
  G.players.forEach((p, i) => withPlayer(i, () => {
    if (p.hp <= 0) p.hp = Math.max(1, Math.floor(p.max * 0.25));
    if (hasRelic('pierscien')) heal(6);
    if (hasRelic('lza')) { G.max += 2; G.hp += 2; }
  }));
  if (kind === 'boss') { showEnd(true); return; }
  let gold = kind === 'elite' ? rnd(25, 35) : rnd(10, 20);
  if (G.players.some(p => p.relics.includes('sakiewka'))) gold += 10;
  if (n > 1) gold = Math.round(gold * COOP.goldScale);
  G.gold += gold;
  const pc = G.players.map((p, i) => withPlayer(i, () => ({
    cards: cardChoices(3, kind === 'elite'),
    potion: Math.random() < (kind === 'elite' ? 0.6 : 0.35) + (hasRelic('mapa') ? 0.25 : 0) ? pick(Object.keys(POTIONS)) : null,
    taken: false
  })));
  let relic = null, relicFor = 0;
  if (kind === 'elite') {
    relicFor = rnd(0, n - 1);
    withPlayer(relicFor, () => { relic = randomRelic(); if (relic) gainRelic(relic); });
  }
  setActive(0);
  C = null;
  showReward({ gold, pc, relic, relicFor });
}

/* ---------- Rysowanie walki ---------- */
function hpBar(hp, max) {
  const pct = Math.max(0, Math.min(100, hp / max * 100));
  return `<div class="hpbar"><div class="fill" style="width:${pct}%"></div><span>${hp}/${max}</span></div>`;
}
/**
 * Buduje znaczniki HTML dla niezerowych statusów, w tym regeneracji.
 * @param {Object} st - Wartości statusów gracza lub wroga.
 * @returns {string} Znaczniki statusów z ikonami, wartościami i podpowiedziami.
 */
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
  add(st.focus, '🎯', 'Skupienie: wzmacnia kule Błysk, Szron i Mrok');
  add(st.loop, '♾️', 'Pętla: pierwsza kula działa dodatkowo na koniec tury');
  add(st.necro, '🩻', 'Moc nieumarłych: słudzy zadają i dają więcej');
  return out.join('');
}
function intentHtml(e) {
  const m = e.intent;
  const parts = [];
  const tgt = isAlive(e.tgt) ? e.tgt : pickTarget();
  if (m.dmg) {
    const d = withPlayer(tgt, () => calcDmg(m.dmg, e.st, C.st));
    parts.push(`⚔️ ${d}${m.hits > 1 ? `×${m.hits}` : ''}`);
  }
  if (m.block) parts.push(`🛡️ ${m.block}`);
  if (m.str) parts.push(`⬆️ ${m.str}`);
  if (m.heal) parts.push(`💚 ${m.heal}`);
  if (m.weak || m.vuln) parts.push('☠️');
  if (isCoop() && (m.dmg || m.weak || m.vuln)) parts.push(`<span class="tgt p${tgt}" title="Cel ataku: gracz ${tgt + 1}">→ ${tgt + 1}</span>`);
  return parts.join(' ');
}

function renderCombat() {
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const multi = isCoop();
  const root = h('div', 'combat');
  const arena = h('div', 'arena');

  const act = C.ap;
  const players = h('div', 'players' + (multi ? ' duo' : ''));
  G.players.forEach((pl, i) => withPlayer(i, () => {
    const ch = CHARACTERS[G.char];
    const p = h('div', `figure player${multi && i === act ? ' active' : ''}${pl.hp <= 0 ? ' dead' : ''}`);
    p.id = 'player-' + i;
    p.innerHTML = (multi ? `<div class="pnum p${i}">Gracz ${i + 1}</div>` : '') +
      `<div class="portrait">${art('characters', G.char, ch.icon)}</div><div class="name">${ch.name}</div>${hpBar(Math.max(0, G.hp), G.max)}` +
      `<div class="blk">${C.block > 0 ? '🛡️ ' + C.block : '&nbsp;'}</div><div class="chips">${chips(C.st)}</div>${orbsHtml()}${minionsHtml()}` +
      (multi && pl.hp > 0 && C.ready ? '<div class="ready">✔ Gotowy</div>' : '');
    if (multi) p.onclick = () => switchPlayer(i);
    players.append(p);
  }));

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
  arena.append(players, enemies);

  const bar = h('div', 'bar');
  if (multi) bar.append(h('div', `who p${C.ap}`, `Gracz ${C.ap + 1}: ${playerName(C.ap)}`));
  bar.append(h('div', 'energy', `${C.energy}/${C.maxEnergy}`));
  const draw = h('button', 'pile', `📚 ${C.draw.length}`);
  draw.title = 'Stos dobierania';
  draw.onclick = () => showDeck([...C.draw].sort((a, b) => CARDS[a.id].name.localeCompare(CARDS[b.id].name, 'pl')), 'Stos dobierania');
  const disc = h('button', 'pile', `🗑️ ${C.discard.length}`);
  disc.title = 'Stos odrzuconych';
  disc.onclick = () => showDeck(C.discard, 'Stos odrzuconych');
  bar.append(draw, disc, h('span', 'grow'));
  const end = h('button', 'btn primary', multi ? (C.ready ? 'Cofnij gotowość' : 'Gotowy') : 'Zakończ turę');
  end.id = 'endTurn';
  end.disabled = C.phase !== 'player' || C.busy || C.over || !isAlive(C.ap);
  end.onclick = toggleReady;
  bar.append(end);

  const hand = h('div', 'hand' + (multi && C.ready ? ' waiting' : ''));
  C.hand.forEach((inst, i) => {
    const d = cardDef(inst);
    const e = cardEl(inst);
    e.classList.add('clickable');
    if (d.cost > C.energy || cantPlay(d)) e.classList.add('unplayable');
    if (C.selected === i) e.classList.add('selected');
    e.style.setProperty('--r', `${(i - (C.hand.length - 1) / 2) * 1.6}deg`);
    e.onclick = () => onCardClick(i);
    hand.append(e);
  });

  root.append(arena, bar, hand);
  s.append(root);
}
