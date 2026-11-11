'use strict';
// =====================================================================
// 連線對戰（PeerJS / WebRTC，免伺服器）
// - 同一個房號＝同一局；先進房的人是「房主」，戰鬥只在房主的瀏覽器計算（房主權威）
// - 客戶端只送「操作」（移動方向、面向、施放），房主每秒 30 次回傳狀態快照
// - 網址加 ?local=1 會改用 BroadcastChannel，在同一台電腦開兩個分頁就能測試
// =====================================================================
const NET = { role: null, code: '', name: '', opp: null, conn: null, peer: null, ready: false, oppReady: false, oppTeam: null, map: 'star', lost: false, ping: 0, snapT: 0, pingTimer: null };
const PEER_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }
];
function netStatus(t) { if (typeof onNetStatus === 'function') onNetStatus(t); }
NET.send = o => { try { if (NET.conn && NET.conn.open) NET.conn.send(o); } catch (e) { console.warn('send', e); } };
function mkPeer(id) {
  return new Promise((res, rej) => {
    const opt = { debug: 0, config: { iceServers: PEER_ICE } };
    const p = id ? new Peer(id, opt) : new Peer(opt);
    const t = setTimeout(() => rej(Object.assign(new Error('配對服務逾時'), { type: 'timeout' })), 12000);
    p.on('open', () => { clearTimeout(t); res(p); }); p.on('error', e => { clearTimeout(t); rej(e); });
  });
}
async function netConnect(code, name) {
  netLeave(); Object.assign(NET, { code, name, lost: false, opp: null, ready: false, oppReady: false, oppTeam: null, role: null });
  if (new URLSearchParams(location.search).has('local')) return localConnect(code);
  if (!window.Peer) throw new Error('無法載入 PeerJS（請確認網路）');
  const hostId = 'marena-' + code.toLowerCase().replace(/[^a-z0-9]/g, '');
  netStatus('連線配對服務中…');
  try {
    const p = await mkPeer(hostId); NET.peer = p; NET.role = 'host'; netStatus('房間已建立，等待對手加入…');
    p.on('connection', c => { if (NET.conn && NET.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } c.on('open', () => bindConn(c)); });
    p.on('disconnected', () => { try { p.reconnect(); } catch (e) {} });
    return 'host';
  } catch (e) { if (e.type !== 'unavailable-id') throw e; }
  const p = await mkPeer(null); NET.peer = p; NET.role = 'client'; netStatus('找到房間，正在連線房主…');
  await new Promise((res, rej) => {
    const c = p.connect(hostId, { reliable: true, serialization: 'json' });
    const to = setTimeout(() => rej(new Error('連不到房主：可能是網路擋住了直連（行動網路、公司或學校網路常見），可以換 Wi-Fi 試試')), 15000);
    c.on('open', () => { clearTimeout(to); bindConn(c); res(); }); c.on('error', e => { clearTimeout(to); rej(e); });
  });
  return 'client';
}
function bindConn(c) {
  NET.conn = c; c.on('data', onNetMsg); c.on('close', () => { if (NET.conn === c) { NET.lost = true; netStatus('對手離線了'); if (typeof onNetLost === 'function') onNetLost(); } });
  onConnOpen();
}
function localConnect(code) {
  return new Promise(res => {
    const bc = new BroadcastChannel('marena-' + code); const me = Math.random().toString(36).slice(2); let decided = false;
    const conn = { open: true, peerId: null, send: o => bc.postMessage({ from: me, to: conn.peerId, d: o }), close() { conn.open = false; bc.close(); } };
    NET.bc = bc;
    bc.onmessage = ev => {
      const m = ev.data; if (m.to && m.to !== me) return;
      if (m.k === 'who' && NET.role === 'host' && !conn.peerId) { conn.peerId = m.from; bc.postMessage({ k: 'here', from: me, to: m.from }); NET.conn = conn; onConnOpen(); }
      else if (m.k === 'here' && !decided) { decided = true; NET.role = 'client'; conn.peerId = m.from; NET.conn = conn; onConnOpen(); res('client'); }
      else if (m.k === 'bye' && m.from === conn.peerId) { NET.lost = true; netStatus('對手離線了'); if (typeof onNetLost === 'function') onNetLost(); }
      else if (m.d && m.from === conn.peerId) onNetMsg(m.d);
    };
    addEventListener('beforeunload', () => bc.postMessage({ k: 'bye', from: me }));
    bc.postMessage({ k: 'who', from: me });
    setTimeout(() => { if (!decided) { decided = true; NET.role = 'host'; netStatus('房間已建立（本機測試模式），等待另一個分頁加入…'); res('host'); } }, 500);
  });
}
function onConnOpen() {
  NET.lost = false; NET.send({ t: 'hello', name: NET.name, ver: VERSION });
  clearInterval(NET.pingTimer); NET.pingTimer = setInterval(() => NET.send({ t: 'ping', ts: performance.now() }), 2000);
  netStatus('已連線！');
}
function netLeave() { clearInterval(NET.pingTimer); try { NET.conn && NET.conn.close(); } catch (e) {} try { NET.peer && NET.peer.destroy(); } catch (e) {} try { NET.bc && NET.bc.close(); } catch (e) {} NET.conn = null; NET.peer = null; NET.bc = null; NET.role = null; }
function onNetMsg(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'hello': NET.opp = { name: String(m.name || '對手').slice(0, 16) }; if (NET.role === 'host') NET.send({ t: 'cfg', map: NET.map }); if (typeof sendPick === 'function') sendPick(); if (typeof onLobbyUpdate === 'function') onLobbyUpdate(); break;
    case 'pick': NET.oppTeam = Array.isArray(m.team) ? m.team.slice(0, 3) : null; NET.oppReady = !!m.ready; if (m.defs) registerDefs(m.defs); if (typeof onLobbyUpdate === 'function') onLobbyUpdate(); break;
    case 'cfg': if (NET.role === 'client') { NET.map = m.map; if (typeof onLobbyUpdate === 'function') onLobbyUpdate(); } break;
    case 'start': if (NET.role === 'client') { if (m.defs) registerDefs(m.defs); if (typeof onNetStart === 'function') onNetStart(m); } break;
    case 'in': if (NET.role === 'host' && G && G.net === 'host') { const c = G.sides[1].ctl; c.inX = clamp(+m.x || 0, -1, 1); c.inY = clamp(+m.y || 0, -1, 1); c.aim = { x: +m.ax || 0, y: +m.ay || 0 }; } break;
    case 'act': if (NET.role === 'host' && G && G.net === 'host') applyAction(G.sides[1], m); break;
    case 's': if (NET.role === 'client' && G && G.net === 'client') applySnap(m); break;
    case 'lobby': if (typeof onNetLobby === 'function') onNetLobby(); break;
    case 'ping': NET.send({ t: 'pong', ts: m.ts }); break;
    case 'pong': NET.ping = Math.round(performance.now() - m.ts); break;
    case 'full': netStatus('房間已滿（一間房 2 人）'); break;
  }
}
// ---------- 快照 ----------
const r1 = v => Math.round((v || 0) * 10) / 10, r2 = v => Math.round((v || 0) * 100) / 100;
function monSnap(m) {
  return [r1(m.x), r1(m.y), r1(m.z), r1(m.vx), r1(m.vy), r2(m.face), m.cast ? [m.cast.id, r2(m.cast.t), r2(m.cast.total)] : 0, m.dash ? 1 : 0, m.dodge ? 1 : 0, r2(Math.max(0, m.invT)), r2(Math.max(0, m.hitFlash)),
    m.air ? 1 : 0, m.jumps, r2(m.flip), r2(m.squash), m.slam ? 1 : 0, [m.st.atk, m.st.def, m.st.spa, m.st.spd, m.st.spe, m.st.acc, m.st.eva], m.seeded === null ? -1 : m.seeded, r2(Math.max(0, m.dodgeCd)), r2(Math.max(0, m.flinchT))];
}
function buildSnap() {
  return { t: 's', tt: r2(G.t), w: G.weather ? [G.weather.type, r2(G.weather.t)] : 0, ov: G.over ? G.winner : -1,
    sd: G.sides.map(s => [s.idx, r2(s.switchCd), s.team.map(m => [m.hp, m.status || 0, m.fainted ? 1 : 0, m.moves.map(id => m.pp[id]), m.moves.map(id => r2(Math.max(0, m.cd[id]))), m.moves.map(id => r2(m.cdMax[id]))]), monSnap(s.team[s.idx])]),
    pj: G.projs.map(p => [p.id, r1(p.x), r1(p.y), r1(p.h), r1(p.vx), r1(p.vy), p.mv.id, p.owner.side, r1(p.r), r1(p.sp)]),
    zn: G.zones.map(z => [z.id, r1(z.x), r1(z.y), r1(z.R), r2(z.t), r2(z.delay), z.mv.id, z.owner.side]),
    fx: G.fx.map(f => [f.id, f.k, r1(f.x), r1(f.y), r1(f.z), r1(f.R), r2(f.t), r2(f.dur), f.color, f.type || 0, r2(f.ang), r2(f.arc), r1(f.range)]),
    ev: G.ev.splice(0) };
}
function syncObjs(list, arr, fill) { const byId = new Map(list.map(o => [o.id, o])); const out = []; for (const a of arr) { const o = byId.get(a[0]) || { trail: [] }; fill(a, o); out.push(o); } list.length = 0; list.push(...out); }
function applySnap(s) {
  G.t = s.tt; G.weather = s.w ? { type: s.w[0], t: s.w[1], max: 7.5 } : null;
  s.sd.forEach((d, i) => {
    const side = G.sides[i]; side.idx = d[0]; side.switchCd = d[1];
    d[2].forEach((t, ti) => { const m = side.team[ti]; if (!m) return; m.hp = t[0]; m.status = t[1] || null; m.fainted = !!t[2]; m.moves.forEach((id, k) => { m.pp[id] = t[3][k]; m.cd[id] = t[4][k]; m.cdMax[id] = t[5][k]; }); });
    const m = side.team[d[0]], a = d[3];
    if (m.netIdx !== d[0] + '-' + i || Math.hypot(m.x - a[0], m.y - a[1]) > 220) { m.x = a[0]; m.y = a[1]; m.z = a[2]; m.netIdx = d[0] + '-' + i; }
    Object.assign(m, { tx: a[0], ty: a[1], tz: a[2], vx: a[3], vy: a[4], face: a[5], cast: a[6] ? { id: a[6][0], t: a[6][1], total: a[6][2] } : null, dash: a[7] ? {} : null, dodge: a[8] ? {} : null, invT: a[9], air: !!a[11], jumps: a[12], flip: a[13], squash: a[14], slam: a[15] ? {} : null, seeded: a[17] < 0 ? null : a[17], dodgeCd: a[18], flinchT: a[19] });
    m.hitFlash = Math.max(m.hitFlash || 0, a[10]); const st = a[16]; Object.assign(m.st, { atk: st[0], def: st[1], spa: st[2], spd: st[3], spe: st[4], acc: st[5], eva: st[6] });
  });
  syncObjs(G.projs, s.pj, (a, o) => Object.assign(o, { id: a[0], x: a[1], y: a[2], h: a[3], vx: a[4], vy: a[5], mv: MOVES[a[6]], owner: { side: a[7] }, r: a[8], sp: a[9], color: TYPES[MOVES[a[6]].type].c }));
  syncObjs(G.zones, s.zn, (a, o) => Object.assign(o, { id: a[0], x: a[1], y: a[2], R: a[3], t: a[4], delay: a[5], mv: MOVES[a[6]], owner: { side: a[7] }, color: TYPES[MOVES[a[6]].type].c }));
  syncObjs(G.fx, s.fx, (a, o) => Object.assign(o, { id: a[0], k: a[1], x: a[2], y: a[3], z: a[4], R: a[5], t: a[6], dur: a[7], color: a[8], type: a[9] || undefined, ang: a[10], arc: a[11], range: a[12], owner: { side: 0 } }));
  for (const e of s.ev) applyEvent(e);
  if (s.ov >= 0 && !G.over) { G.over = true; G.winner = s.ov; const g0 = G; setTimeout(() => { if (G === g0 && typeof onBattleEnd === 'function') onBattleEnd(); }, 1200); }
}
function applyEvent(e) {
  switch (e[0]) {
    case 'l': log(e[1], e[2] || undefined); break;
    case 's': { const m = G.sides[e[1]] && G.sides[e[1]].team[e[2]]; if (m) say(m, e[3], e[4] || undefined, e[5] || undefined); break; }
    case 'b': burst(e[1], e[2], e[3], e[4], e[5] || undefined); break;
    case 'r': burstRing(e[1], e[2], e[3], e[4], e[5]); break;
    case 'f': G.flashes.push({ x: e[1], y: e[2], z: e[3], c: e[4], big: !!e[5] }); break;
    case 'k': G.shakeReq = Math.max(G.shakeReq || 0, e[1]); break;
  }
}
// 客戶端每幀：位置平滑、投射物外推
function clientTick(dt) {
  G.t += dt;
  for (const s of G.sides) { const m = s.team[s.idx]; if (m.tx === undefined) continue; const k = Math.min(1, dt * 14); m.x += (m.tx + (m.vx || 0) * .05 - m.x) * k; m.y += (m.ty + (m.vy || 0) * .05 - m.y) * k; m.z += (m.tz - m.z) * Math.min(1, dt * 20); m.hitFlash -= dt; m.invT -= dt; if (m.cast) m.cast.t = Math.max(0, m.cast.t - dt); }
  for (const p of G.projs) { p.x += p.vx * dt; p.y += p.vy * dt; }
  for (const z of G.zones) z.t += dt;
  for (const f of G.fx) f.t = Math.min(f.dur, f.t + dt);
  if (G.weather) G.weather.t -= dt;
  updateCosmetic(dt);
}
function netTick(dt) { if (!G || G.net !== 'host') return; NET.snapT -= dt; if (NET.snapT <= 0 || (G.over && !G.finalSent)) { NET.snapT = 1 / 30; if (G.over) G.finalSent = true; if (NET.conn && NET.conn.open) NET.send(buildSnap()); else G.ev.length = 0; } }
