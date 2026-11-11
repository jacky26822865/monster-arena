'use strict';
// =====================================================================
// 操作：LoL 模式（右鍵移動＋QWER）、WASD 模式、手機觸控、手把
// 所有動作都經過 act()：單人／房主直接套用，客戶端送給房主
// =====================================================================
const mouse = { x: W / 2, y: H / 2 }, mouseNDC = { x: 0, y: 0 };
const touchMode = !!((window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window));
let savedScheme = 'lol'; try { savedScheme = localStorage.getItem('ma_scheme') || 'lol'; } catch (e) {}
let savedStyle = 'release'; try { savedStyle = localStorage.getItem('ma_cast') || 'release'; } catch (e) {}
const INPUT = { castStyle: savedStyle, hover: false, attacking: false, scheme: savedScheme, touch: touchMode, aiming: null, moveTo: null, pending: null, keys: new Set(), rmb: false, lastAim: null, aimHold: 0, lastDir: { x: 1, y: 0 }, padActive: false, sendT: 0, touchAim: null };
const joyMove = { x: 0, y: 0, m: 0 }, padMove = { x: 0, y: 0, m: 0 }; let padPrev = [], padAim = null;
function setScheme(s) { INPUT.scheme = s; INPUT.aiming = null; INPUT.moveTo = null; try { localStorage.setItem('ma_scheme', s); } catch (e) {} }
function setCastStyle(s) { INPUT.castStyle = s; INPUT.aiming = null; try { localStorage.setItem('ma_cast', s); } catch (e) {} }
function myMon() { return G && activeOf(G.me); }
// 用「螢幕座標」判斷滑鼠是否指在對手身上（模型有高度，不能只看地面投影）
function enemyUnderCursor() {
  if (!G) return null; const m = myMon(), E = m && foeActive(m); if (!E || !E.model) return null;
  const sx = (mouseNDC.x + 1) / 2 * W, sy = (1 - mouseNDC.y) / 2 * H, top = E.model.userData.top || 60;
  for (const h of [(E.z || 0) + top * .25, (E.z || 0) + top * .6, (E.z || 0) + top * .9]) { const p = prj(E.x, h, E.y); if (Math.hypot(p.X - sx, p.Y - sy) < 42) return E; }
  return null;
}
function startAttack(once) { if (!canPlay()) return; INPUT.attacking = !once; INPUT.moveTo = null; INPUT.pending = null; act({ a: 'atk', once: !!once }); }
function stopAttack() { if (INPUT.attacking) { INPUT.attacking = false; act({ a: 'stop' }); } }
function canPlay() { return !!(G && !G.over && !G.paused && !myMon().fainted); }
function act(a) { if (!G || G.over) return; if (G.net === 'client') NET.send(Object.assign({ t: 'act' }, a)); else applyAction(G.sides[G.me], a); }
function autoAim(mv) {
  const P = myMon(), E = foeActive(P); if (!E) return { x: P.x + Math.cos(P.face) * 220, y: P.y + Math.sin(P.face) * 220 };
  let lead = 0; const d = dist(P, E);
  if (mv) { if (mv.shape === 'proj') lead = d / projSpeed(mv); else if (mv.shape === 'zone') lead = .75 + (100 - effAcc(mv)) / 100 * .6; else if (mv.shape === 'dash') lead = d / (mv.dashSpd || 950); }
  return { x: E.x + (E.vx || 0) * lead * .7, y: E.y + (E.vy || 0) * lead * .7 };
}
function castIdx(i, aim) {
  if (!canPlay()) return; const m = myMon(); const id = allPPOut(m) ? 'struggle' : m.moves[i]; const mv = MOVES[id]; const mode = castMode(mv);
  if (mode === 'unit') {
    const E = foeActive(m); if (!E) return; const range = moveRange(mv);
    if (dist(m, E) > range + E.r) { INPUT.pending = { i, until: G.t + 4 }; say(m, '靠近目標中…', '#bfeaff'); return; }
    aim = { x: E.x, y: E.y };
  }
  if (!aim) aim = autoAim(mv);
  INPUT.lastAim = aim; INPUT.aimHold = .4; INPUT.pending = null; act({ a: 'cast', i, ax: aim.x, ay: aim.y });
}
function moveDir() { const m = myMon(); if (!m) return { x: 0, y: 0 }; const l = Math.hypot(m.vx || 0, m.vy || 0); return l > 20 ? { x: m.vx / l, y: m.vy / l } : { x: 0, y: 0 }; }
function doJumpMine() { if (!canPlay()) return; const d = moveDir(); act({ a: 'jump', dx: d.x, dy: d.y }); }
function doDodgeMine(dx, dy) { if (!canPlay()) return; act({ a: 'dodge', dx, dy }); }
function doSwitchMine() { if (!canPlay()) return; act({ a: 'switch' }); }

// ---------- 鍵盤 ----------
const LOL_KEYS = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
const WASD_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
addEventListener('keydown', e => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && G) e.preventDefault();
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.code === 'KeyH') { toggleHelp(); return; }
  if (e.code === 'KeyV' && G) { setHQ(!R3.hq); return; }
  if (!G || G.over) return;
  if (e.code === 'Escape') { if (INPUT.aiming) { INPUT.aiming = null; return; } if (G.net === 'local') { G.userPause = !G.userPause; G.paused = G.userPause; } return; }
  INPUT.keys.add(e.code); if (!canPlay()) return;
  const m = myMon(), lol = INPUT.scheme === 'lol';
  const map = lol ? LOL_KEYS : WASD_KEYS;
  if (e.code in map && !e.repeat) {
    const i = map[e.code], mv = MOVES[allPPOut(m) ? 'struggle' : m.moves[i]];
    const md = castMode(mv);
    if (lol && md !== 'self' && md !== 'unit' && INPUT.castStyle !== 'quick') { if (INPUT.castStyle === 'click' && INPUT.aiming && INPUT.aiming.i === i) INPUT.aiming = null; else INPUT.aiming = { i, mv, key: e.code }; }
    else castIdx(i, md === 'self' ? { x: m.x + Math.cos(m.face) * 60, y: m.y + Math.sin(m.face) * 60 } : { x: mouse.x, y: mouse.y });
  }
  if (e.code === 'Space' && !e.repeat) doJumpMine();
  if (lol) { if (e.code === 'KeyD') doDodgeMine(mouse.x - m.x, mouse.y - m.y); if (e.code === 'KeyF') doSwitchMine(); if (e.code === 'KeyA' && !e.repeat) startAttack(false); if (e.code === 'KeyS') { stopAttack(); INPUT.moveTo = null; INPUT.pending = null; INPUT.aiming = null; } }
  else { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { const k = wasdVec(); doDodgeMine(k.x || Math.cos(m.face), k.y || Math.sin(m.face)); } if (e.code === 'Tab' || e.code === 'KeyQ') doSwitchMine(); }
});
addEventListener('keyup', e => {
  INPUT.keys.delete(e.code);
  const A = INPUT.aiming; if (A && A.key === e.code && INPUT.castStyle === 'release') { INPUT.aiming = null; castIdx(A.i, { x: mouse.x, y: mouse.y }); }
});
addEventListener('blur', () => { INPUT.keys.clear(); INPUT.aiming = null; INPUT.rmb = false; });
function wasdVec() { let x = 0, y = 0; const k = INPUT.keys; if (k.has('KeyW') || k.has('ArrowUp')) y--; if (k.has('KeyS') || k.has('ArrowDown')) y++; if (k.has('KeyA') || k.has('ArrowLeft')) x--; if (k.has('KeyD') || k.has('ArrowRight')) x++; return { x, y }; }
function arrowVec() { let x = 0, y = 0; const k = INPUT.keys; if (k.has('ArrowUp')) y--; if (k.has('ArrowDown')) y++; if (k.has('ArrowLeft')) x--; if (k.has('ArrowRight')) x++; return { x, y }; }

// ---------- 滑鼠 ----------
stage.addEventListener('mousemove', e => { const r = stage.getBoundingClientRect(); mouseNDC.x = (e.clientX - r.left) / r.width * 2 - 1; mouseNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1; if (!touchMode) INPUT.padActive = false; });
stage.addEventListener('mousedown', e => {
  if (touchMode || !canPlay()) return; updateMouseWorld();
  if (INPUT.scheme === 'lol') {
    if (e.button === 2) { if (INPUT.aiming) { INPUT.aiming = null; return; } if (enemyUnderCursor()) { startAttack(false); return; } stopAttack(); INPUT.moveTo = { x: mouse.x, y: mouse.y }; INPUT.rmb = true; INPUT.pending = null; }
    if (e.button === 0 && INPUT.aiming) { const A = INPUT.aiming; INPUT.aiming = null; castIdx(A.i, { x: mouse.x, y: mouse.y }); }
  } else { if (e.button === 0) startAttack(true); }
});
addEventListener('mouseup', e => { if (e.button === 2) INPUT.rmb = false; });
stage.addEventListener('contextmenu', e => e.preventDefault());

// ---------- 手機觸控 ----------
function sc() { return parseFloat(stage.style.getPropertyValue('--s')) || 1; }
if (touchMode) { document.body.classList.add('touch'); }
(function bindTouch() {
  const joyZone = document.getElementById('joyZone'), joyBase = document.getElementById('joyBase'), joyKnob = document.getElementById('joyKnob'), joyHint = document.getElementById('joyHint'); let joyId = null, joyC = null;
  joyZone.addEventListener('pointerdown', e => { if (joyId !== null) return; joyId = e.pointerId; try { joyZone.setPointerCapture(e.pointerId); } catch (_) {} const r = stage.getBoundingClientRect(); joyC = { x: e.clientX, y: e.clientY }; joyBase.style.left = (e.clientX - r.left) + 'px'; joyBase.style.top = (e.clientY - r.top) + 'px'; joyBase.style.display = 'block'; joyHint.style.display = 'none'; joyKnob.style.transform = ''; e.preventDefault(); });
  joyZone.addEventListener('pointermove', e => { if (e.pointerId !== joyId) return; const R = 95 * sc(); let dx = e.clientX - joyC.x, dy = e.clientY - joyC.y; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } joyKnob.style.transform = `translate(${dx}px,${dy}px)`; joyMove.x = dx / R; joyMove.y = dy / R; joyMove.m = Math.hypot(joyMove.x, joyMove.y); e.preventDefault(); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joyMove.x = joyMove.y = joyMove.m = 0; joyBase.style.display = 'none'; };
  joyZone.addEventListener('pointerup', joyEnd); joyZone.addEventListener('pointercancel', joyEnd);
  function bindBtn(el, opt) {
    let pid = null, c = null, aiming = false;
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (pid !== null) return; pid = e.pointerId; try { el.setPointerCapture(pid); } catch (_) {} c = { x: e.clientX, y: e.clientY }; aiming = false; el.classList.add('active'); if (opt.tap) opt.tap(); });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== pid || opt.aim === undefined || !canPlay()) return; const dx = e.clientX - c.x, dy = e.clientY - c.y, l = Math.hypot(dx, dy);
      if (l > 14 * sc() + 6) { aiming = true; const m = myMon(), mv = MOVES[m.moves[opt.aim]]; const range = moveRange(mv) || 300; const k = castMode(mv) === 'point' ? Math.max(.25, Math.min(1, l / (160 * sc()))) * range : range * .9; INPUT.touchAim = { x: m.x + dx / l * k, y: m.y + dy / l * k }; INPUT.aiming = { i: opt.aim, mv }; }
    });
    el.addEventListener('pointerup', e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('active'); if (opt.aim !== undefined) { const a = aiming ? INPUT.touchAim : null; INPUT.touchAim = null; INPUT.aiming = null; castIdx(opt.aim, a); } aiming = false; });
    el.addEventListener('pointercancel', e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('active'); INPUT.touchAim = null; INPUT.aiming = null; aiming = false; });
  }
  [0, 1, 2, 3].forEach(i => bindBtn(document.getElementById('tb' + i), { aim: i }));
  bindBtn(document.getElementById('tbJump'), { tap: () => { if (canPlay()) act({ a: 'jump', dx: joyMove.x, dy: joyMove.y }); } });
  bindBtn(document.getElementById('tbDodge'), { tap: () => { const m = myMon(); if (m) doDodgeMine(joyMove.x || Math.cos(m.face), joyMove.y || Math.sin(m.face)); } });
  bindBtn(document.getElementById('tbSwitch'), { tap: doSwitchMine });
  bindBtn(document.getElementById('tbAtk'), { tap: () => startAttack(false) });
  bindBtn(document.getElementById('tbPause'), { tap: () => { if (G && !G.over && G.net === 'local') { G.userPause = !G.userPause; G.paused = G.userPause; } } });
})();
const tbCache = {};
function updateTouchUI() {
  if (!touchMode || !G) return; const s = G.sides[G.me], m = s.team[s.idx];
  [0, 1, 2, 3].forEach(i => { const el = document.getElementById('tb' + i), id = m.moves[i], mv = MOVES[id], key = id + m.pp[id];
    if (tbCache[i] !== key) { tbCache[i] = key; el.querySelector('.lb').innerHTML = `${mv.name}<br><small>${CAST_LABEL[castMode(mv)]}・PP ${m.pp[id]}</small>`; el.style.borderColor = TYPES[mv.type].c; }
    const f = m.cd[id] > 0 ? m.cd[id] / (m.cdMax[id] || 1) : 0; el.querySelector('.cd').style.background = f > 0 ? `conic-gradient(rgba(0,0,0,.62) ${f * 360}deg, transparent 0)` : 'none'; el.classList.toggle('off', m.pp[id] <= 0); });
  const dg = document.getElementById('tbDodge'), f2 = m.dodgeCd > 0 ? m.dodgeCd / 1.4 : 0; dg.querySelector('.cd').style.background = f2 > 0 ? `conic-gradient(rgba(0,0,0,.62) ${f2 * 360}deg, transparent 0)` : 'none';
  const sw = document.getElementById('tbSwitch'), f3 = s.switchCd / 4; sw.querySelector('.cd').style.background = f3 > 0 ? `conic-gradient(rgba(0,0,0,.62) ${f3 * 360}deg, transparent 0)` : 'none';
  document.getElementById('tbJump').classList.toggle('off', (m.jumps || 0) >= 2);
}

// ---------- 手把 ----------
function pollPad() {
  let pad = null; try { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.connected) { pad = p; break; } } catch (_) {}
  padMove.x = padMove.y = padMove.m = 0; padAim = null; if (!pad) return;
  const dz = v => Math.abs(v) < .18 ? 0 : v; const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
  const pr = pad.buttons.map(b => !!(b && (b.pressed || b.value > .5)));
  if (lx || ly || rx || ry || pr.some(x => x)) INPUT.padActive = true;
  padMove.x = lx; padMove.y = ly; padMove.m = Math.min(1, Math.hypot(lx, ly));
  const edge = i => pr[i] && !padPrev[i];
  if (!G) { if ((edge(9) || edge(0)) && typeof onPadStart === 'function') onPadStart(); padPrev = pr; return; }
  const P = myMon(); if (Math.hypot(rx, ry) > .35) { const l = Math.hypot(rx, ry); padAim = { x: P.x + rx / l * 340, y: P.y + ry / l * 340 }; }
  if (edge(9)) { if (G.over) { if (typeof onPadStart === 'function') onPadStart(); } else if (G.net === 'local') { G.userPause = !G.userPause; G.paused = G.userPause; } }
  if (canPlay()) { if (edge(0)) act({ a: 'jump', dx: padMove.x, dy: padMove.y }); if (edge(1)) doDodgeMine(padMove.x || Math.cos(P.face), padMove.y || Math.sin(P.face));
    for (const [b, i] of [[2, 0], [3, 1], [4, 2], [5, 3], [6, 2]]) if (edge(b)) castIdx(i, padAim); if (edge(7)) startAttack(false); if (edge(8)) doSwitchMine(); }
  padPrev = pr;
}

// ---------- 每一幀：計算移動與面向，交給引擎或送給房主 ----------
function updateInput(dt) {
  pollPad(); if (!G) return;
  const m = myMon(); INPUT.aimHold -= dt;
  if (!(touchMode || INPUT.padActive)) updateMouseWorld();
  let mx = 0, my = 0, manual = false;
  if (joyMove.m > .12) { const k = Math.min(1, joyMove.m * 1.15) / joyMove.m; mx = joyMove.x * k; my = joyMove.y * k; manual = true; }
  else if (padMove.m > .12) { mx = padMove.x; my = padMove.y; manual = true; }
  else if (INPUT.scheme === 'wasd') { const k = wasdVec(); if (k.x || k.y) { const l = Math.hypot(k.x, k.y); mx = k.x / l; my = k.y / l; manual = true; } }
  else { const k = arrowVec(); if (k.x || k.y) { const l = Math.hypot(k.x, k.y); mx = k.x / l; my = k.y / l; manual = true; } }
  if (manual) { INPUT.moveTo = null; INPUT.pending = null; stopAttack(); }
  INPUT.hover = !touchMode && !INPUT.padActive && !!enemyUnderCursor();
  if (INPUT.attacking && (!foeActive(m) || m.fainted)) INPUT.attacking = false;
  if (INPUT.rmb && INPUT.scheme === 'lol' && !touchMode) INPUT.moveTo = { x: mouse.x, y: mouse.y };
  if (INPUT.pending && !m.fainted) {
    const E = foeActive(m), mv = MOVES[m.moves[INPUT.pending.i]];
    if (!E || G.t > INPUT.pending.until) INPUT.pending = null;
    else if (dist(m, E) <= moveRange(mv) + E.r - 6) { const i = INPUT.pending.i; INPUT.pending = null; INPUT.moveTo = null; castIdx(i); }
    else INPUT.moveTo = { x: E.x, y: E.y };
  }
  if (!manual && INPUT.moveTo && !m.fainted) { const dx = INPUT.moveTo.x - m.x, dy = INPUT.moveTo.y - m.y, l = Math.hypot(dx, dy); if (l < 12) INPUT.moveTo = null; else { mx = dx / l; my = dy / l; } }
  if (mx || my) INPUT.lastDir = { x: mx, y: my };
  // 面向
  let aim;
  if (touchMode || INPUT.padActive) { aim = INPUT.touchAim || padAim || (INPUT.aimHold > 0 && INPUT.lastAim) || autoAim(null); if (touchMode || INPUT.padActive) { mouse.x = aim.x; mouse.y = aim.y; } }
  else if (INPUT.scheme === 'lol') aim = (INPUT.aiming || m.cast || INPUT.aimHold > 0) ? (INPUT.aimHold > 0 && !INPUT.aiming ? INPUT.lastAim : { x: mouse.x, y: mouse.y }) : { x: m.x + INPUT.lastDir.x * 200, y: m.y + INPUT.lastDir.y * 200 };
  else aim = { x: mouse.x, y: mouse.y };
  const ctl = { inX: mx, inY: my, aim };
  if (G.net === 'client') { INPUT.sendT -= dt; if (INPUT.sendT <= 0) { INPUT.sendT = 1 / 30; NET.send({ t: 'in', x: +mx.toFixed(3), y: +my.toFixed(3), ax: aim.x | 0, ay: aim.y | 0 }); } G.sides[G.me].ctl = ctl; }
  else G.sides[G.me].ctl = ctl;
}
