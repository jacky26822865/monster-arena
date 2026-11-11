'use strict';
// =====================================================================
// 戰鬥引擎：第三代公式＋即時制規則。
// 單人與連線房主會執行 update()；連線的客戶端只套用房主送來的狀態快照。
// =====================================================================
let G = null;
const GRAV = 1900;

// ---------- 事件（房主會把這些事件同步給客戶端） ----------
function emit(ev) { if (G && G.net === 'host') G.ev.push(ev); }
function isMe(side) { return G && side === G.me; }
function log(t, c) { G.log.push({ t, c: c || '#cfd6e6', time: G.t }); if (G.log.length > 40) G.log.shift(); emit(['l', t, c || 0]); }
function say(m, txt, c, size) {
  const n = G.texts.filter(t => t.mon === m && t.t < .35).length;
  G.texts.push({ mon: m, x: m.x + (Math.random() * 16 - 8), y: m.y, h: (m.model ? m.model.userData.top : m.r * 2.6) + 44 + n * 20 + (m.z || 0), txt: String(txt), c: c || '#fff', t: 0, dur: 1.1, size: size || 15 });
  emit(['s', m.side, m.ti, String(txt), c || 0, size || 0]);
}
function burst(x, y, c, n, sp) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (sp || 160) * (.3 + Math.random()); G.parts.push({ x, y, z: 26, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (.2 + Math.random()) * v * .7, life: .4 + Math.random() * .4, max: .8, c, r: 2 + Math.random() * 3 }); }
  emit(['b', x | 0, y | 0, c, n, sp || 0]);
}
function burstRing(x, y, z, c, n) {
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; G.parts.push({ x, y, z: z + 4, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, vz: 30, life: .4, max: .4, c, r: 3 }); }
  emit(['r', x | 0, y | 0, z | 0, c, n]);
}
function addFlash(x, y, z, c, big) { G.flashes.push({ x, y, z, c, big }); emit(['f', x | 0, y | 0, z | 0, c, big ? 1 : 0]); }
function shake(v) { G.shakeReq = Math.max(G.shakeReq || 0, v); emit(['k', v]); }
function hitStop(v) { G.hs = Math.max(G.hs || 0, v); }

// ---------- 建立 ----------
// 對戰 HP 倍率：第三代的傷害數字照原作計算，但即時制沒有「回合」的停頓，
// HP 照原作的話幾秒就分出勝負，所以對戰中的 HP 乘上倍率（預設 ×2）來拉長節奏。
// 異常狀態、岩漿等「依最大 HP 比例」的傷害改用原作 HP（baseHp）計算，速度跟著一起放慢。
function makeMon(sp, nature, side, ti, photo, mult) {
  const stats = calcStats(sp, nature); const maxhp = Math.round(stats.hp * (mult || 1));
  const m = { sp, name: sp.name, types: sp.types, ability: sp.ability, nature, stats, baseHp: stats.hp, maxhp, hp: maxhp, side, ti, photo: photo || null,
    moves: sp.moves.slice(), pp: {}, cd: {}, cdMax: {}, fainted: false, status: null, slpT: 0, r: 26, x: 0, y: 0, face: 0, hitFlash: 0, lavaT: 0 };
  for (const id of m.moves) { m.pp[id] = MOVES[id].pp; m.cd[id] = 0; m.cdMax[id] = 1; }
  m.basicId = 'b_' + m.types[0] + (PHYSICAL.has(m.types[0]) ? '_m' : '_r');
  resetVolatile(m); return m;
}
function resetVolatile(m) {
  Object.assign(m, { st: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }, seeded: null, toxicN: 1, flinchT: 0, cast: null, dash: null, dodge: null, invT: 0, dodgeCd: 0, gcd: 0, turnAcc: 0, boostN: 0,
    vx: 0, vy: 0, kbx: 0, kby: 0, inX: 0, inY: 0, atkTarget: false, atkCd: 0, z: 0, vz: 0, jumps: 0, air: false, mvx: 0, mvy: 0, slam: null, squash: 0, flip: 0 });
}
function spawnPos(i) { return i === 0 ? { x: 220, y: 375 } : { x: 1060, y: 375 }; }
function activeOf(i) { const s = G.sides[i]; return s.team[s.idx]; }
function foeActive(m) { const f = activeOf(1 - m.side); return f && !f.fainted ? f : null; }

// opts: {teams:[[{id,nature,photo}],[...]], map, diff, net:'local'|'host'|'client', me, names, ai:[bool,bool]}
function startBattle(o) {
  setMap(o.map || 'star');
  G = { t: 0, sides: [], projs: [], fx: [], cfx: [], zones: [], texts: [], parts: [], log: [], flashes: [], ev: [], hs: 0, shakeReq: 0, weather: null,
    over: false, paused: false, userPause: false, diff: o.diff || 'normal', stats: { dealt: 0, taken: 0 }, net: o.net || 'local', me: o.me || 0,
    names: o.names || ['你', '電腦'], nid: 1, winner: -1, opts: o, hpMult: o.hpMult || 2 };
  G.sides = [0, 1].map(i => ({ i, isAI: !!(o.ai && o.ai[i]), team: o.teams[i].map((p, ti) => makeMon(speciesById(p.id), p.nature, i, ti, p.photo, G.hpMult)), idx: 0, switchCd: 0, pend: null,
    ai: { thinkT: 1.2, strafe: 1, strafeT: 0, dq: null }, ctl: { inX: 0, inY: 0, aim: { x: i ? 0 : W, y: 375 } } }));
  for (const s of G.sides) { const p = spawnPos(s.i); const m = s.team[0]; m.x = p.x; m.y = p.y; m.face = s.i === 0 ? 0 : Math.PI; }
  if (G.net !== 'client') {
    log(`對戰開始！場地：${MAP.name}`, '#ffd86b');
    enter(G.sides[0], 0, spawnPos(0), true); enter(G.sides[1], 0, spawnPos(1), true);
    entryAbility(activeOf(0)); entryAbility(activeOf(1));
  }
}
function enter(side, idx, pos, silentAbility) {
  side.idx = idx; const m = side.team[idx]; resetVolatile(m); m.x = pos.x; m.y = pos.y; m.face = side.i === 0 ? 0 : Math.PI; m.invT = .8;
  log(`${G.names[side.i]} 派出了 ${m.name}！`, isMe(side.i) ? '#8fdcff' : '#ff9c9c');
  if (side.isAI) { let s = 0, n = 0; for (const id of m.moves) { const mv = MOVES[id]; if (mv.power > 0) { s += moveReach(mv); n++; } } m.pref = n ? clamp(s / n * .62, 70, 330) : 250; }
  burst(m.x, m.y, '#ffffff', 20, 220);
  if (!silentAbility) entryAbility(m);
}
function entryAbility(m) { if (m.ability === '威壓') { const f = foeActive(m); if (f) { say(m, '威壓', '#ffd86b'); log(`${m.name} 的威壓！`, '#ffd86b'); changeStage(f, 'atk', -1); } } }
function doSwitch(side) {
  const m = side.team[side.idx]; if (side.switchCd > 0 || m.cast || m.dash || m.fainted) return;
  let ni = -1; for (let k = 1; k <= 2; k++) { const j = (side.idx + k) % side.team.length; if (!side.team[j].fainted) { ni = j; break; } }
  if (ni < 0) { say(m, '沒有可換的同伴', '#bbb'); return; }
  log(`${m.name}，回來吧！`); const pos = { x: m.x, y: m.y }; resetVolatile(m); side.switchCd = 4; enter(side, ni, pos);
}
function changeStage(m, k, d) {
  const old = m.st[k]; const nv = clamp(old + d, -6, 6);
  if (nv === old) { say(m, STATN[k] + (d > 0 ? '無法再提高' : '無法再降低'), '#bbb'); return; }
  m.st[k] = nv; const w = d >= 2 ? '大幅提高' : d > 0 ? '提高了' : d <= -2 ? '大幅降低' : '降低了';
  say(m, STATN[k] + (d > 0 ? '↑' : '↓') + (Math.abs(d) > 1 ? (d > 0 ? '↑' : '↓') : ''), d > 0 ? '#ffb36b' : '#7ab8ff'); log(`${m.name} 的${STATN[k]}${w}！`);
}
function statusImmune(m, st) {
  if (st === 'BRN') return m.types.includes('FIRE');
  if (st === 'FRZ') return m.types.includes('ICE') || m.ability === '熔岩鎧';
  if (st === 'PSN' || st === 'TOX') return m.types.includes('POISON') || m.types.includes('STEEL');
  if (st === 'SEED') return m.types.includes('GRASS');
  return false;
}
function inflict(m, st, quiet, src) {
  if (m.fainted) return false;
  if (m.status || statusImmune(m, st) || (st === 'FRZ' && G.weather && G.weather.type === 'SUN')) { if (!quiet) { say(m, '失敗了', '#bbb'); log('但是失敗了！'); } return false; }
  m.status = st; if (st === 'SLP') m.slpT = (2 + Math.floor(Math.random() * 4)) * TURN; if (st === 'TOX') m.toxicN = 1;
  if (st === 'SLP' || st === 'FRZ') m.cast = null;
  const msg = { BRN: '灼傷了！', PAR: '麻痺了！', SLP: '睡著了！', FRZ: '被冰凍了！', PSN: '中毒了！', TOX: '中了劇毒！' }[st];
  say(m, STATUSN[st][0] + '！', STATUSN[st][1]); log(`${m.name} ${msg}`, STATUSN[st][1]);
  if (m.ability === '同步' && src && src !== m && !src.fainted && ['BRN', 'PAR', 'PSN', 'TOX'].includes(st)) { say(m, '同步', '#ffd86b'); inflict(src, st, true, null); }
  return true;
}
function effSpe(m) { let v = applyStage(m.stats.spe, m.st.spe); if (m.status === 'PAR') v = Math.floor(v / 4); return v; }
function moveSpeed(m) { return clamp(90 + effSpe(m) * .9, 80, 360); }
// 普攻間隔（類似 LoL 的攻速）：速度越快，間隔越短
function atkInterval(m) { return clamp(1.7 - effSpe(m) / 220, .55, 1.5); }
function basicRange(m) { const mv = MOVES[m.basicId]; return mv.shape === 'melee' ? (mv.reach || 72) + m.r : (mv.range || 400) * .85; }
function tryBasic(m, f) { if (!canAct(m) || m.gcd > 0 || m.atkCd > 0) return false; m.cast = { id: m.basicId, t: .12, total: .12, aim: { x: f.x, y: f.y }, basic: true }; return true; }
function cdMult(m) { return clamp(1.15 - effSpe(m) / 600, .8, 1.12); }
function incapacitated(m) { return m.status === 'SLP' || m.status === 'FRZ' || m.flinchT > 0; }
function canAct(m) { return !m.fainted && !m.cast && !m.dash && !m.dodge && !incapacitated(m); }
function allPPOut(m) { return m.moves.every(id => m.pp[id] <= 0); }

// ---------- 地形 ----------
function outOfPlatform(x, y) { return x < AR.x0 || x > AR.x1 || y < AR.y0 || y > AR.y1; }
function groundH(x, y) {
  if (MAP.void && outOfPlatform(x, y)) return -1e9;
  for (const p of PILLARS) { if (Math.hypot(x - p.x, y - p.y) < p.r * .95) return p.top; }
  return 0;
}
function inLava(x, y) { if (!MAP.lava) return false; for (const l of MAP.lava) if (Math.hypot(x - l.x, y - l.y) < l.r * .92) return true; return false; }
function doJump(m, dx, dy) {
  if (m.fainted || incapacitated(m) || m.cast || m.dodge || m.dash || m.slam || m.jumps >= 2) return;
  if (!m.air) { m.jumps = 1; m.vz = 650; } else { m.jumps = 2; m.vz = 590; m.flip = 1; }
  // 前跳：往移動方向補一段水平速度
  const l = Math.hypot(dx || 0, dy || 0);
  if (l > .1) { const sp = moveSpeed(m) * 1.25; const ux = dx / l, uy = dy / l; const cur = m.mvx * ux + m.mvy * uy; if (cur < sp) { m.mvx += ux * (sp - cur); m.mvy += uy * (sp - cur); } }
  m.air = true; m.squash = -.3; burstRing(m.x, m.y, m.z, '#dfefff', 12);
}
function land(m, vz) {
  m.jumps = 0;
  if (vz < -420) { m.squash = .34; burstRing(m.x, m.y, m.z, '#c8d4ee', 16); if (vz < -1000) shake(6); }
  if (m.slam) { const mv = m.slam; m.slam = null; G.fx.push({ id: G.nid++, k: 'ring', x: m.x, y: m.y, R: (mv.radius || 170) * accScale(mv) * 1.1, t: 0, dur: .42, color: TYPES[mv.type].c, owner: m, mv, hit: false, type: mv.type }); hitStop(.06); }
}
function fallOut(m) {
  const d = Math.max(1, Math.floor(m.maxhp / 4)); say(m, '掉出場地！ -' + d, '#ff8a8a', 18); log(`${m.name} 掉出了場地！`, '#ff8a8a');
  const p = { x: (AR.x0 + AR.x1) / 2 + (m.side ? 120 : -120), y: 375 };
  m.x = p.x; m.y = p.y; m.z = 200; m.vz = 0; m.mvx = m.mvy = m.kbx = m.kby = 0; m.dash = null; m.dodge = null; m.invT = 1.2; m.air = true;
  applyDamage(m, d);
}

// ---------- 傷害（第三代公式） ----------
function calcDamage(att, def, mv, est) {
  const phys = PHYSICAL.has(mv.type); let power = mv.power;
  if (PINCH[att.ability] === mv.type && att.hp <= Math.floor(att.maxhp / 3)) power = Math.floor(power * 150 / 100);
  const crit = !est && mv.type !== 'NONE' && Math.random() < [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2][mv.highCrit ? 1 : 0];
  let aS = phys ? att.st.atk : att.st.spa, dS = phys ? def.st.def : def.st.spd;
  if (crit) { if (aS < 0) aS = 0; if (dS > 0) dS = 0; }
  let A = applyStage(phys ? att.stats.atk : att.stats.spa, aS);
  const D = Math.max(1, applyStage(phys ? def.stats.def : def.stats.spd, dS));
  const guts = att.ability === '毅力' && att.status;
  if (guts && phys) A = Math.floor(A * 150 / 100);
  if (def.ability === '厚脂' && (mv.type === 'FIRE' || mv.type === 'ICE')) A = Math.floor(A / 2);
  let dmg = Math.floor(Math.floor(Math.floor(2 * LV / 5 + 2) * power * A / D) / 50);
  if (phys && att.status === 'BRN' && !guts) dmg = Math.floor(dmg / 2);
  const w = G.weather && G.weather.type;
  if (w === 'RAIN') { if (mv.type === 'WATER') dmg = Math.floor(dmg * 15 / 10); if (mv.type === 'FIRE') dmg = Math.floor(dmg / 2); }
  if (w === 'SUN') { if (mv.type === 'FIRE') dmg = Math.floor(dmg * 15 / 10); if (mv.type === 'WATER') dmg = Math.floor(dmg / 2); }
  dmg += 2;
  if (crit) dmg *= 2;
  if (att.types.includes(mv.type)) dmg = Math.floor(dmg * 15 / 10);
  let eff = 1;
  if (mv.type !== 'NONE') for (const t of def.types) { const r = CHART[mv.type][t]; if (r !== undefined) { dmg = Math.floor(dmg * r); eff *= r; } }
  const rnd = est ? 92 : 85 + Math.floor(Math.random() * 16);
  dmg = Math.floor(dmg * rnd / 100); if (dmg < 1) dmg = 1;
  return { dmg, crit, eff };
}
function accRoll(att, def, mv) { if (mv.acc === 0) return true; const s = clamp(att.st.acc - def.st.eva, -6, 6); const r = ACC_RATIO[s + 6]; return Math.random() < r[0] / r[1]; }
function applyDamage(m, d) { m.hp = Math.max(0, m.hp - d); m.hitFlash = .15; if (m.hp <= 0 && !m.fainted) faint(m); }
function heal(m, d) { if (m.fainted) return; m.hp = Math.min(m.maxhp, m.hp + d); }
function faint(m) {
  m.fainted = true; m.hp = 0; m.cast = null; m.dash = null; m.dodge = null;
  log(`${m.name} 倒下了！`, '#ff8a8a'); burst(m.x, m.y, TYPES[m.types[0]].c, 40, 280);
  G.sides[m.side].pend = 1.3;
}
function hit(att, def, mv) {
  if (def.fainted) return;
  if (def.invT > 0) { say(def, '閃避！', '#e6f2ff'); return; }
  if (def.ability === '蓄電' && mv.type === 'ELECTRIC') { const h = Math.floor(def.maxhp / 4); say(def, '蓄電 +' + h, '#f8d030'); log(`${def.name} 的蓄電吸收了電力！`, '#f8d030'); heal(def, h); return; }
  const eff0 = effOn(mv, def);
  if (mv.power === 0) {
    if (mv.typeCheck && eff0 === 0) { say(def, '沒有效果…', '#aaa'); log(`對 ${def.name} 沒有效果…`); return; }
    if (!accRoll(att, def, mv)) { say(def, '沒有命中', '#ddd'); log(`${att.name} 的攻擊沒有命中！`); return; }
    if (mv.status === 'SEED') { if (def.seeded !== null || statusImmune(def, 'SEED')) { say(def, '失敗了', '#bbb'); return; } def.seeded = att.side; say(def, '被種下種子！', '#78c850'); log(`${def.name} 被種下了寄生種！`, '#9be07a'); }
    else if (mv.status) inflict(def, mv.status, false, att);
    if (mv.drop) changeStage(def, mv.drop.s, mv.drop.n);
    return;
  }
  if (eff0 === 0) { say(def, '沒有效果…', '#aaa'); log(`對 ${def.name} 沒有效果…`); return; }
  if (!accRoll(att, def, mv)) { say(def, '閃開了！', '#ddd'); log(`${def.name} 閃開了攻擊！`); return; }
  const r = calcDamage(att, def, mv, false);
  const col = r.eff > 1 ? '#ffdf5a' : r.eff < 1 ? '#a8b4cc' : '#ffffff';
  say(def, '-' + r.dmg, col, r.eff > 1 || r.crit ? 22 : 17);
  if (r.crit) say(def, '會心一擊！', '#ff7a5a');
  if (r.eff > 1) say(def, '效果絕佳！', '#ffdf5a'); else if (r.eff < 1) say(def, '效果不好…', '#a8b4cc');
  log(`${def.name} 受到 ${r.dmg} 點傷害${r.crit ? '（會心一擊）' : ''}${r.eff > 1 ? '，效果絕佳！' : r.eff < 1 ? '，效果不好…' : ''}`, isMe(att.side) ? '#bfe9ff' : '#ffc9c9');
  if (isMe(att.side)) G.stats.dealt += r.dmg; else G.stats.taken += r.dmg;
  const a = Math.atan2(def.y - att.y, def.x - att.x); def.kbx += Math.cos(a) * 220; def.kby += Math.sin(a) * 220;
  const big = r.crit || r.eff > 1 || mv.power >= 100;
  addFlash(def.x, def.y, def.z + 30, TYPES[mv.type].c, big);
  if (big) { def.vz = Math.max(def.vz, 460); def.air = true; def.kbx *= 1.7; def.kby *= 1.7; def.flinchT = Math.max(def.flinchT, .3); hitStop(.08); shake(10); }
  else { hitStop(.035); shake(4); }
  applyDamage(def, r.dmg);
  if (mv.drain && !att.fainted) { const h = Math.max(1, Math.floor(r.dmg * mv.drain)); heal(att, h); say(att, '+' + h, '#7dff9a'); }
  if (!def.fainted) {
    if (def.status === 'FRZ' && mv.type === 'FIRE') { def.status = null; say(def, '解凍了！', '#ffb36b'); log(`${def.name} 的冰融化了！`); }
    if (def.status === 'SLP') def.slpT -= 1;
    const e = mv.eff;
    if (e) {
      if (e.burn && roll(e.burn)) inflict(def, 'BRN', true, att);
      if (e.para && roll(e.para)) inflict(def, 'PAR', true, att);
      if (e.frz && roll(e.frz)) inflict(def, 'FRZ', true, att);
      if (e.psn && roll(e.psn)) inflict(def, 'PSN', true, att);
      if (e.flinch && roll(e.flinch)) { if (def.ability === '精神力') say(def, '精神力', '#ffd86b'); else { def.flinchT = .5; def.cast = null; say(def, '畏縮了！', '#ffd0a0'); } }
      if (e.statDown && roll(e.statDown.ch)) changeStage(def, e.statDown.s, -1);
    }
    if (mv.contact && !att.fainted) {
      if (def.ability === '帶電體' && roll(30)) { say(def, '帶電體', '#f8d030'); inflict(att, 'PAR', true, null); }
      if (def.ability === '孢子' && roll(10)) { say(def, '孢子', '#b05cc8'); inflict(att, ['PSN', 'PAR', 'SLP'][Math.floor(Math.random() * 3)], true, null); }
    }
  }
  if (mv.contact && def.ability === '粗糙皮膚' && !att.fainted) { const d = Math.max(1, Math.floor(att.baseHp / 16)); say(att, '粗糙皮膚 -' + d, '#e8c070'); applyDamage(att, d); }
  if (mv.eff && mv.eff.selfUp && !att.fainted && roll(mv.eff.selfUp.ch)) changeStage(att, mv.eff.selfUp.s, 1);
  if (mv.recoil && !att.fainted) { const rc = Math.max(1, Math.floor(r.dmg * mv.recoil)); say(att, '反作用 -' + rc, '#ffa0a0'); log(`${att.name} 受到反作用傷害！`); applyDamage(att, rc); }
}

// ---------- 施放 ----------
function tryCast(m, id, aim) {
  if (!canAct(m) || m.gcd > 0) return false;
  const mv = MOVES[id]; if (!mv) return false;
  if (id !== 'struggle') { if (!m.moves.includes(id) || m.cd[id] > 0) return false; if (m.pp[id] <= 0) { if (isMe(m.side)) say(m, 'PP 用完了', '#bbb'); return false; } }
  m.cast = { id, t: castTime(mv), total: castTime(mv), aim: { x: aim.x, y: aim.y } }; return true;
}
function finishCast(m) {
  const c = m.cast; m.cast = null; const mv = MOVES[c.id];
  if (c.basic) { m.gcd = .08; m.atkCd = atkInterval(m); const f = foeActive(m); if (m.status === 'PAR' && Math.random() < .25) { say(m, '全身麻痺！', '#f8d030'); return; } execMove(m, mv, f ? { x: f.x, y: f.y } : c.aim); if (m.atkTarget === 'once') m.atkTarget = false; return; }
  m.gcd = .22;
  if (m.status === 'PAR' && Math.random() < .25) { say(m, '全身麻痺！', '#f8d030'); log(`${m.name} 全身麻痺，無法動彈！`, '#f8d030'); if (c.id !== 'struggle') m.cd[c.id] = Math.max(m.cd[c.id], .6); return; }
  if (c.id !== 'struggle') { m.pp[c.id]--; const cd = baseCd(mv) * cdMult(m); m.cd[c.id] = cd; m.cdMax[c.id] = cd; }
  log(`${m.name} 使出了 ${mv.name}！`, isMe(m.side) ? '#8fdcff' : '#ff9c9c');
  let aim = G.sides[m.side].isAI ? aiAim(m, mv) : c.aim;
  if (castMode(mv) === 'unit') { const f = foeActive(m); if (f) aim = { x: f.x, y: f.y }; }
  execMove(m, mv, aim);
}
function execMove(m, mv, aim) {
  const ang = Math.atan2(aim.y - m.y, aim.x - m.x); m.face = ang; const tc = TYPES[mv.type].c;
  switch (mv.shape) {
    case 'proj': { const sp = projSpeed(mv); G.projs.push({ id: G.nid++, owner: m, mv, h: m.z + 30, x: m.x + Math.cos(ang) * 28, y: m.y + Math.sin(ang) * 28, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, sp, r: (mv.r || 12) * accScale(mv), life: (mv.range || 560) / sp, homing: mv.acc === 0, color: tc, trail: [], dead: false }); break; }
    case 'melee': {
      const range = (mv.reach || 75) * (.8 + .2 * accScale(mv)), arc = (mv.arc || 100) * Math.PI / 180;
      G.fx.push({ id: G.nid++, k: 'swipe', x: m.x, y: m.y, z: m.z, ang, range: range + m.r, arc, t: 0, dur: .22, color: tc });
      const t = foeActive(m);
      if (t && Math.abs(t.z - m.z) < 75) { const d = dist(m, t); const a = Math.abs(angDiff(Math.atan2(t.y - m.y, t.x - m.x), ang)); if (d < range + m.r + t.r * .6 && (a < arc / 2 || d < m.r + t.r + 6)) hit(m, t, mv); }
      break;
    }
    case 'dash': m.dash = { ang, left: mv.dist || 220, sp: mv.dashSpd || 950, mv, hitDone: false }; break;
    case 'aoeSelf':
      if (m.z - groundH(m.x, m.y) > 20) { m.slam = mv; m.vz = -900; log(`${m.name} 從空中下砸！`); break; }
      G.fx.push({ id: G.nid++, k: 'ring', x: m.x, y: m.y, R: (mv.radius || 170) * accScale(mv), t: 0, dur: .42, color: tc, owner: m, mv, hit: false, type: mv.type }); break;
    case 'zone': {
      const range = mv.range || 460; let dx = aim.x - m.x, dy = aim.y - m.y; const d = Math.hypot(dx, dy); if (d > range) { dx *= range / d; dy *= range / d; }
      const acc = effAcc(mv);
      G.zones.push({ id: G.nid++, owner: m, mv, x: clamp(m.x + dx, AR.x0, AR.x1), y: clamp(m.y + dy, AR.y0, AR.y1), R: (mv.radius || 75) * accScale(mv), t: 0, delay: .75 + (100 - acc) / 100 * .6, color: tc });
      break;
    }
    case 'blink': {
      const range = mv.range || 300; let dx = aim.x - m.x, dy = aim.y - m.y; const d = Math.hypot(dx, dy) || 1; if (d > range) { dx *= range / d; dy *= range / d; }
      let nx = clamp(m.x + dx, AR.x0 + m.r, AR.x1 - m.r), ny = clamp(m.y + dy, AR.y0 + m.r, AR.y1 - m.r);
      for (const p of PILLARS) { const pd = Math.hypot(nx - p.x, ny - p.y); if (pd < p.r + m.r && p.top > m.z + 30) { nx = p.x + (nx - p.x) / (pd || 1) * (p.r + m.r + 2); ny = p.y + (ny - p.y) / (pd || 1) * (p.r + m.r + 2); } }
      G.fx.push({ id: G.nid++, k: 'ring2', x: m.x, y: m.y, R: 60, t: 0, dur: .35, color: tc }); burst(m.x, m.y, tc, 16, 160);
      m.x = nx; m.y = ny; m.invT = Math.max(m.invT, .15); m.mvx = m.mvy = 0;
      G.fx.push({ id: G.nid++, k: 'ring2', x: m.x, y: m.y, R: 60, t: 0, dur: .35, color: tc }); burst(m.x, m.y, tc, 16, 160); break;
    }
    case 'self':
      if (mv.buff) for (const k in mv.buff) changeStage(m, k, mv.buff[k]);
      if (mv.heal) { if (m.hp >= m.maxhp) say(m, 'HP 已滿', '#bbb'); else { const h = Math.floor(m.maxhp * mv.heal); heal(m, h); say(m, '+' + h, '#7dff9a', 18); log(`${m.name} 回復了 HP！`, '#9be07a'); } }
      if (mv.weather) { G.weather = { type: mv.weather, t: 5 * TURN, max: 5 * TURN }; log(mv.weather === 'RAIN' ? '開始下雨了！' : '陽光變強了！', '#ffd86b'); }
      burst(m.x, m.y, tc, 18, 140); G.fx.push({ id: G.nid++, k: 'ring2', x: m.x, y: m.y, R: 60, t: 0, dur: .35, color: tc }); break;
  }
}
function endTurn(m) {
  if (m.fainted) return;
  const s = m.status;
  if (s === 'BRN' || s === 'PSN') { const d = Math.max(1, Math.floor(m.baseHp / 8)); say(m, '-' + d, STATUSN[s][1]); applyDamage(m, d); if (m.fainted) return; }
  if (s === 'TOX') { const d = Math.max(1, Math.floor(m.baseHp * m.toxicN / 16)); m.toxicN = Math.min(15, m.toxicN + 1); say(m, '-' + d, STATUSN[s][1]); applyDamage(m, d); if (m.fainted) return; }
  if (m.seeded !== null) { const d = Math.max(1, Math.floor(m.baseHp / 8)); const seeder = activeOf(m.seeded); say(m, '寄生 -' + d, '#78c850'); applyDamage(m, d); if (seeder && !seeder.fainted) heal(seeder, d); if (m.fainted) return; }
  if (s === 'FRZ' && Math.random() < .2) { m.status = null; say(m, '解凍了！', '#bff3ff'); log(`${m.name} 的冰融化了！`); }
  if (m.ability === '疾走') { m.boostN++; if (m.boostN >= 3) { m.boostN = 0; if (m.st.spe < 6) { say(m, '疾走', '#ffd86b'); changeStage(m, 'spe', 1); } } }
}
function doDodge(m, dx, dy) {
  if (m.dodgeCd > 0 || m.cast || m.dash || m.dodge || incapacitated(m) || m.fainted) return;
  let l = Math.hypot(dx, dy); if (l < .01) { dx = Math.cos(m.face); dy = Math.sin(m.face); l = 1; }
  dx /= l; dy /= l; m.dodge = { vx: dx * 880, vy: dy * 880, t: .18 }; m.invT = .24; m.dodgeCd = 1.4; burst(m.x, m.y, '#dfefff', 8, 90);
}
// 玩家（本機或遠端）的動作
function applyAction(side, a) {
  if (!G || G.over) return; const m = side.team[side.idx]; if (!m || m.fainted) return;
  if (a.a === 'cast') { const id = allPPOut(m) ? 'struggle' : m.moves[a.i]; tryCast(m, id, { x: +a.ax || 0, y: +a.ay || 0 }); }
  else if (a.a === 'jump') doJump(m, +a.dx || 0, +a.dy || 0);
  else if (a.a === 'dodge') doDodge(m, +a.dx || 0, +a.dy || 0);
  else if (a.a === 'switch') doSwitch(side);
  else if (a.a === 'atk') m.atkTarget = a.once ? 'once' : true;
  else if (a.a === 'stop') m.atkTarget = false;
}

// ---------- 更新 ----------
function collide(m) {
  let hitAny = false; const r = m.r;
  if (!MAP.void) {
    if (m.x < AR.x0 + r) { m.x = AR.x0 + r; hitAny = true; } if (m.x > AR.x1 - r) { m.x = AR.x1 - r; hitAny = true; }
    if (m.y < AR.y0 + r) { m.y = AR.y0 + r; hitAny = true; } if (m.y > AR.y1 - r) { m.y = AR.y1 - r; hitAny = true; }
  }
  for (const p of PILLARS) { if (m.z > p.top - 8) continue; const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < p.r + r) { m.x = p.x + dx / d * (p.r + r); m.y = p.y + dy / d * (p.r + r); hitAny = true; } }
  return hitAny;
}
function updateMon(m, dt, side) {
  m.gcd -= dt; m.invT -= dt; m.flinchT -= dt; m.dodgeCd -= dt; m.hitFlash -= dt; m.atkCd -= dt;
  for (const id of m.moves) if (m.cd[id] > 0) m.cd[id] -= dt;
  if (m.status === 'SLP') { m.slpT -= dt; if (m.slpT <= 0) { m.status = null; say(m, '醒來了！', '#e6f2ff'); log(`${m.name} 醒過來了！`); } }
  m.turnAcc += dt; while (m.turnAcc >= TURN) { m.turnAcc -= TURN; endTurn(m); if (m.fainted) return; }
  if (side.isAI) aiUpdate(m, dt);
  else {
    const c = side.ctl; const l = Math.hypot(c.inX, c.inY); const k = l > 1 ? 1 / l : 1; m.inX = c.inX * k; m.inY = c.inY * k; let face = c.aim;
    if (m.atkTarget) {   // 普攻目標：追到射程內就自動攻擊
      const f = foeActive(m);
      if (!f) m.atkTarget = false;
      else { const d = dist(m, f), rg = basicRange(m) + f.r * .5; face = f;
        if (d > rg) { if (m.atkTarget === 'once') m.atkTarget = false; else { m.inX = (f.x - m.x) / d; m.inY = (f.y - m.y) / d; } }
        else { m.inX = m.inY = 0; tryBasic(m, f); } }
    }
    if (!m.dash && !incapacitated(m)) m.face = Math.atan2(face.y - m.y, face.x - m.x);
  }
  if (m.cast) { if (incapacitated(m)) m.cast = null; else { m.cast.t -= dt; if (m.cast.t <= 0) finishCast(m); } }
  let vx = 0, vy = 0;
  if (m.dash) {
    const d = m.dash, step = Math.min(d.left, d.sp * dt);
    m.x += Math.cos(d.ang) * step; m.y += Math.sin(d.ang) * step; d.left -= step; vx = Math.cos(d.ang) * d.sp; vy = Math.sin(d.ang) * d.sp;
    const f = foeActive(m);
    if (f && !d.hitDone && dist(m, f) < m.r + f.r + 6 && Math.abs(m.z - f.z) < 65) { d.hitDone = true; hit(m, f, d.mv); f.kbx += Math.cos(d.ang) * 200; f.kby += Math.sin(d.ang) * 200; m.dash = null; }
    else if (collide(m) || d.left <= 0) m.dash = null;
  } else if (m.dodge) { vx = m.dodge.vx; vy = m.dodge.vy; m.dodge.t -= dt; if (m.dodge.t <= 0) m.dodge = null; }
  else {
    const sp = incapacitated(m) ? 0 : moveSpeed(m) * (m.cast ? .35 : 1), tx = m.inX * sp, ty = m.inY * sp;
    const grip = m.air ? 9 : (MAP.ice ? 2.2 : 15), ac = Math.min(1, dt * grip);
    m.mvx += (tx - m.mvx) * ac; m.mvy += (ty - m.mvy) * ac; vx = m.mvx; vy = m.mvy;
  }
  if (m.dash || m.dodge) { m.mvx = vx * .4; m.mvy = vy * .4; }
  if (!m.dash) { m.x += (vx + m.kbx) * dt; m.y += (vy + m.kby) * dt; }
  const damp = Math.pow(.004, dt); m.kbx *= damp; m.kby *= damp;
  m.vx = vx; m.vy = vy; collide(m);
  if (m.dash) m.vz = 0; else { m.vz -= GRAV * (m.slam ? 2.4 : 1) * dt; m.z += m.vz * dt; }
  const gh = groundH(m.x, m.y);
  if (m.z <= gh) { const v = m.vz; m.z = gh; if (m.air) { m.air = false; land(m, v); } if (m.vz < 0) m.vz = 0; } else m.air = true;
  if (m.z < -260) fallOut(m);
  m.squash *= Math.pow(.0004, dt); if (m.flip > 0) m.flip = Math.max(0, m.flip - dt * 2.6);
  // 岩漿
  if (!m.air && m.z <= 1 && inLava(m.x, m.y) && !m.types.includes('FIRE')) {
    m.lavaT -= dt; if (m.lavaT <= 0) { m.lavaT = .5; const d = Math.max(1, Math.floor(m.baseHp / 16)); say(m, '岩漿 -' + d, '#ff7a2a'); applyDamage(m, d); if (!m.fainted && roll(15)) inflict(m, 'BRN', true, null); }
  } else m.lavaT = Math.min(m.lavaT, .15);
}
function update(dt) {
  G.t += dt;
  if (G.weather) { G.weather.t -= dt; if (G.weather.t <= 0) { log(G.weather.type === 'RAIN' ? '雨停了。' : '陽光恢復正常了。'); G.weather = null; } }
  for (const s of G.sides) {
    s.switchCd = Math.max(0, s.switchCd - dt);
    if (s.pend !== null) { s.pend -= dt; if (s.pend <= 0) { s.pend = null; const ni = s.team.findIndex(m => !m.fainted); if (ni < 0) { endBattle(1 - s.i); return; } enter(s, ni, spawnPos(s.i)); } }
  }
  for (const s of G.sides) { const m = s.team[s.idx]; if (!m.fainted) updateMon(m, dt, s); }
  const a = activeOf(0), b = activeOf(1);
  if (!a.fainted && !b.fainted && Math.abs(a.z - b.z) < 50) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ov = a.r + b.r - d; if (ov > 0) { a.x -= dx / d * ov / 2; a.y -= dy / d * ov / 2; b.x += dx / d * ov / 2; b.y += dy / d * ov / 2; collide(a); collide(b); } }
  for (const p of G.projs) {
    if (p.dead) continue;
    const tgt = activeOf(1 - p.owner.side);
    if (p.homing && tgt && !tgt.fainted) { const want = Math.atan2(tgt.y - p.y, tgt.x - p.x), cur = Math.atan2(p.vy, p.vx), nd = cur + clamp(angDiff(want, cur), -4 * dt, 4 * dt); p.vx = Math.cos(nd) * p.sp; p.vy = Math.sin(nd) * p.sp; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.h += (30 + (tgt && p.homing ? tgt.z : 0) - p.h) * Math.min(1, dt * 2.5);
    if (p.life <= 0 || p.x < AR.x0 || p.x > AR.x1 || p.y < AR.y0 || p.y > AR.y1) { p.dead = true; continue; }
    for (const pl of PILLARS) if (p.h < pl.top + 4 && Math.hypot(p.x - pl.x, p.y - pl.y) < pl.r + p.r) { p.dead = true; burst(p.x, p.y, p.color, 8, 120); break; }
    if (p.dead) continue;
    if (tgt && !tgt.fainted && Math.hypot(p.x - tgt.x, p.y - tgt.y) < p.r + tgt.r && Math.abs(p.h - (tgt.z + 30)) < p.r + 36) {
      if (tgt.invT > 0) { if (!p.dodged) { p.dodged = true; say(tgt, '閃避！', '#e6f2ff'); } }
      else { hit(p.owner, tgt, p.mv); p.dead = true; burst(p.x, p.y, p.color, 14, 180); }
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
  for (const z of G.zones) {
    z.t += dt;
    if (z.t >= z.delay && !z.done) { z.done = true; G.fx.push({ id: G.nid++, k: 'boom', x: z.x, y: z.y, R: z.R, t: 0, dur: .45, color: z.color, type: z.mv.type }); burst(z.x, z.y, z.color, 26, 260);
      const f = activeOf(1 - z.owner.side); if (f && !f.fainted && Math.hypot(f.x - z.x, f.y - z.y) < z.R + f.r * .6 && f.z < 100) hit(z.owner, f, z.mv); }
  }
  G.zones = G.zones.filter(z => !z.done);
  for (const f of G.fx) {
    f.t += dt;
    if (f.k === 'ring' && !f.hit) {
      const cur = f.R * Math.min(1, f.t / f.dur); const tg = activeOf(1 - f.owner.side); const dd = tg ? Math.hypot(tg.x - f.x, tg.y - f.y) : 1e9;
      if (tg && !tg.fainted && dd <= cur + tg.r * .5 && dd >= cur - 70) { if (tg.z - groundH(tg.x, tg.y) > 34) { if (!f.jumped) { f.jumped = 1; say(tg, '跳過了！', '#e6f2ff'); } } else { f.hit = true; hit(f.owner, tg, f.mv); } }
    }
  }
  G.fx = G.fx.filter(f => f.t < f.dur);
  updateCosmetic(dt);
}
function updateCosmetic(dt) {
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(2, (p.z || 10) + (p.vz || 0) * dt); p.vz = (p.vz || 0) * (p.g ? 1 : .93) - (p.g || 0) * dt; p.vx *= .92; p.vy *= .92; p.life -= dt; }
  G.parts = G.parts.filter(p => p.life > 0);
  if (G.parts.length > 2400) G.parts.splice(0, G.parts.length - 2400);
  for (const t of G.texts) { t.t += dt; t.h += 34 * dt; } G.texts = G.texts.filter(t => t.t < t.dur);
  for (const f of G.cfx) f.t += dt; G.cfx = G.cfx.filter(f => f.t < f.dur);
}
function endBattle(winner) {
  if (G.over) return;
  G.over = true; G.winner = winner; emit(['end', winner]);
  if (typeof onBattleEnd === 'function') { const g0 = G; setTimeout(() => { if (G === g0) onBattleEnd(); }, 1200); }
}
