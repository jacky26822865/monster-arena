'use strict';
// =====================================================================
// 對戰 HUD（畫在 2D 疊加畫布上）
// =====================================================================
function chipC(x, y, txt, bg, fg) { ctx.font = `bold 11px ${FONT}`; const w = ctx.measureText(txt).width + 12; ctx.fillStyle = bg; rr(x, y, w, 17, 8); ctx.fill(); ctx.fillStyle = fg || '#111'; ctx.fillText(txt, x + 6, y + 12.5); return w + 4; }
function drawPanel(s, x, y) {
  const m = s.team[s.idx]; const w = 380, mine = isMe(s.i);
  ctx.fillStyle = 'rgba(12,17,30,.86)'; rr(x, y, w, 82, 10); ctx.fill(); ctx.strokeStyle = mine ? 'rgba(143,220,255,.55)' : 'rgba(255,156,156,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = `11px ${FONT}`; ctx.fillStyle = mine ? '#8fdcff' : '#ff9c9c'; ctx.fillText(G.names[s.i] || '', x + 12, y + 14);
  ctx.font = `bold 18px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(m.name, x + 12, y + 33); let cx = x + 16 + ctx.measureText(m.name).width;
  ctx.font = `12px ${FONT}`; ctx.fillStyle = '#8d98b3'; ctx.fillText('Lv.50', cx, y + 33); cx += 40;
  for (const t of m.types) cx += chipC(cx, y + 20, TYPES[t].n, TYPES[t].c);
  const im = photoImgOf(m.photo); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x + w - 92, y + 22, 13, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(im, x + w - 105, y + 9, 26, 26); ctx.restore(); ctx.strokeStyle = mine ? '#8fdcff' : '#ff9c9c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + w - 92, y + 22, 13, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < s.team.length; i++) { const tm = s.team[i]; const bx = x + w - 20 - i * 20, byy = y + 22; ctx.beginPath(); ctx.arc(bx, byy, 7, 0, Math.PI * 2); ctx.fillStyle = tm.fainted ? '#3a3f50' : TYPES[tm.types[0]].c; ctx.fill(); if (i === s.idx) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } }
  const pc = m.hp / m.maxhp; ctx.fillStyle = '#232c44'; rr(x + 12, y + 41, 256, 11, 6); ctx.fill(); ctx.fillStyle = pc > .5 ? '#5cd68a' : pc > .2 ? '#e8c95a' : '#ff5c5c'; if (pc > 0) { rr(x + 12, y + 41, Math.max(6, 256 * pc), 11, 6); ctx.fill(); }
  ctx.font = `bold 13px ${FONT}`; ctx.fillStyle = '#e8ecf5'; ctx.fillText(`${m.hp} / ${m.maxhp}`, x + 278, y + 51);
  let sx = x + 12; const sy = y + 58;
  if (m.status) sx += chipC(sx, sy, STATUSN[m.status][0], STATUSN[m.status][1]);
  if (m.seeded !== null && m.seeded !== undefined) sx += chipC(sx, sy, '寄生', '#78c850');
  for (const k of ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva']) if (m.st && m.st[k]) sx += chipC(sx, sy, STATN[k] + (m.st[k] > 0 ? '+' : '') + m.st[k], m.st[k] > 0 ? '#ffb36b' : '#7ab8ff');
  if (sx === x + 12) { ctx.font = `11px ${FONT}`; ctx.fillStyle = '#5f6a86'; ctx.fillText(`${m.nature}・${m.ability}・移速 ${Math.round(moveSpeed(m))}`, x + 12, y + 71); }
}
function skillKeys() { return INPUT.scheme === 'lol' ? ['Q', 'W', 'E', 'R'] : ['1', '2', '3', '4']; }
function drawSkillBar() {
  if (INPUT.touch) return;
  const s = G.sides[G.me], m = s.team[s.idx]; const bw = 172, bh = 66, gap = 8, total = 4 * bw + 3 * gap, x0 = (W - total) / 2, y = H - bh - 14; const keys = skillKeys();
  for (let i = 0; i < 4; i++) {
    const id = m.moves[i], mv = MOVES[id], x = x0 + i * (bw + gap), mode = castMode(mv), aiming = INPUT.aiming && INPUT.aiming.i === i;
    ctx.fillStyle = aiming ? 'rgba(40,60,100,.95)' : 'rgba(14,20,36,.92)'; rr(x, y, bw, bh, 9); ctx.fill(); ctx.strokeStyle = aiming ? '#8fdcff' : '#2f3b5c'; ctx.lineWidth = aiming ? 2.5 : 1.5; ctx.stroke();
    ctx.fillStyle = TYPES[mv.type].c; rr(x, y, 6, bh, 3); ctx.fill();
    ctx.fillStyle = '#2a3555'; rr(x + 12, y + 8, 22, 20, 5); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold 13px ${FONT}`; ctx.fillText(keys[i], x + 18, y + 23);
    ctx.font = `bold 15px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(mv.name, x + 40, y + 23);
    ctx.font = `10px ${FONT}`; ctx.fillStyle = '#ffd86b'; ctx.textAlign = 'right'; ctx.fillText(CAST_LABEL[mode], x + bw - 10, y + 22); ctx.textAlign = 'left';
    ctx.font = `11px ${FONT}`; ctx.fillStyle = '#9aa6c2'; ctx.fillText(`${TYPES[mv.type].n}・${category(mv)}・威力 ${mv.power || '—'}`, x + 14, y + 43);
    ctx.fillText(`命中 ${effAcc(mv) || '—'}`, x + 14, y + 58);
    ctx.fillStyle = m.pp[id] <= Math.ceil(mv.pp / 4) ? '#ffb36b' : '#cfd6e6'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`PP ${m.pp[id]}/${mv.pp}`, x + bw - 10, y + 58); ctx.textAlign = 'left';
    if (m.pp[id] <= 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(x, y, bw, bh, 9); ctx.fill(); }
    else if (m.cd[id] > 0) { const p = clamp(m.cd[id] / (m.cdMax[id] || 1), 0, 1); ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(x, y + bh * (1 - p), bw, bh * p, 9); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(m.cd[id].toFixed(1), x + bw / 2, y + bh / 2 + 8); ctx.textAlign = 'left'; }
  }
  const xr = x0 + total + 14; const lol = INPUT.scheme === 'lol';
  const small = (yy, label, cd) => { ctx.fillStyle = 'rgba(14,20,36,.92)'; rr(xr, yy, 140, 20, 6); ctx.fill(); ctx.strokeStyle = '#2f3b5c'; ctx.stroke(); ctx.fillStyle = cd > 0 ? '#6b7593' : '#e8ecf5'; ctx.font = `bold 11.5px ${FONT}`; ctx.fillText(label, xr + 8, yy + 14); if (cd > 0) { ctx.textAlign = 'right'; ctx.fillText(cd.toFixed(1), xr + 134, yy + 14); ctx.textAlign = 'left'; } };
  if (lol) { ctx.font = `11px ${FONT}`; ctx.fillStyle = INPUT.attacking ? '#ffb36b' : '#7d88a6'; ctx.fillText(INPUT.attacking ? '⚔ 普攻中（右鍵地面或 S 停止）' : '右鍵敵人＝普攻・A 攻擊・S 停止', xr, y - 8); }
  small(y, 'Space 跳躍' + (m.air ? (m.jumps >= 2 ? '（已二段）' : '（可二段）') : ''), 0);
  small(y + 23, (lol ? 'D' : 'Shift') + ' 閃避', Math.max(0, m.dodgeCd || 0));
  small(y + 46, (lol ? 'F' : 'Tab') + ' 換下一隻', s.switchCd);
  if (allPPOut(m)) { ctx.fillStyle = '#ffb36b'; ctx.font = `bold 13px ${FONT}`; ctx.fillText('PP 全部用完：任何技能鍵都會使出「掙扎」', x0, y - 8); }
  const lx = 16, ly = H - 92; ctx.font = `12px ${FONT}`; const items = G.log.slice(-5);
  items.forEach((l, i) => { ctx.globalAlpha = .45 + .55 * (i + 1) / items.length; ctx.fillStyle = l.c; let t = l.t; while (ctx.measureText(t).width > x0 - 30 && t.length > 2) t = t.slice(0, -1); ctx.fillText(t, lx, ly + i * 17); }); ctx.globalAlpha = 1;
}
function drawHUD() {
  drawPanel(G.sides[G.me], 16, 8); drawPanel(G.sides[1 - G.me], W - 16 - 380, 8);
  ctx.textAlign = 'center'; ctx.font = `bold 22px ${FONT}`; ctx.fillStyle = '#e8ecf5'; const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60); ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, W / 2, 34);
  ctx.font = `bold 13px ${FONT}`; ctx.fillStyle = '#cfd6e6'; ctx.fillText(`${MAP.emoji} ${MAP.name}`, W / 2, 56);
  if (G.weather) { ctx.font = `bold 13px ${FONT}`; ctx.fillStyle = G.weather.type === 'RAIN' ? '#8fb8ff' : '#ffc46b'; ctx.fillText(`${G.weather.type === 'RAIN' ? '☂ 下雨' : '☀ 大晴天'}　${Math.max(0, G.weather.t).toFixed(1)}s`, W / 2, 76); }
  else { ctx.font = `12px ${FONT}`; ctx.fillStyle = '#7d88a6'; ctx.fillText(G.net === 'local' ? `${DIFF[G.diff].n}・H 說明・Esc 暫停` : `連線對戰・房號 ${NET.code}${NET.ping ? `・${NET.ping}ms` : ''}`, W / 2, 76); }
  ctx.textAlign = 'left';
  drawSkillBar();
  if (G.paused && document.getElementById('help').classList.contains('hidden')) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = `bold 40px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('暫停中', W / 2, H / 2); ctx.font = `16px ${FONT}`; ctx.fillText('按 Esc 繼續', W / 2, H / 2 + 34); ctx.textAlign = 'left'; }
  if (NET.lost && G.net !== 'local') { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, H / 2 - 40, W, 80); ctx.fillStyle = '#ffb36b'; ctx.font = `bold 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('與對手的連線中斷了', W / 2, H / 2 + 8); ctx.textAlign = 'left'; }
}
