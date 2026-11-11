'use strict';
// =====================================================================
// 電腦對手 AI
// =====================================================================
function aiUpdate(m, dt) {
  const side = G.sides[m.side], ai = side.ai, D = DIFF[G.diff] || DIFF.normal, t = foeActive(m);
  if (!t) { m.inX = m.inY = 0; return; }
  ai.thinkT -= dt; ai.strafeT -= dt;
  if (ai.strafeT <= 0) { ai.strafe = Math.random() < .5 ? 1 : -1; ai.strafeT = 1.2 + Math.random() * 2; }
  const d = Math.max(1, dist(m, t)); const rx = (t.x - m.x) / d, ry = (t.y - m.y) / d;
  const pref = m.pref || 250; const radial = d > pref + 40 ? 1 : d < pref - 40 ? -1 : 0;
  let mx = rx * radial - ry * ai.strafe * .8, my = ry * radial + rx * ai.strafe * .8;
  for (const z of G.zones) if (z.owner.side !== m.side) { const zd = Math.hypot(m.x - z.x, m.y - z.y) || 1; if (zd < z.R + m.r + 20) { mx += (m.x - z.x) / zd * 2.5; my += (m.y - z.y) / zd * 2.5; } }
  for (const f of G.fx) if (f.k === 'ring' && f.owner.side !== m.side) { const zd = Math.hypot(m.x - f.x, m.y - f.y) || 1; mx += (m.x - f.x) / zd * 2; my += (m.y - f.y) / zd * 2; }
  if (MAP.lava && !m.types.includes('FIRE')) for (const l of MAP.lava) { const zd = Math.hypot(m.x - l.x, m.y - l.y) || 1; if (zd < l.r + m.r + 40) { mx += (m.x - l.x) / zd * 2.2; my += (m.y - l.y) / zd * 2.2; } }
  const DJ = D;
  for (const f of G.fx) if (f.k === 'ring' && f.owner.side !== m.side && !m.air) {
    const dd = Math.hypot(m.x - f.x, m.y - f.y), cur = f.R * f.t / f.dur;
    if (dd > cur && dd - cur < 150 && dd < f.R + m.r) { f.ai = f.ai || new Set(); if (!f.ai.has(m)) { f.ai.add(m); if (Math.random() < DJ.dodge + .15) doJump(m, mx, my); } }
  }
  if (!m.air && Math.random() < dt * .22) doJump(m, mx, my);
  if (m.air && m.jumps === 1 && m.vz < 0 && Math.random() < dt * 1.2) doJump(m, mx, my);
  const mg = MAP.void ? 160 : 90;
  if (m.x < AR.x0 + mg) mx += MAP.void ? 3 : 1.2; if (m.x > AR.x1 - mg) mx -= MAP.void ? 3 : 1.2;
  if (m.y < AR.y0 + mg) my += MAP.void ? 3 : 1.2; if (m.y > AR.y1 - mg) my -= MAP.void ? 3 : 1.2;
  for (const p of PILLARS) { const pd = Math.hypot(m.x - p.x, m.y - p.y) || 1; if (pd < p.r + m.r + 30) { mx += (m.x - p.x) / pd * .9; my += (m.y - p.y) / pd * .9; } }
  const l = Math.hypot(mx, my); m.inX = l > .05 ? mx / l : 0; m.inY = l > .05 ? my / l : 0;
  if (!m.dash) m.face = Math.atan2(t.y - m.y, t.x - m.x);
  for (const p of G.projs) {
    if (p.owner.side === m.side || p.dead) continue; p.seen = p.seen || new Set(); if (p.seen.has(m)) continue;
    const px = m.x - p.x, py = m.y - p.y, pd = Math.hypot(px, py);
    if (pd < 190 && (p.vx * px + p.vy * py) / (p.sp * pd) > .85) { p.seen.add(m); if (Math.random() < D.dodge) { const s = Math.random() < .5 ? 1 : -1; ai.dq = { t: D.react * .5, dx: -p.vy / p.sp * s, dy: p.vx / p.sp * s, jump: Math.random() < .45 }; } }
  }
  if (ai.dq) { ai.dq.t -= dt; if (ai.dq.t <= 0) { if (ai.dq.jump) doJump(m, ai.dq.dx, ai.dq.dy); else doDodge(m, ai.dq.dx, ai.dq.dy); ai.dq = null; } }
  if (ai.thinkT <= 0) { ai.thinkT = D.think * (.7 + Math.random() * .6); aiChoose(m, t, d); }
}
function aiChoose(m, t, d) {
  if (!canAct(m) || m.gcd > 0) return;
  if (allPPOut(m)) { if (d < 120) tryCast(m, 'struggle', { x: t.x, y: t.y }); return; }
  let best = null;
  for (const id of m.moves) {
    if (m.cd[id] > 0 || m.pp[id] <= 0) continue; const mv = MOVES[id]; let s = 0;
    if (mv.power > 0) {
      if (effOn(mv, t) === 0 || (t.ability === '蓄電' && mv.type === 'ELECTRIC')) continue;
      const est = calcDamage(m, t, mv, true).dmg; s = Math.min(1.2, est / Math.max(1, t.hp)) + est / t.maxhp * .5;
      if (d > moveReach(mv)) s *= .12; if (mv.recoil && m.hp < m.maxhp * .25) s *= .5;
    } else if (mv.status || mv.drop) {
      if (mv.status === 'SEED') { if (t.seeded !== null || statusImmune(t, 'SEED')) continue; }
      else if (mv.status) { if (t.status || statusImmune(t, mv.status)) continue; if (mv.typeCheck && effOn(mv, t) === 0) continue; }
      else if (mv.drop && t.st[mv.drop.s] <= -2) continue;
      s = mv.status === 'SLP' ? .75 : .5; if (d > moveReach(mv)) s *= .2;
    } else if (mv.buff) { const k = Object.keys(mv.buff)[0]; if (m.st[k] >= 2) continue; s = m.hp > m.maxhp * .5 ? .5 : .2; if (d < 160) s *= .5; }
    else if (mv.heal) { if (m.hp > m.maxhp * .5) continue; s = 1.05 - m.hp / m.maxhp; }
    else if (mv.weather) { if (G.weather && G.weather.type === mv.weather) continue; s = .45; }
    else if (mv.shape === 'blink') { s = d < 140 ? .6 : .1; }
    s *= .85 + Math.random() * .3; if (!best || s > best.s) best = { id, s };
  }
  if (best && best.s > .12) tryCast(m, best.id, { x: t.x, y: t.y });
  else if (d <= basicRange(m) + t.r) tryBasic(m, t);
}
function aiAim(m, mv) {
  const t = foeActive(m); if (!t) return { x: m.x + Math.cos(m.face) * 100, y: m.y + Math.sin(m.face) * 100 };
  if (mv.shape === 'blink') { const a = Math.atan2(m.y - t.y, m.x - t.x) + (Math.random() - .5) * 1.4; return { x: m.x + Math.cos(a) * 260, y: m.y + Math.sin(a) * 260 }; }
  const D = DIFF[G.diff] || DIFF.normal; const d = dist(m, t); let lead = 0;
  if (mv.shape === 'proj') lead = d / projSpeed(mv); else if (mv.shape === 'zone') lead = .75 + (100 - effAcc(mv)) / 100 * .6; else if (mv.shape === 'dash') lead = d / (mv.dashSpd || 950);
  const ax = t.x + t.vx * lead * D.lead, ay = t.y + t.vy * lead * D.lead;
  const ang = Math.atan2(ay - m.y, ax - m.x) + (Math.random() * 2 - 1) * D.aimErr, dd = Math.hypot(ax - m.x, ay - m.y);
  return { x: m.x + Math.cos(ang) * dd, y: m.y + Math.sin(ang) * dd };
}
