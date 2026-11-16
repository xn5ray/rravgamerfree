'use strict';

/* ---------- Online (Firebase Realtime Database, 2 graczy) ----------
   Host tworzy pokój i dostaje krótki kod (np. K7M2Q), gość wpisuje ten kod. Wiadomości między
   graczami idą przez Firebase (lista rooms/KOD/msgs), a obecność obu stron śledzi rooms/KOD/p.

   Obie strony liczą całą grę samodzielnie: mają ten sam seed losowania i wykonują te same akcje
   (act() w core.js) w tej samej kolejności. Host nadaje akcjom numery i rozsyła je obu stronom.
   Po każdej akcji strony porównują skrót stanu, więc rozjazd jest od razu widoczny.
   Protokół (netMessage, netApply, netHash...) jest ten sam co wcześniej w wersji P2P, zmienił się
   tylko transport: zamiast DataChannel wiadomości lecą przez bazę. */

let LOBBY = null;
let FB = null;

const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez 0/O, 1/I/L
const roomCode = () => Array.from({ length: 5 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join('');
const cleanCode = t => String(t).toUpperCase().replace(/[^A-Z0-9]/g, '');
const withTimeout = (p, ms = 12000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/* ----- Firebase ----- */
async function fbReady() {
  if (typeof firebase === 'undefined') throw new Error('Nie załadowano Firebase SDK (sprawdź połączenie z internetem).');
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || !cfg.databaseURL || /WKLEJ/i.test(cfg.apiKey + cfg.databaseURL)) {
    throw new Error('Uzupełnij firebase-config.js (patrz README).');
  }
  if (!FB) {
    firebase.initializeApp(cfg);
    FB = { db: firebase.database(), auth: firebase.auth() };
  }
  if (!FB.auth.currentUser) await withTimeout(FB.auth.signInAnonymously());
  return FB;
}

/* ----- sesja ----- */
function netClose() {
  if (NET) clearInterval(NET.timer);
  const L = LOBBY;
  NET = null;
  LOBBY = null;
  rand = Math.random;
  if (!L || !L.room) return;
  try {
    if (L.msgs) L.msgs.off();
    if (L.pres) L.pres.off();
    L.room.onDisconnect().cancel();
    L.room.child('p/' + L.me).onDisconnect().cancel();
    if (L.host) L.room.remove();            // host sprząta pokój
    else L.room.child('p/1').set(false);    // gość tylko zgłasza wyjście
  } catch (e) { /* sieć już padła, serwer posprząta przez onDisconnect */ }
}

function netSend(msg) {
  if (!LOBBY || !LOBBY.msgs || LOBBY.lost) return;
  LOBBY.msgs.push({ from: LOBBY.me, m: JSON.stringify(msg) }).catch(e => { console.error(e); netLost(); });
}

function netLost() {
  if (!LOBBY || LOBBY.lost) return;
  LOBBY.lost = true;
  if (NET) clearInterval(NET.timer);
  const box = h('div', 'center');
  box.append(h('p', 'lead', 'Połączenie z partnerem zostało przerwane.'));
  const b = h('button', 'btn primary', 'Wróć do menu');
  b.onclick = () => { closeModal(); showMenu(); };
  box.append(b);
  openModal('Rozłączono', box, false);
}

/* Podpina nasłuch wiadomości i obecności drugiej strony. */
function wireRoom(L) {
  L.msgs = L.room.child('msgs');
  // child_added odtwarza też wiadomości wysłane przed podpięciem, więc nic nie ginie
  L.msgs.on('child_added', snap => {
    const v = snap.val();
    if (LOBBY !== L || !v || v.from === L.me) return;
    try { netMessage(JSON.parse(v.m)); } catch (err) { console.error(err); }
  });
  L.pres = L.room.child('p/' + (1 - L.me));
  L.pres.on('value', snap => {
    if (LOBBY !== L) return;
    if (snap.val() === true) { L.seen = true; if (L.host) lobbyConnected(); }
    else if (L.seen) netLost();
  });
  // własna obecność; po zerwaniu połączenia serwer sam ją zdejmie
  const mine = L.room.child('p/' + L.me);
  mine.onDisconnect().set(false);
  if (L.host) L.room.onDisconnect().remove();
}

/* ----- ekrany lobby ----- */
function lobbyScreen(title, build) {
  closeModal();
  renderHud();
  const s = screen();
  s.innerHTML = '';
  const box = h('div', 'center');
  box.append(h('h2', '', title));
  build(box);
  const back = h('button', 'btn', 'Wstecz');
  back.id = 'lobbyBack';
  back.onclick = showMenu;
  box.append(back);
  s.append(box);
}

const lobbyError = (title, msg) => lobbyScreen(title, b => b.append(h('p', 'lead', msg)));
const errText = e => (e && e.message && !/^(timeout|Firebase)/i.test(e.message) ? e.message : 'Nie udało się połączyć z Firebase. Sprawdź internet i konfigurację.');

function showLobby() {
  netClose();
  G = null; C = null;
  lobbyScreen('Gra online (2 graczy)', box => {
    box.append(h('p', 'lead', 'Dwóch graczy, każdy na swoim urządzeniu. Jedno z was zakłada pokój i dostaje krótki kod, drugie wpisuje ten kod i dołącza.'));
    const row = h('div', 'choices');
    const hb = h('button', 'btn primary', 'Zakładam pokój');
    hb.id = 'hostBtn';
    hb.onclick = hostScreen;
    const jb = h('button', 'btn', 'Dołączam do pokoju');
    jb.id = 'joinBtn';
    jb.onclick = joinScreen;
    row.append(hb, jb);
    box.append(row);
  });
}

async function hostScreen() {
  lobbyScreen('Zakładam pokój', box => box.append(h('p', 'lead', 'Tworzę pokój…')));
  let code = null, L = null;
  try {
    const fb = await fbReady();
    for (let i = 0; i < 6 && !code; i++) {
      const c = roomCode();
      const res = await withTimeout(fb.db.ref('rooms/' + c + '/p/0').transaction(cur => (cur === null ? true : undefined)));
      if (res.committed) code = c;
    }
    if (!code) throw new Error('Nie udało się utworzyć pokoju, spróbuj ponownie.');
    netClose();
    L = LOBBY = { host: true, me: 0, code, room: fb.db.ref('rooms/' + code), msgs: null, pres: null, mine: null, theirs: null, started: false, connected: false, lost: false, seen: false };
    wireRoom(L);
  } catch (e) { lobbyError('Błąd', errText(e)); return; }
  lobbyScreen('Pokój utworzony', box => {
    box.append(h('p', 'lead', 'Podaj ten kod znajomemu. Gra ruszy, gdy dołączy.'));
    const big = h('div', 'emoji-big', code);
    big.id = 'roomCode';
    big.style.letterSpacing = '.2em';
    box.append(big);
    const cp = h('button', 'btn small', 'Kopiuj kod');
    cp.onclick = async () => {
      try { await navigator.clipboard.writeText(code); toast('Skopiowano'); } catch (e) { toast('Przepisz kod ręcznie: ' + code); }
    };
    box.append(cp, h('p', 'lead', 'Czekam na drugiego gracza…'));
  });
}

function joinScreen() {
  lobbyScreen('Dołączanie do pokoju', box => {
    box.append(h('p', 'lead', 'Wpisz kod pokoju od hosta.'));
    const inp = h('input', 'codebox');
    inp.id = 'joinCode';
    inp.maxLength = 8;
    inp.placeholder = 'KOD';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.style.cssText = 'height:auto;text-align:center;text-transform:uppercase;font:700 28px/1.4 monospace;letter-spacing:.2em;width:min(70vw,260px)';
    const go = h('button', 'btn primary', 'Dołącz');
    go.id = 'joinNext';
    const run = async () => {
      const code = cleanCode(inp.value);
      if (code.length < 4) { toast('Wpisz kod pokoju'); return; }
      go.disabled = true;
      go.textContent = 'Łączenie…';
      try {
        const fb = await fbReady();
        const room = fb.db.ref('rooms/' + code);
        const host = await withTimeout(room.child('p/0').once('value'));
        if (host.val() !== true) throw new Error('Nie ma takiego pokoju.');
        const res = await withTimeout(room.child('p/1').transaction(cur => (cur === null ? true : undefined)));
        if (!res.committed) throw new Error('Ten pokój jest już zajęty.');
        netClose();
        const L = LOBBY = { host: false, me: 1, code, room, msgs: null, pres: null, mine: null, theirs: null, started: false, connected: false, lost: false, seen: true };
        wireRoom(L);
        lobbyConnected();
      } catch (e) {
        go.disabled = false;
        go.textContent = 'Dołącz';
        toast(errText(e));
      }
    };
    go.onclick = run;
    inp.onkeydown = e => { if (e.key === 'Enter') run(); };
    box.append(inp, go);
  });
}

function lobbyConnected() {
  if (!LOBBY || LOBBY.started || LOBBY.connected) return;
  LOBBY.connected = true;
  showCharSelect(1, [], id => {
    LOBBY.mine = id;
    netSend({ t: 'pick', char: id });
    lobbyScreen('Połączono', box => box.append(h('p', 'lead', 'Czekam, aż partner wybierze postać…')));
    hostMaybeStart();
  });
}

function hostMaybeStart() {
  if (!LOBBY || !LOBBY.host || LOBBY.started || !LOBBY.mine || !LOBBY.theirs) return;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const chars = [LOBBY.mine, LOBBY.theirs];
  netSend({ t: 'start', seed, chars });
  beginOnline(seed, chars);
}

function beginOnline(seed, chars) {
  LOBBY.started = true;
  NET = {
    me: LOBBY.host ? 0 : 1, host: LOBBY.host, seq: 0, queue: [], pending: 0, lock: false, applyP: null,
    mine: {}, theirs: {}, desync: false, submit: netSubmit,
    timer: setInterval(netPump, 50)
  };
  seedRng(seed);
  startRun(chars);
}

/* ----- akcje ----- */
const netIdle = () => NET.pending === 0 && !(C && (C.busy || C.over));

function netSubmit(n, a) {
  if (NET.lock || !netIdle() || NET.desync) return;
  NET.lock = true;
  if (NET.host) netSequence({ p: 0, n, a });
  else netSend({ t: 'req', n, a });
}

function netSequence(it) {
  it.seq = ++NET.seq;
  netSend({ t: 'in', seq: it.seq, p: it.p, n: it.n, a: it.a });
  NET.queue.push(it);
  netPump();
}

function netMessage(m) {
  if (m.t === 'pick') { if (LOBBY) { LOBBY.theirs = m.char; hostMaybeStart(); } return; }
  if (m.t === 'start') { if (LOBBY && !LOBBY.host && !LOBBY.started && LOBBY.mine) beginOnline(m.seed, m.chars); return; }
  if (!NET) return;
  if (m.t === 'req' && NET.host) netSequence({ p: 1, n: m.n, a: m.a });
  else if (m.t === 'in' && !NET.host) { NET.queue.push({ seq: m.seq, p: m.p, n: m.n, a: m.a }); netPump(); }
  else if (m.t === 'hash') { NET.theirs[m.seq] = m.h; netCompare(m.seq); }
}

function netPump() {
  if (!NET || NET.pumping || NET.desync) return;
  NET.pumping = true;
  try {
    while (NET && NET.queue.length && netIdle()) netApply(NET.queue.shift());
  } finally { if (NET) NET.pumping = false; }
}

function netApply(it) {
  const remote = it.p !== NET.me;
  const combat = C, sel = C ? C.selected : null;
  NET.applyP = it.p;
  try { runAction(it.p, it.n, it.a); } catch (e) { console.error(e); }
  NET.applyP = null;
  if (remote && C && C === combat && !C.over) C.selected = sel; // cudza akcja nie anuluje mojego celowania
  if (!remote) NET.lock = false;
  const hv = netHash();
  NET.mine[it.seq] = hv;
  netSend({ t: 'hash', seq: it.seq, h: hv });
  netCompare(it.seq);
}

/* ----- kontrola zgodności ----- */
function netHash() {
  const s = JSON.stringify([
    G.gold, G.act, G.screen, G.node ? [G.node.f, G.node.j, G.node.rest, G.node.evResult] : 0,
    G.players.map(p => [p.char, p.hp, p.max, p.deck, p.relics, p.potions]),
    C ? [C.turn, C.phase, C.enemies.map(e => [e.hp, e.block, e.st, e.dead, e.tgt]),
      C.ps.map(q => [q.hand, q.draw.length, q.discard.length, q.energy, q.block, q.ready, q.st, q.orbs, q.minions])] : 0
  ]);
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
  return x;
}

function netCompare(seq) {
  if (!NET || NET.desync || !(seq in NET.mine) || !(seq in NET.theirs)) return;
  const ok = NET.mine[seq] === NET.theirs[seq];
  delete NET.mine[seq];
  delete NET.theirs[seq];
  if (ok) return;
  NET.desync = true;
  clearInterval(NET.timer);
  const box = h('div', 'center');
  box.append(h('p', 'lead', 'Stan gry u was dwojga przestał się zgadzać. Kontynuowanie nie ma sensu, zacznijcie nową grę.'));
  const b = h('button', 'btn primary', 'Wróć do menu');
  b.onclick = () => { closeModal(); showMenu(); };
  box.append(b);
  openModal('Desynchronizacja', box, false);
}
