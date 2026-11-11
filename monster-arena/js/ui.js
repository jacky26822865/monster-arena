'use strict';
// =====================================================================
// 介面：標題、連線大廳、選角、場地、怪獸工坊、結算
// =====================================================================
const $ = id => document.getElementById(id);
const SCREENS = ['title', 'online', 'select', 'creator', 'mapModal', 'end', 'help'];
function show(id) { for (const s of SCREENS) if (!['help', 'mapModal'].includes(s)) $(s).classList.toggle('hidden', s !== id); document.body.classList.toggle('inbattle', !id); }
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600); }
function toggleHelp(on) { const h = $('help'); if (on === undefined) on = h.classList.contains('hidden'); h.classList.toggle('hidden', !on); if (G && G.net === 'local') G.paused = on || G.userPause; }
function chip(t) { return `<span class="chip" style="background:${TYPES[t].c}">${TYPES[t].n}</span>`; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 預覽用的小型 3D 舞台 ----------
class Preview {
  constructor(canvas, w, h) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!canvas.dataset.snap });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.setSize(w, h, false);
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(32, w / h, 1, 2000); this.cam.position.set(0, 95, 230); this.cam.lookAt(0, 42, 0);
    this.scene.add(new THREE.HemisphereLight('#dfe9ff', '#2a3350', 1.0)); const d = new THREE.DirectionalLight('#ffffff', .9); d.position.set(-120, 220, 160); this.scene.add(d);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(70, 76, 8, 48), new THREE.MeshStandardMaterial({ color: '#25345a', roughness: .6 })); ped.position.y = -4; this.scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(73, 1.5, 6, 64), new THREE.MeshBasicMaterial({ color: '#5cc8ff' })); ring.rotation.x = Math.PI / 2; this.scene.add(ring);
    this.model = null; this.mon = null; this.t = 0;
  }
  set(sp, photo) {
    if (this.model) { this.scene.remove(this.model); disposeObj(this.model); }
    this.mon = { sp, types: sp.types, r: 26, photo, x: W / 2, y: 375, z: 0, vx: 0, vy: 0, face: Math.PI / 2, side: 0, status: null, cast: null, squash: 0, flip: 0, invT: 0, hitFlash: 0 };
    this.model = buildModel(this.mon); this.scene.add(this.model); this.t = 0;
    const h = this.model.userData.top; this.cam.position.set(0, h * .9 + 40, 150 + h * 1.4); this.cam.lookAt(0, h * .45, 0);
  }
  frame(dt, spin) {
    if (!this.model) return; this.t += dt; const m = this.mon;
    const walk = (this.t % 6) > 3.5; m.vx = walk ? 160 : 0; m.face = Math.PI / 2 + (spin ? Math.sin(this.t * .6) * .9 : 0);
    poseModel(m, this.model, dt, this.t); this.model.visible = true; this.renderer.render(this.scene, this.cam);
  }
  snap(sp, photo) { this.set(sp, photo); this.mon.face = Math.PI / 2 - .5; this.model.rotation.y = Math.PI / 2 - this.mon.face; poseModel(this.mon, this.model, 0, 0); this.renderer.render(this.scene, this.cam); return this.renderer.domElement.toDataURL('image/png'); }
}
let PV = null, CR = null, SNAP = null; const thumbs = {};
function thumb(id) { const sp = speciesById(id); if (!sp) return ''; const key = id + '|' + (photoSel[id] || '').length; if (thumbs[key]) return thumbs[key]; if (!SNAP) { const c = document.createElement('canvas'); c.dataset.snap = '1'; SNAP = new Preview(c, 200, 200); } return (thumbs[key] = SNAP.snap(sp, photoSel[id])); }

// ---------- 照片 ----------
const photoSel = {}; try { Object.assign(photoSel, JSON.parse(localStorage.getItem('ma_photos') || '{}')); } catch (e) {}
function loadPhoto(file, cb) { if (!file) return; const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const k = c.getContext('2d'); const s = Math.min(img.width, img.height); k.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S); cb(c.toDataURL('image/jpeg', .85)); }; img.src = fr.result; }; fr.readAsDataURL(file); }
function setPhoto(id, url) { if (url) photoSel[id] = url; else delete photoSel[id]; try { localStorage.setItem('ma_photos', JSON.stringify(photoSel)); } catch (e) { toast('照片太大，無法儲存在瀏覽器'); } }

// ---------- 選角 ----------
const SEL = { mode: 'solo', cur: 'leo', picks: [], natures: {}, map: 'random', filter: null };
let myName = ''; try { myName = localStorage.getItem('ma_nick') || ''; } catch (e) {}
function natureOf(id) { return SEL.natures[id] || speciesById(id).nature; }
function buildFilters() {
  $('typeFilter').innerHTML = `<button data-t="" class="${!SEL.filter ? 'on' : ''}">全部</button>` + TYPE_KEYS.map(t => `<button data-t="${t}" class="${SEL.filter === t ? 'on' : ''}" style="${SEL.filter === t ? `background:${TYPES[t].c};border-color:${TYPES[t].c}` : ''}">${TYPES[t].n}</button>`).join('') + `<button data-t="custom" class="${SEL.filter === 'custom' ? 'on' : ''}">自訂／模組</button>`;
  $('typeFilter').querySelectorAll('button').forEach(b => b.onclick = () => { SEL.filter = b.dataset.t || null; buildFilters(); buildRoster(); });
}
function buildRoster() {
  const list = SPECIES.filter(s => !SEL.filter || (SEL.filter === 'custom' ? !BUILTIN_SPECIES.has(s.id) : s.types.includes(SEL.filter)));
  $('rosterGrid').innerHTML = list.map(s => { const i = SEL.picks.indexOf(s.id); return `<div class="tile ${s.id === SEL.cur ? 'cur' : ''} ${i >= 0 ? 'picked' : ''}" data-id="${s.id}" data-order="${i + 1}">${!BUILTIN_SPECIES.has(s.id) ? '<span class="cus">自訂</span>' : ''}<img alt="" src="${thumb(s.id)}"><div class="nm">${esc(s.name)}</div><div class="tp">${s.types.map(chip).join('')}</div></div>`; }).join('') || '<p class="dim">這個分類還沒有怪獸。</p>';
  $('rosterGrid').querySelectorAll('.tile').forEach(t => { t.onclick = () => { SEL.cur = t.dataset.id; buildRoster(); showDetail(); if (innerWidth < 980 || innerHeight < 620) $('pvCanvas').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; t.ondblclick = () => { togglePick(t.dataset.id); }; });
}
function drawRadar(sp) {
  const c = $('radar'), k = c.getContext('2d'); k.clearRect(0, 0, c.width, c.height); const cx = 100, cy = 100, R = 66; const keys = ['hp', 'atk', 'def', 'spe', 'spd', 'spa'];
  const pt = (i, v) => { const a = -Math.PI / 2 + i / 6 * Math.PI * 2; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  k.strokeStyle = 'rgba(160,180,230,.18)'; for (const f of [.33, .66, 1]) { k.beginPath(); keys.forEach((_, i) => { const [x, y] = pt(i, f); i ? k.lineTo(x, y) : k.moveTo(x, y); }); k.closePath(); k.stroke(); }
  k.beginPath(); keys.forEach((s, i) => { const [x, y] = pt(i, Math.min(1, sp.base[s] / 150)); i ? k.lineTo(x, y) : k.moveTo(x, y); }); k.closePath();
  const col = TYPES[sp.types[0]].c; k.fillStyle = col + '66'; k.fill(); k.strokeStyle = col; k.lineWidth = 2; k.stroke();
  k.fillStyle = '#cfd6e6'; k.font = `12px ${FONT}`; k.textAlign = 'center'; keys.forEach((s, i) => { const [x, y] = pt(i, 1.22); k.fillText(STATN[s], x, y + 4); });
  const tot = STAT_KEYS.reduce((a, s) => a + sp.base[s], 0); k.fillStyle = '#ffd86b'; k.font = `bold 12px ${FONT}`; k.textAlign = 'left'; k.fillText('合計 ' + tot, 4, 14);
}
function showDetail() {
  const sp = speciesById(SEL.cur) || SPECIES[0]; SEL.cur = sp.id;
  $('pvName').textContent = sp.name; $('dTypes').innerHTML = sp.types.map(chip).join(' ');
  $('dSrc').textContent = BUILTIN_SPECIES.has(sp.id) ? '' : (sp.src === 'custom' ? '怪獸工坊' : '模組' + (sp.author ? '・' + sp.author : ''));
  $('dAbility').innerHTML = `特性 <b>${esc(sp.ability)}</b>：${ABIL[sp.ability] || ''}`;
  const nat = natureOf(sp.id); $('dNature').innerHTML = NATURES.map(n => `<option value="${n[0]}" ${n[0] === nat ? 'selected' : ''}>${n[0]}${n[1] ? `（+${STATN[n[1]]} −${STATN[n[2]]}）` : '（無修正）'}</option>`).join('');
  const st = calcStats(sp, nat), nn = NATURES.find(n => n[0] === nat);
  $('dStats').innerHTML = STAT_KEYS.map(k => `<div class="r"><span class="dim">${STATN[k]}</span><span class="bar"><i style="width:${Math.min(100, sp.base[k] / 1.5)}%;background:${sp.base[k] >= 100 ? '#5cd68a' : sp.base[k] >= 75 ? '#e8c95a' : '#e8885a'}"></i></span><span class="v ${nn[1] === k ? 'up' : nn[2] === k ? 'dn' : ''}">${sp.base[k]} → ${st[k]}</span></div>`).join('') + `<div class="dim small">種族值 → Lv.50 實際值（對戰中 HP ×${$('lenSel').value}＝${Math.round(st.hp * $('lenSel').value)}）</div>`;
  drawRadar(sp);
  const keys = INPUT.scheme === 'lol' ? ['Q', 'W', 'E', 'R'] : ['1', '2', '3', '4'];
  const fake = { stats: st, st: { spe: 0 }, status: null }; const bm = MOVES['b_' + sp.types[0] + (PHYSICAL.has(sp.types[0]) ? '_m' : '_r')];
  $('dSpeed').innerHTML = `🏃 移動速度 <b>${Math.round(moveSpeed(fake))}</b>・⚔ 普攻（${bm.shape === 'melee' ? '近戰' : '遠程'}，${TYPES[bm.type].n}系）每 <b>${atkInterval(fake).toFixed(2)}</b> 秒・技能冷卻 ×<b>${cdMult(fake).toFixed(2)}</b>`;
  $('dMoves').innerHTML = sp.moves.map((id, i) => { const m = MOVES[id]; return `<div class="mv"><span class="key">${keys[i]}</span><span class="n">${chip(m.type)} ${esc(m.name)} <span class="dim" style="font-weight:400">${category(m)}</span><span class="mode">${CAST_LABEL[castMode(m)]}</span></span><span class="s">威力 ${m.power || '—'}・命中 ${m.acc || '—'}・PP ${m.pp}${moveRange(m) ? '・範圍 ' + Math.round(moveRange(m)) : ''}</span><span class="d">${moveDesc(m)}</span></div>`; }).join('');
  $('dPhotoClear').classList.toggle('hidden', !photoSel[sp.id]);
  const inTeam = SEL.picks.includes(sp.id); $('addBtn').textContent = inTeam ? '移出隊伍' : (SEL.picks.length >= 3 ? '隊伍已滿（3 隻）' : '加入隊伍'); $('addBtn').disabled = !inTeam && SEL.picks.length >= 3;
  if (PV) PV.set(sp, photoSel[sp.id]);
}
function togglePick(id) { const i = SEL.picks.indexOf(id); if (i >= 0) SEL.picks.splice(i, 1); else if (SEL.picks.length < 3) SEL.picks.push(id); refreshTeam(); buildRoster(); showDetail(); if (SEL.mode === 'online') { NET.ready = false; sendPick(); } }
function refreshTeam() {
  $('teamSlots').innerHTML = [0, 1, 2].map(i => { const id = SEL.picks[i]; const sp = id && speciesById(id); return sp ? `<div class="slot on" data-i="${i}"><img src="${thumb(id)}" alt=""><span>${esc(sp.name)}</span><span class="x">×</span></div>` : `<div class="slot">第 ${i + 1} 隻</div>`; }).join('');
  $('teamSlots').querySelectorAll('.slot.on').forEach(s => s.onclick = () => togglePick(SEL.picks[+s.dataset.i]));
  const m = SEL.map === 'random' ? { emoji: '🎲', name: '隨機場地' } : mapById(SEL.map); $('mapBtn').textContent = `${m.emoji} ${m.name} ▾`;
  window.previewMapId = SEL.map === 'random' ? 'star' : SEL.map;
  updateGoBtn();
}
function updateGoBtn() {
  const b = $('goBtn'), full = SEL.picks.length === 3;
  if (SEL.mode === 'solo') { b.textContent = '開始對戰'; b.disabled = !full; return; }
  const opp = NET.opp; $('oppBadge').classList.remove('hidden');
  $('oppBadge').textContent = opp ? `對手：${opp.name}${NET.oppReady ? '（已準備）' : '（選角中）'}` : '等待對手加入…'; $('oppBadge').classList.toggle('ok', !!(opp && NET.oppReady));
  if (NET.role === 'host') { b.textContent = NET.ready ? (NET.oppReady ? '開始對戰！' : '等對手準備…') : '準備好了'; b.disabled = !full || (NET.ready && !NET.oppReady); }
  else { b.textContent = NET.ready ? '已準備（等房主開始）' : '準備好了'; b.disabled = !full; }
  $('mapBtn').disabled = NET.role !== 'host'; $('lenSel').disabled = NET.role !== 'host';
}
function teamPayload(net) { return SEL.picks.map(id => ({ id, nature: natureOf(id), photo: photoSel[id] ? (net ? shrinkPhoto(photoSel[id]) : photoSel[id]) : null })); }
const shrinkCache = {};
function shrinkPhoto(url) { if (shrinkCache[url]) return shrinkCache[url] === 1 ? null : shrinkCache[url]; shrinkCache[url] = 1; const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 128; c.getContext('2d').drawImage(img, 0, 0, 128, 128); shrinkCache[url] = c.toDataURL('image/jpeg', .8); sendPick(); }; img.src = url; return null; }
function sendPick() { if (SEL.mode !== 'online' || !NET.conn) return; NET.send({ t: 'pick', team: teamPayload(true), ready: NET.ready, defs: defsFor(SEL.picks) }); updateGoBtn(); }
function openSelect(mode) {
  SEL.mode = mode; $('modeBadge').textContent = mode === 'solo' ? '單人對戰' : `連線對戰・房號 ${NET.code}・你是${NET.role === 'host' ? '房主' : '挑戰者'}`;
  document.querySelectorAll('.solo-only').forEach(e => e.classList.toggle('hidden', mode !== 'solo'));
  $('oppBadge').classList.toggle('hidden', mode === 'solo'); if (mode === 'online') NET.ready = false;
  $('schemeSel').value = INPUT.scheme; $('hq').checked = R3.hq; $('castSel').value = INPUT.castStyle; $('castSel').parentElement.classList.toggle('hidden', INPUT.scheme !== 'lol');
  show('select'); if (!PV) PV = new Preview($('pvCanvas'), 460, 300); buildFilters(); buildRoster(); showDetail(); refreshTeam();
}
function buildMapModal() {
  const cards = [{ id: 'random', emoji: '🎲', name: '隨機', desc: '每場隨機抽一個場地', floor: ['#3a3f60', '#22263a'] }, ...MAPS];
  $('mapGrid').innerHTML = cards.map(m => `<div class="mapcard ${SEL.map === m.id ? 'on' : ''}" data-id="${m.id}"><div class="sw" style="background:linear-gradient(135deg,${m.floor[0]},${m.floor[1]})">${m.emoji}</div><div class="tx"><b>${m.name}</b><span>${m.desc}</span></div></div>`).join('');
  $('mapGrid').querySelectorAll('.mapcard').forEach(c => c.onclick = () => { SEL.map = c.dataset.id; $('mapModal').classList.add('hidden'); refreshTeam(); if (SEL.mode === 'online' && NET.role === 'host') NET.send({ t: 'cfg', map: SEL.map }); });
}
function resolveMap(id) { return id === 'random' ? randomMapId() : id; }
function startSolo() {
  const pool = SPECIES.map(s => s.id).filter(id => !SEL.picks.includes(id)).sort(() => Math.random() - .5);
  const ep = pool.slice(0, 3).map(id => ({ id, nature: speciesById(id).nature, photo: null }));
  const o = { teams: [teamPayload(false), ep], map: resolveMap(SEL.map), diff: $('diffSel').value, hpMult: +$('lenSel').value, net: 'local', me: 0, names: [myName || '你', '電腦'], ai: [false, true] };
  window.lastSolo = o; launch(o);
}
function launch(o) { INPUT.aiming = null; INPUT.moveTo = null; INPUT.pending = null; INPUT.lastDir = { x: o.me ? -1 : 1, y: 0 }; startBattle(o); show(null); $('end').classList.add('hidden'); }
function onGo() {
  if (SEL.mode === 'solo') return startSolo();
  if (!NET.ready) { NET.ready = true; sendPick(); return; }
  if (NET.role === 'host' && NET.oppReady && NET.oppTeam && NET.oppTeam.length === 3) {
    const map = resolveMap(SEL.map); const teams = [teamPayload(true), NET.oppTeam]; const names = [myName || '房主', NET.opp ? NET.opp.name : '挑戰者'];
    const defs = defsFor(SEL.picks.concat(NET.oppTeam.map(p => p.id)));
    const hpMult = +$('lenSel').value;
    NET.send({ t: 'start', teams, map, names, defs, hpMult }); NET.ready = NET.oppReady = false;
    launch({ teams, map, names, hpMult, net: 'host', me: 0, ai: [false, false] });
  }
}
// ---------- 連線回呼 ----------
function onNetStatus(t) { $('netStatus').textContent = t; }
function onLobbyUpdate() { if (NET.role === 'client' && NET.map) SEL.map = NET.map; if (!$('select').classList.contains('hidden')) { refreshTeam(); updateGoBtn(); } }
function onNetStart(m) { NET.ready = NET.oppReady = false; launch({ teams: m.teams, map: m.map, names: m.names, hpMult: clamp(+m.hpMult || 3, 1, 5), net: 'client', me: 1, ai: [false, false] }); }
function onNetLobby() { if (G && G.net !== 'local') { G = null; } openSelect('online'); }
function onNetLost() { toast('對手離線了'); if (G && G.net !== 'local' && !G.over) { G.over = true; G.winner = G.me; setTimeout(onBattleEnd, 800); } updateGoBtn(); }
function onBattleEnd() {
  if (!G) return; const won = G.winner === G.me;
  $('endTitle').textContent = NET.lost && G.net !== 'local' ? '對手離線' : won ? '勝利！' : '落敗…'; $('endTitle').style.color = won ? '#7dffb0' : '#ff8a8a';
  const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60); const mine = G.sides[G.me].team.filter(m => !m.fainted);
  $('endInfo').innerHTML = `場地 ${MAP.emoji} ${MAP.name}　對戰時間 ${mm}:${String(ss).padStart(2, '0')}${G.net !== 'client' ? `　造成傷害 ${G.stats.dealt}　受到傷害 ${G.stats.taken}` : ''}<br>我方剩餘：${mine.map(m => `${esc(m.name)}（${m.hp}/${m.maxhp}）`).join('、') || '無'}`;
  $('againBtn').textContent = G.net === 'local' ? '再戰一次' : '回到選角再戰';
  $('end').classList.remove('hidden');
}
// ---------- 怪獸工坊 ----------
const CRE = { editing: null };
function crDefault() { return { id: 'c' + Date.now().toString(36), name: '我的元素獸', types: ['FIRE'], base: { hp: 80, atk: 90, def: 80, spa: 90, spd: 80, spe: 90 }, ability: '烈心', nature: '認真', evs: { hp: 4, atk: 252, spe: 252 }, moves: ['flame', 'quick', 'wingdash', 'swords'], look: { body: 'round', parts: ['ears', 'flameTail'], legs: 'two', arms: true, acc: '#ffd25e' }, src: 'custom' }; }
const EV_PRESET = { atk: { hp: 4, atk: 252, spe: 252 }, spa: { hp: 4, spa: 252, spe: 252 }, tank: { hp: 252, def: 128, spd: 128 }, mix: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 } };
function evKey(evs) { for (const [k, v] of Object.entries(EV_PRESET)) if (JSON.stringify(v) === JSON.stringify(evs)) return k; return 'atk'; }
function openCreator() {
  show('creator'); if (!CR) CR = new Preview($('crCanvas'), 420, 380);
  const typeOpts = TYPE_KEYS.map(t => `<option value="${t}">${TYPES[t].n}</option>`).join('');
  $('cT1').innerHTML = typeOpts; $('cT2').innerHTML = '<option value="">（無）</option>' + typeOpts;
  $('cBody').innerHTML = Object.entries(BODIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('cAbility').innerHTML = Object.keys(ABIL).map(a => `<option>${a}</option>`).join('');
  $('cNature').innerHTML = NATURES.map(n => `<option value="${n[0]}">${n[0]}${n[1] ? `（+${STATN[n[1]]} −${STATN[n[2]]}）` : ''}</option>`).join('');
  $('cParts').innerHTML = Object.entries(PARTS).map(([k, v]) => `<label data-p="${k}"><input type="checkbox" value="${k}">${v}</label>`).join('');
  $('cParts').querySelectorAll('label').forEach(l => l.querySelector('input').onchange = () => { l.classList.toggle('on', l.querySelector('input').checked); crPreview(); });
  $('cStats').innerHTML = STAT_KEYS.map(k => `<div class="r"><span>${STATN[k]}</span><input type="range" min="5" max="160" data-s="${k}"><b data-v="${k}"></b></div>`).join('');
  const moveOpts = Object.values(MOVES).filter(m => m.id !== 'struggle' && !m.basic).sort((a, b) => a.type.localeCompare(b.type)).map(m => `<option value="${m.id}">[${TYPES[m.type].n}] ${m.name}（${category(m)} ${m.power || '—'}／${CAST_LABEL[castMode(m)]}）</option>`).join('');
  $('cMoves').innerHTML = [0, 1, 2, 3].map(i => `<label class="field">技能 ${i + 1}<select data-m="${i}">${moveOpts}</select></label>`).join('');
  document.querySelectorAll('#creator input,#creator select').forEach(el => { if (el.id !== 'cImport') el.addEventListener('input', crPreview); });
  crLoad(CRE.editing ? speciesById(CRE.editing) || crDefault() : crDefault()); crList();
}
function crLoad(sp) {
  CRE.editing = sp.src === 'custom' ? sp.id : null; CRE.id = sp.src === 'custom' ? sp.id : 'c' + Date.now().toString(36);
  $('cName').value = sp.name; $('cT1').value = sp.types[0]; $('cT2').value = sp.types[1] || ''; $('cBody').value = sp.look.body || 'round'; $('cLegs').value = sp.look.legs || 'two'; $('cArms').value = sp.look.arms ? '1' : '0'; $('cEye').value = sp.look.eye || 'normal';
  $('cColorAuto').checked = !sp.look.color; $('cColor').value = sp.look.color || TYPES[sp.types[0]].c; $('cAcc').value = sp.look.acc || '#ffffff';
  $('cParts').querySelectorAll('label').forEach(l => { const on = (sp.look.parts || []).includes(l.dataset.p); l.querySelector('input').checked = on; l.classList.toggle('on', on); });
  STAT_KEYS.forEach(k => { $('cStats').querySelector(`[data-s=${k}]`).value = sp.base[k]; });
  $('cAbility').value = sp.ability; $('cNature').value = sp.nature; $('cEv').value = evKey(sp.evs);
  sp.moves.forEach((m, i) => { const s = $('cMoves').querySelector(`[data-m="${i}"]`); if (s) s.value = m; });
  $('cJson').classList.add('hidden'); crPreview();
}
function crRead() {
  const types = [$('cT1').value]; if ($('cT2').value && $('cT2').value !== types[0]) types.push($('cT2').value);
  const base = {}; STAT_KEYS.forEach(k => base[k] = +$('cStats').querySelector(`[data-s=${k}]`).value);
  const parts = [...$('cParts').querySelectorAll('input:checked')].map(i => i.value);
  const look = { body: $('cBody').value, parts, legs: $('cLegs').value, arms: $('cArms').value === '1', eye: $('cEye').value, acc: $('cAcc').value }; if (!$('cColorAuto').checked) look.color = $('cColor').value;
  return { id: CRE.id, name: $('cName').value.trim() || '無名', types, base, ability: $('cAbility').value, nature: $('cNature').value, evs: Object.assign({}, EV_PRESET[$('cEv').value]), moves: [0, 1, 2, 3].map(i => $('cMoves').querySelector(`[data-m="${i}"]`).value), look, src: 'custom' };
}
function crPreview() {
  const sp = crRead(); let tot = 0; STAT_KEYS.forEach(k => { tot += sp.base[k]; $('cStats').querySelector(`[data-v=${k}]`).textContent = sp.base[k]; });
  $('cTotal').innerHTML = `合計 <b style="color:${tot > 600 ? '#ff8a8a' : '#ffd86b'}">${tot}</b> / 600${tot > 600 ? '（超過上限，請調低）' : ''}`; $('cSave').disabled = tot > 600;
  if (CR) CR.set(normSpecies(sp, 'custom'), photoSel[sp.id]);
}
function crList() { const list = SPECIES.filter(s => s.src === 'custom'); $('cList').innerHTML = list.map(s => `<div class="tile ${s.id === CRE.editing ? 'cur' : ''}" data-id="${s.id}"><img src="${thumb(s.id)}" alt=""><div class="nm">${esc(s.name)}</div></div>`).join('') || '<p class="dim small" style="grid-column:1/-1">還沒有，做一隻吧！</p>'; $('cList').querySelectorAll('.tile').forEach(t => t.onclick = () => crLoad(speciesById(t.dataset.id))); }
function crSave() { const sp = registerSpecies(crRead(), 'custom'); if (!sp) { toast('儲存失敗：' + (MOD_LOG[MOD_LOG.length - 1] || '')); return; } CRE.editing = sp.id; saveCustoms(); for (const k in thumbs) if (k.startsWith(sp.id + '|')) delete thumbs[k]; crList(); toast(`已儲存「${sp.name}」，可以在選角畫面找到`); }
function crExport() {
  const sp = normSpecies(crRead(), 'custom'); delete sp.src; const json = JSON.stringify({ name: sp.name + ' 模組', species: [sp] }, null, 2);
  const ta = $('cJson'); ta.value = json; ta.classList.remove('hidden'); ta.select();
  try { navigator.clipboard.writeText(json).then(() => toast('JSON 已複製')); } catch (e) {}
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = sp.id + '.json'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
}
function crImport(file) {
  if (!file) return; const fr = new FileReader();
  fr.onload = () => { try { const m = JSON.parse(fr.result); const mod = m.species ? m : { species: [m] }; for (const s of mod.species) s.src = 'custom'; let n = 0; for (const s of mod.species) if (registerSpecies(s, 'custom')) n++; if (mod.moves) registerMoves(mod.moves); saveCustoms(); crList(); toast(`匯入了 ${n} 隻`); } catch (e) { toast('JSON 格式錯誤'); } };
  fr.readAsText(file);
}
function crDelete() { if (!CRE.editing) return; const i = SPECIES.findIndex(s => s.id === CRE.editing); if (i >= 0) SPECIES.splice(i, 1); saveCustoms(); CRE.editing = null; crLoad(crDefault()); crList(); toast('已刪除'); }

// ---------- 事件綁定 ----------
function onPadStart() { if (!$('select').classList.contains('hidden') && !$('goBtn').disabled) onGo(); else if (!$('end').classList.contains('hidden')) $('againBtn').click(); }
function initUI() {
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'solo') openSelect('solo'); else if (g === 'online') { show('online'); $('nick').value = myName; } else if (g === 'creator') openCreator(); else if (g === 'help') toggleHelp(true); else if (g === 'title') { netLeave(); show('title'); }
  });
  $('roomRand').onclick = () => { $('room').value = Math.random().toString(36).slice(2, 8); };
  $('joinBtn').onclick = async () => {
    const code = $('room').value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''); myName = $('nick').value.trim().slice(0, 12) || '玩家';
    try { localStorage.setItem('ma_nick', myName); } catch (e) {}
    if (!code) { toast('請輸入房號'); return; } $('room').value = code; $('joinBtn').disabled = true;
    try { await netConnect(code, myName); NET.map = SEL.map; openSelect('online'); } catch (e) { onNetStatus('連線失敗：' + (e.message || e.type || e)); } finally { $('joinBtn').disabled = false; }
  };
  $('selBack').onclick = () => { if (SEL.mode === 'online') { netLeave(); show('online'); } else show('title'); };
  $('dNature').onchange = () => { SEL.natures[SEL.cur] = $('dNature').value; showDetail(); if (SEL.mode === 'online') sendPick(); };
  $('dPhoto').onchange = () => { const id = SEL.cur; loadPhoto($('dPhoto').files[0], url => { setPhoto(id, url); $('dPhoto').value = ''; buildRoster(); refreshTeam(); showDetail(); if (SEL.mode === 'online') sendPick(); }); };
  $('dPhotoClear').onclick = () => { setPhoto(SEL.cur, null); buildRoster(); refreshTeam(); showDetail(); if (SEL.mode === 'online') sendPick(); };
  $('addBtn').onclick = () => togglePick(SEL.cur);
  $('randTeam').onclick = () => { SEL.picks = SPECIES.map(s => s.id).sort(() => Math.random() - .5).slice(0, 3); refreshTeam(); buildRoster(); showDetail(); if (SEL.mode === 'online') { NET.ready = false; sendPick(); } };
  $('mapBtn').onclick = () => { buildMapModal(); $('mapModal').classList.remove('hidden'); }; $('mapClose').onclick = () => $('mapModal').classList.add('hidden');
  $('schemeSel').onchange = () => { setScheme($('schemeSel').value); showDetail(); $('castSel').parentElement.classList.toggle('hidden', INPUT.scheme !== 'lol'); };
  $('castSel').value = INPUT.castStyle; $('castSel').onchange = () => setCastStyle($('castSel').value);
  $('hq').onchange = () => setHQ($('hq').checked);
  try { const v = localStorage.getItem('ma_len'); if (v) $('lenSel').value = v; } catch (e) {}
  $('lenSel').onchange = () => { try { localStorage.setItem('ma_len', $('lenSel').value); } catch (e) {} showDetail(); };
  $('goBtn').onclick = onGo;
  $('helpClose').onclick = () => toggleHelp(false);
  $('againBtn').onclick = () => { $('end').classList.add('hidden'); if (G && G.net === 'local' && window.lastSolo) { const o = window.lastSolo; o.map = resolveMap(SEL.map); launch(o); } else { if (NET.conn) NET.send({ t: 'lobby' }); G = null; openSelect('online'); } };
  $('toSelBtn').onclick = () => { $('end').classList.add('hidden'); const online = G && G.net !== 'local'; if (online && NET.conn) NET.send({ t: 'lobby' }); G = null; openSelect(online && NET.conn ? 'online' : 'solo'); };
  $('toTitleBtn').onclick = () => { $('end').classList.add('hidden'); G = null; netLeave(); show('title'); };
  $('cSave').onclick = crSave; $('cNew').onclick = () => crLoad(crDefault()); $('cExport').onclick = crExport; $('cImport').onchange = () => { crImport($('cImport').files[0]); $('cImport').value = ''; }; $('cDelete').onclick = crDelete;
  $('cT1').addEventListener('change', () => { if ($('cColorAuto').checked) $('cColor').value = TYPES[$('cT1').value].c; });
  // 網址帶 ?room=xxx 直接帶入房號
  const q = new URLSearchParams(location.search); if (q.get('room')) { $('room').value = q.get('room'); }
}
