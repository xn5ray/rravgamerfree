'use strict';

/* ---------- Online P2P (WebRTC, bez serwera) ----------
   Połączenie nawiązuje się przez wymianę dwóch kodów (kopiuj/wklej): host tworzy kod zaproszenia,
   gość odsyła kod odpowiedzi. Dalej dane idą wprost między przeglądarkami (DataChannel).

   Obie strony liczą całą grę samodzielnie: mają ten sam seed losowania i wykonują te same akcje
   (act() w core.js) w tej samej kolejności. Host nadaje akcjom numery i rozsyła je obu stronom.
   Po każdej akcji strony porównują skrót stanu, więc rozjazd jest od razu widoczny. */

const NET_ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let LOBBY = null;

/* ----- kody połączenia ----- */
const toB64 = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
const fromB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
async function runStream(bytes, stream) {
  const w = stream.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
async function encodeSignal(desc) {
  const raw = new TextEncoder().encode(JSON.stringify({ t: desc.type, s: desc.sdp }));
  if (typeof CompressionStream === 'function') return 'L1.' + toB64(await runStream(raw, new CompressionStream('deflate-raw')));
  return 'L0.' + toB64(raw);
}
async function decodeSignal(code) {
  const c = String(code).replace(/\s+/g, '');
  const kind = c.slice(0, 3), body = fromB64(c.slice(3));
  let raw;
  if (kind === 'L1.') raw = await runStream(body, new DecompressionStream('deflate-raw'));
  else if (kind === 'L0.') raw = body;
  else throw new Error('zły kod');
  const o = JSON.parse(new TextDecoder().decode(raw));
  return { type: o.t, sdp: o.s };
}
function waitIce(pc, ms = 4000) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') { res(); return; }
    const done = () => { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', chk); res(); };
    const chk = () => { if (pc.iceGatheringState === 'complete') done(); };
    const t = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', chk);
  });
}

/* ----- sesja ----- */
function netClose() {
  if (NET) clearInterval(NET.timer);
  if (LOBBY) {
    const { pc, dc } = LOBBY;
    if (dc) { dc.onclose = dc.onmessage = dc.onopen = null; try { dc.close(); } catch (e) { /* już zamknięte */ } }
    if (pc) { pc.onconnectionstatechange = pc.ondatachannel = null; try { pc.close(); } catch (e) { /* już zamknięte */ } }
  }
  NET = null;
  LOBBY = null;
  rand = Math.random;
}

function netSend(msg) {
  const dc = LOBBY && LOBBY.dc;
  if (dc && dc.readyState === 'open') dc.send(JSON.stringify(msg));
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

function wireChannel(dc) {
  LOBBY.dc = dc;
  dc.onopen = () => lobbyConnected();
  dc.onclose = () => netLost();
  dc.onmessage = e => { try { netMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
}

function newPeer(host) {
  netClose();
  const pc = new RTCPeerConnection(NET_ICE);
  LOBBY = { host, pc, dc: null, mine: null, theirs: null, started: false, lost: false };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') netLost(); };
  return pc;
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

function codeArea(id, readOnly, value = '') {
  const t = h('textarea', 'codebox');
  t.id = id;
  t.readOnly = readOnly;
  t.value = value;
  t.spellcheck = false;
  if (readOnly) t.onclick = () => t.select();
  return t;
}
function copyBtn(area) {
  const b = h('button', 'btn small', 'Kopiuj kod');
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(area.value); toast('Skopiowano'); } catch (e) { area.select(); toast('Zaznaczono kod, skopiuj go ręcznie (Ctrl+C)'); }
  };
  return b;
}

function showLobby() {
  netClose();
  G = null; C = null;
  lobbyScreen('Gra online (P2P)', box => {
    box.append(h('p', 'lead', 'Dwóch graczy, każdy na swoim urządzeniu. Łączycie się bez serwera, wymieniając dwa kody (np. przez komunikator). Jedno z was jest hostem, drugie dołącza.'));
    const row = h('div', 'choices');
    const hb = h('button', 'btn primary', 'Hostuję grę');
    hb.id = 'hostBtn';
    hb.onclick = hostScreen;
    const jb = h('button', 'btn', 'Dołączam do gry');
    jb.id = 'joinBtn';
    jb.onclick = joinScreen;
    row.append(hb, jb);
    box.append(row);
  });
}

async function hostScreen() {
  lobbyScreen('Host: zaproszenie', box => box.append(h('p', 'lead', 'Tworzę zaproszenie…')));
  let pc;
  try {
    pc = newPeer(true);
    wireChannel(pc.createDataChannel('game'));
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
  } catch (e) { lobbyScreen('Błąd', b => b.append(h('p', 'lead', 'Ta przeglądarka nie obsługuje połączeń P2P (WebRTC).'))); return; }
  const code = await encodeSignal(pc.localDescription);
  lobbyScreen('Host: zaproszenie', box => {
    box.append(h('p', 'lead', '1. Wyślij ten kod znajomemu. 2. Wklej poniżej kod odpowiedzi, który ci odeśle.'));
    const mine = codeArea('hostCode', true, code);
    box.append(mine, copyBtn(mine));
    const reply = codeArea('hostReply', false);
    reply.placeholder = 'Tu wklej kod odpowiedzi';
    const go = h('button', 'btn primary', 'Połącz');
    go.id = 'hostConnect';
    go.onclick = async () => {
      try { await pc.setRemoteDescription(await decodeSignal(reply.value)); go.disabled = true; go.textContent = 'Łączenie…'; }
      catch (e) { toast('Nieprawidłowy kod odpowiedzi'); }
    };
    box.append(reply, go);
  });
}

function joinScreen() {
  lobbyScreen('Dołączanie do gry', box => {
    box.append(h('p', 'lead', 'Wklej kod zaproszenia od hosta.'));
    const inp = codeArea('joinCode', false);
    inp.placeholder = 'Tu wklej kod zaproszenia';
    const go = h('button', 'btn primary', 'Dalej');
    go.id = 'joinNext';
    go.onclick = async () => {
      go.disabled = true;
      try {
        const offer = await decodeSignal(inp.value);
        const pc = newPeer(false);
        pc.ondatachannel = e => wireChannel(e.channel);
        await pc.setRemoteDescription(offer);
        await pc.setLocalDescription(await pc.createAnswer());
        await waitIce(pc);
        const code = await encodeSignal(pc.localDescription);
        lobbyScreen('Dołączanie do gry', b => {
          b.append(h('p', 'lead', 'Odeślij ten kod hostowi i poczekaj na połączenie.'));
          const mine = codeArea('joinReply', true, code);
          b.append(mine, copyBtn(mine), h('p', 'lead', 'Czekam na połączenie…'));
        });
      } catch (e) { go.disabled = false; toast('Nieprawidłowy kod zaproszenia'); }
    };
    box.append(inp, go);
  });
}

function lobbyConnected() {
  if (!LOBBY || LOBBY.started) return;
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
    G.gold, G.screen, G.node ? [G.node.f, G.node.j, G.node.rest, G.node.evResult] : 0,
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
