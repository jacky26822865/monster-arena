'use strict';
// =====================================================================
// 3D 場景（Three.js r128）：場地、特效、鏡頭、範圍指示
// =====================================================================
const R3 = { maps: null, lastG: undefined, shake: 0, hq: true, mapId: null };
const cv = document.getElementById('cv'), ctx = cv.getContext('2d'); cv.width = W; cv.height = H;
const stage = document.getElementById('stage');
function w3(x, h, y) { return new THREE.Vector3(x - W / 2, h, y - 375); }
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H); const w = Math.floor(W * s), h = Math.floor(H * s);
  stage.style.setProperty('--s', s); stage.style.width = w + 'px'; stage.style.height = h + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  if (R3.renderer) { R3.renderer.setSize(w, h); if (R3.composer) { R3.composer.setPixelRatio(R3.renderer.getPixelRatio()); R3.composer.setSize(w, h); } }
}
addEventListener('resize', fit);

function makeDotTex() { const dc = document.createElement('canvas'); dc.width = dc.height = 64; const dx = dc.getContext('2d'); const dg = dx.createRadialGradient(32, 32, 0, 32, 32, 32); dg.addColorStop(0, 'rgba(255,255,255,1)'); dg.addColorStop(.4, 'rgba(255,255,255,.6)'); dg.addColorStop(1, 'rgba(255,255,255,0)'); dx.fillStyle = dg; dx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(dc); }
function flatRing(inner, outer, color, op, seg) { const ms = new THREE.Mesh(new THREE.RingGeometry(inner, outer, seg || 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); ms.rotation.x = -Math.PI / 2; return ms; }
function flatDisc(color, op) { const ms = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); ms.rotation.x = -Math.PI / 2; return ms; }

(function initThree() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.position = 'absolute'; renderer.domElement.style.left = '0'; renderer.domElement.style.top = '0';
  stage.insertBefore(renderer.domElement, cv);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a0f1c'); scene.fog = new THREE.Fog('#0a0f1c', 1500, 2800);
  const camera = new THREE.PerspectiveCamera(42, W / H, 10, 7000); camera.position.set(0, 900, 800); camera.lookAt(0, 0, 0);
  const hemi = new THREE.HemisphereLight('#c4d8ff', '#1b2236', .8); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', .95); sun.position.set(-320, 900, 420); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -760, right: 760, top: 480, bottom: -480, near: 100, far: 2400 }); sun.shadow.bias = -.0006; scene.add(sun); scene.add(sun.target);
  const ringP = flatRing(36, 42, '#5cc8ff', .75, 48); ringP.position.y = 1.2; scene.add(ringP);
  const ringE = flatRing(36, 42, '#ff6b6b', .6, 48); ringE.position.y = 1.2; scene.add(ringE);
  const cross = new THREE.Group(); const cr = flatRing(11, 14, '#8fdcff', .85, 32); cross.add(cr); const cd = flatDisc('#8fdcff', .85); cd.scale.setScalar(3); cross.add(cd); cross.position.y = 2; scene.add(cross);
  const moveMark = flatRing(10, 16, '#7dffb0', .9, 32); moveMark.position.y = 2; moveMark.visible = false; scene.add(moveMark);
  const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#8fdcff', transparent: true, opacity: .3 })); scene.add(aimLine);
  // 範圍指示
  const ind = new THREE.Group(); scene.add(ind);
  const indRange = flatRing(.985, 1, '#ffffff', .5, 96); indRange.position.y = 2.5; ind.add(indRange);
  const rectG = new THREE.PlaneGeometry(1, 1); rectG.translate(0, .5, 0);
  const indRect = new THREE.Mesh(rectG, new THREE.MeshBasicMaterial({ color: '#8fdcff', transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide })); indRect.rotation.x = -Math.PI / 2;
  const indRectG = new THREE.Group(); indRectG.add(indRect); indRectG.position.y = 2.6; ind.add(indRectG);
  const indSectorG = new THREE.Group(); indSectorG.position.y = 2.6; ind.add(indSectorG);
  const indCircle = new THREE.Group(); const icd = flatDisc('#8fdcff', .22); const icr = flatRing(.94, 1, '#bfeaff', .9); indCircle.add(icd, icr); indCircle.position.y = 2.7; ind.add(indCircle);
  const indTarget = flatRing(34, 44, '#7dffb0', .9, 40); indTarget.position.y = 2.8; ind.add(indTarget);
  ind.visible = false;
  // 粒子
  const dotTex = makeDotTex(); const MAXP = 2500;
  const mkPts = size => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); p.frustumCulled = false; scene.add(p); return p; };
  const points = mkPts(11), points2 = mkPts(30);
  const lights = []; for (let i = 0; i < 5; i++) { const l = new THREE.PointLight('#ffffff', 0, 420, 2); scene.add(l); lights.push(l); }
  // 雨
  const NR = 420, rg = new THREE.BufferGeometry(), rp = new Float32Array(NR * 6); const aw = AR.x1 - AR.x0, ah = AR.y1 - AR.y0;
  for (let i = 0; i < NR; i++) { rp[i * 6] = Math.random() * aw + AR.x0 - W / 2; rp[i * 6 + 1] = Math.random() * 500; rp[i * 6 + 2] = Math.random() * ah + AR.y0 - 375; }
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#9cc4ff', transparent: true, opacity: .45 })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  let composer = null, bloom = null;
  try { if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass) { composer = new THREE.EffectComposer(renderer); composer.addPass(new THREE.RenderPass(scene, camera)); bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), .7, .45, .9); composer.addPass(bloom); } } catch (e) { composer = null; }
  const dyn = new THREE.Group(); scene.add(dyn);
  Object.assign(R3, { renderer, scene, camera, hemi, sun, ringP, ringE, cross, moveMark, aimLine, ind, indRange, indRect, indRectG, indSectorG, indCircle, indTarget, points, points2, lights, li: 0, composer, bloom, dotTex, rain, dyn, NR, MAXP,
    ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v: new THREE.Vector3(), camPos: camera.position.clone(), camLook: new THREE.Vector3(), sectorArc: null });
  buildArena(MAPS[0]); fit();
})();
function setHQ(on) { R3.hq = on; R3.renderer.setPixelRatio(on ? Math.min(devicePixelRatio || 1, 2) : 1); R3.sun.castShadow = on; const el = document.getElementById('hq'); if (el) el.checked = on; try { localStorage.setItem('ma_hq', on ? '1' : '0'); } catch (e) {} fit(); }

// ---------- 場地 ----------
function buildArena(map) {
  const { scene } = R3;
  if (R3.arena) { scene.remove(R3.arena); disposeObj(R3.arena); }
  const g = new THREE.Group(); R3.arena = g; scene.add(g); R3.mapId = map.id; R3.lava = [];
  scene.background = new THREE.Color(map.bg); scene.fog.color.set(map.fog || map.bg);
  const bright = (map.bloomT || .9) > .95; scene.fog.near = bright ? 2200 : 1500; scene.fog.far = bright ? 4500 : 2800;
  R3.hemi.color.set(map.hemi[0]); R3.hemi.groundColor.set(map.hemi[1]); R3.hemiBase = map.hemi[2]; R3.sunBase = map.sun; R3.sunColor = map.sunColor || '#ffffff';
  if (R3.bloom) R3.bloom.threshold = map.bloomT || .9;
  const aw = AR.x1 - AR.x0, ah = AR.y1 - AR.y0, cx = (AR.x0 + AR.x1) / 2 - W / 2, cz = (AR.y0 + AR.y1) / 2 - 375;
  const fc = document.createElement('canvas'); fc.width = aw; fc.height = ah; const c = fc.getContext('2d');
  const gr = c.createRadialGradient(aw / 2, ah / 2, 40, aw / 2, ah / 2, 720); gr.addColorStop(0, map.floor[0]); gr.addColorStop(1, map.floor[1]); c.fillStyle = gr; c.fillRect(0, 0, aw, ah);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * .05})`; const s = 2 + Math.random() * 6; c.fillRect(Math.random() * aw, Math.random() * ah, s, s); }
  c.strokeStyle = map.grid; c.lineWidth = 2; for (let x = 0; x <= aw; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ah); c.stroke(); } for (let y = 0; y <= ah; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(aw, y); c.stroke(); }
  c.strokeStyle = map.line; c.lineWidth = 4; c.beginPath(); c.arc(aw / 2, ah / 2, 110, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(aw / 2, 0); c.lineTo(aw / 2, ah); c.stroke(); c.lineWidth = 6; c.strokeRect(3, 3, aw - 6, ah - 6);
  const tex = new THREE.CanvasTexture(fc); tex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(aw, ah), new THREE.MeshStandardMaterial({ map: tex, roughness: map.ice ? .25 : .85, metalness: map.ice ? .15 : 0 })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true; g.add(floor);
  if (map.void) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(aw, 70, ah), new THREE.MeshStandardMaterial({ color: shade(map.floor[1], -.25), roughness: .9 })); side.position.set(cx, -35.5, cz); side.receiveShadow = true; g.add(side);
    const under = new THREE.Mesh(new THREE.ConeGeometry(Math.min(aw, ah) * .6, 420, 8), new THREE.MeshStandardMaterial({ color: shade(map.floor[1], -.4), flatShading: true })); under.rotation.x = Math.PI; under.position.set(cx, -280, cz); under.scale.set(aw / ah, 1, 1); g.add(under);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: .55 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -700; g.add(sea);
    for (let i = 0; i < 24; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.dotTex, color: '#ffffff', transparent: true, opacity: .8, depthWrite: false })); const a = Math.random() * Math.PI * 2, rr = 900 + Math.random() * 900; s.position.set(Math.cos(a) * rr, -250 - Math.random() * 300, Math.sin(a) * rr * .7); s.scale.setScalar(300 + Math.random() * 400); g.add(s); }
  } else {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({ color: shade(map.floor[1], -.45), roughness: 1 })); outer.rotation.x = -Math.PI / 2; outer.position.y = -2; outer.receiveShadow = true; g.add(outer);
    const wallM = new THREE.MeshStandardMaterial({ color: map.wall, roughness: .7 }), edgeM = new THREE.MeshBasicMaterial({ color: map.edge });
    for (const [wx, wz, px, pz] of [[aw + 32, 16, cx, AR.y0 - 375 - 8], [aw + 32, 16, cx, AR.y1 - 375 + 8], [16, ah, AR.x0 - W / 2 - 8, cz], [16, ah, AR.x1 - W / 2 + 8, cz]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(wx, 26, wz), wallM); b.position.set(px, 13, pz); b.castShadow = b.receiveShadow = true; g.add(b);
      const e = new THREE.Mesh(new THREE.BoxGeometry(wx + .5, 3, wz + .5), edgeM); e.position.set(px, 27, pz); g.add(e);
    }
  }
  for (const p of map.obs) g.add(buildObstacle(p));
  for (const l of map.lava || []) {
    const lg = new THREE.Group(); lg.position.set(l.x - W / 2, 0, l.y - 375);
    const crust = flatDisc('#2a1410', 1); crust.scale.setScalar(l.r * 1.12); crust.position.y = 2; crust.renderOrder = 1; lg.add(crust);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(l.r, 48), new THREE.MeshBasicMaterial({ color: '#ff5a10', depthWrite: false })); lava.rotation.x = -Math.PI / 2; lava.position.y = 3.5; lava.renderOrder = 2; lg.add(lava);
    const core = flatDisc('#ffd060', .8); core.scale.setScalar(l.r * .55); core.position.y = 5; core.renderOrder = 3; lg.add(core);
    const pl = new THREE.PointLight('#ff6a20', 1.4, l.r * 5, 2); pl.position.y = 40; lg.add(pl);
    g.add(lg); R3.lava.push({ l, lava, core, pl });
  }
}
function buildObstacle(p) {
  const o = new THREE.Group(); o.position.set(p.x - W / 2, 0, p.y - 375); const add = m => { m.castShadow = true; m.receiveShadow = true; o.add(m); return m; };
  if (p.k === 'tree') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(p.r * .45, p.r * .6, 90, 8), new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: .9 }))).position.y = 45;
    const leafM = new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: .8, flatShading: true });
    for (const [y, s] of [[110, 1.9], [150, 1.5], [185, 1.0]]) add(new THREE.Mesh(new THREE.IcosahedronGeometry(p.r * s, 1), leafM)).position.y = y;
  } else if (p.k === 'crystal') {
    const m = new THREE.MeshStandardMaterial({ color: '#bfefff', roughness: .1, metalness: .2, transparent: true, opacity: .85, emissive: new THREE.Color('#5fc8ff'), emissiveIntensity: .25, flatShading: true });
    add(new THREE.Mesh(new THREE.CylinderGeometry(p.r * .8, p.r, p.top - 10, 6), m)).position.y = (p.top - 10) / 2;
    const tip = add(new THREE.Mesh(new THREE.ConeGeometry(p.r * .8, 22, 6), m)); tip.position.y = p.top + 1;
    for (let i = 0; i < 3; i++) { const s = add(new THREE.Mesh(new THREE.ConeGeometry(p.r * .35, p.top * .6, 5), m)); const a = i * 2.1; s.position.set(Math.cos(a) * p.r * .9, p.top * .25, Math.sin(a) * p.r * .9); s.rotation.set(Math.cos(a) * .4, 0, -Math.sin(a) * .4); }
  } else if (p.k === 'column') {
    const m = new THREE.MeshStandardMaterial({ color: '#e6d5b0', roughness: .8 });
    add(new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.15, p.r * 1.2, 10, 12), m)).position.y = 5;
    add(new THREE.Mesh(new THREE.CylinderGeometry(p.r * .85, p.r * .9, p.top - 20, 12), m)).position.y = 10 + (p.top - 20) / 2;
    const cap = add(new THREE.Mesh(new THREE.BoxGeometry(p.r * 2.2, 10, p.r * 2.2), m)); cap.position.y = p.top - 5;
    if (p.top < 60) cap.rotation.set(.12, .5, .08);
  } else {
    const h = p.top - 10;
    add(new THREE.Mesh(new THREE.CylinderGeometry(p.r * .92, p.r * 1.12, h, 9), new THREE.MeshStandardMaterial({ color: '#4c556e', roughness: .85, flatShading: true }))).position.y = h / 2;
    add(new THREE.Mesh(new THREE.CylinderGeometry(p.r * .7, p.r * .95, 10, 9), new THREE.MeshStandardMaterial({ color: '#5b6684', roughness: .7, flatShading: true }))).position.y = h + 5;
  }
  return o;
}

// ---------- 投射物外觀 ----------
function boltGeo(n) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); return g; }
function zig(geo, ax, ay, az, bx, by, bz, amp) { const pa = geo.attributes.position, n = pa.count; for (let i = 0; i < n; i++) { const t = i / (n - 1), j = (i === 0 || i === n - 1) ? 0 : amp; pa.setXYZ(i, ax + (bx - ax) * t + (Math.random() * 2 - 1) * j, ay + (by - ay) * t + (Math.random() * 2 - 1) * j * .6, az + (bz - az) * t + (Math.random() * 2 - 1) * j); } pa.needsUpdate = true; }
function makeProj(p) {
  const g = new THREE.Group(), u = g.userData, t = p.mv.type, col = new THREE.Color(p.color); u.type = t;
  const core = new THREE.Mesh(new THREE.SphereGeometry(Math.max(4, p.r * .6), 14, 10), new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), .6) })); g.add(core);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.dotTex, color: p.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(p.r * 6); g.add(gl); u.gl = gl;
  const add = o => { g.add(o); return o; };
  if (t === 'WATER') u.spin = add(new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.1, p.r * .22, 8, 24), new THREE.MeshStandardMaterial({ color: '#9fd0ff', emissive: new THREE.Color('#3b7cff'), emissiveIntensity: .7, transparent: true, opacity: .8 })));
  else if (t === 'ICE') { u.spin = add(new THREE.Mesh(new THREE.OctahedronGeometry(p.r * 1.25, 0), new THREE.MeshStandardMaterial({ color: '#e8fdff', emissive: new THREE.Color('#7fe7ff'), emissiveIntensity: .9, flatShading: true, transparent: true, opacity: .9 }))); u.spin.scale.set(.7, .7, 1.6); }
  else if (t === 'GRASS') { u.orb = add(new THREE.Group()); for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(p.r * .7, 10, 8), new THREE.MeshStandardMaterial({ color: '#8de36a', emissive: new THREE.Color('#2f9e2f'), emissiveIntensity: .8 })); l.scale.set(.35, .12, 1); const a = i / 3 * Math.PI * 2; l.position.set(Math.cos(a) * p.r * 1.2, Math.sin(a) * p.r * 1.2, 0); l.rotation.z = a; u.orb.add(l); } }
  else if (t === 'ELECTRIC') u.bolts = [0, 1].map(() => add(new THREE.Line(boltGeo(7), new THREE.LineBasicMaterial({ color: '#fff6a0', transparent: true, opacity: .95, blending: THREE.AdditiveBlending }))));
  else if (t === 'FIRE') u.spin = add(new THREE.Mesh(new THREE.IcosahedronGeometry(p.r * .95, 1), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, wireframe: true })));
  else { u.spin = add(new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.15, 1.8, 6, 28), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending }))); core.material.color = col.clone().lerp(new THREE.Color('#ffffff'), .25); }
  if (p.mv.power === 0) u.mark = add(new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.5, 1.2, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .7 })));
  return g;
}
function updProj(p, g, dt) {
  const u = g.userData, t = u.type; g.position.set(p.x - W / 2, p.h, p.y - 375); g.rotation.y = Math.atan2(p.vx, p.vy);
  u.gl.scale.setScalar(p.r * (5.5 + Math.sin(G.t * 30) * .8));
  if (u.spin) { u.spin.rotation.x += dt * 7; u.spin.rotation.z += dt * 9; }
  if (u.orb) u.orb.rotation.z += dt * 14;
  if (u.mark) { u.mark.rotation.y += dt * 5; u.mark.rotation.x = Math.PI / 2; }
  if (u.bolts) u.bolts.forEach(b => zig(b.geometry, 0, 0, -p.r * 1.6, 0, 0, p.r * 1.6, p.r * .9));
  const bx = -p.vx / p.sp, by = -p.vy / p.sp;
  if (t === 'FIRE') { emitP(p.x, p.y, p.h, '#ff8a2a', .35, { big: 1, vz: 40 }); emitP(p.x + bx * 8, p.y + by * 8, p.h, '#ffd36b', .3, { vz: 70 }); }
  else if (t === 'ELECTRIC') { if (Math.random() < .7) emitP(p.x, p.y, p.h, '#fff6a0', .2, { vx: (Math.random() * 2 - 1) * 160, vy: (Math.random() * 2 - 1) * 160, vz: (Math.random() * 2 - 1) * 120 }); }
  else if (t === 'ICE') emitP(p.x, p.y, p.h, '#e8fdff', .5, { vz: -10 });
  else if (t === 'WATER') emitP(p.x, p.y, p.h, '#8fc4ff', .45, { g: 600, vz: 80 + Math.random() * 80 });
  else emitP(p.x, p.y, p.h, p.color, .35, { big: Math.random() < .3 ? 1 : 0 });
}
function flashAt(x, h, y, c, k) { const l = R3.lights[R3.li++ % R3.lights.length]; l.position.set(x - W / 2, h + 20, y - 375); l.color.set(c); l.intensity = Math.max(l.intensity, k); }
function syncList(list, map, make, upd) {
  const seen = new Set();
  for (const o of list) { let ms = map.get(o); if (!ms) { ms = make(o); map.set(o, ms); R3.dyn.add(ms); } upd(o, ms); seen.add(o); }
  for (const [o, ms] of map) if (!seen.has(o)) { R3.dyn.remove(ms); disposeObj(ms); map.delete(o); }
}
function makeFx(f) {
  const g = new THREE.Group(); g.position.set(f.x - W / 2, 0, f.y - 375); const u = g.userData;
  if (f.k === 'ghost') { const s = new THREE.Mesh(new THREE.SphereGeometry(f.R * 1.25, 14, 10), new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.y = f.z + f.R * 1.3; g.add(s); u.gh = s; }
  if (f.k === 'shock') { const rg = flatRing(.8, 1, f.color, .9); rg.position.y = f.z; g.add(rg); u.rg2 = rg; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.dotTex, color: f.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.y = f.z; g.add(sp); u.sp = sp; }
  if (f.k === 'boom') {
    R3.shake = Math.max(R3.shake, f.type === 'ELECTRIC' ? 11 : 9); flashAt(f.x, 40, f.y, f.color, 6);
    if (f.type === 'ELECTRIC') u.bolts = [0, 1, 2].map(() => { const l = new THREE.Line(boltGeo(14), new THREE.LineBasicMaterial({ color: '#fffbd0', transparent: true, blending: THREE.AdditiveBlending })); g.add(l); return l; });
    const fire = f.type === 'FIRE', rock = f.type === 'ROCK';
    for (let i = 0; i < 46; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * f.R * 2.2; emitP(f.x + Math.cos(a) * f.R * .3, f.y + Math.sin(a) * f.R * .3, 10, i % 4 === 0 ? '#ffffff' : fire ? (i % 2 ? '#ff7a1a' : '#ffd36b') : rock ? (i % 2 ? '#c9a35a' : '#7a6440') : f.color, .5 + Math.random() * .5, { big: i % 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: fire ? 250 + Math.random() * 450 : 150 + Math.random() * 350, g: fire ? 120 : 700 }); }
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(s); u.s = s;
  }
  if (f.k === 'ring') { R3.shake = Math.max(R3.shake, f.type === 'GROUND' ? 13 : 8); }
  if (f.k === 'ring2') flashAt(f.x, 40, f.y, f.color, 2.5);
  if (f.k === 'swipe') {
    const z = f.z || 0;
    for (const [a0, a1, col, op, y] of [[.45, 1, f.color, .85, 22], [.8, 1.05, '#ffffff', .8, 30]]) { const rg = new THREE.Mesh(new THREE.RingGeometry(f.range * a0, f.range * a1, 28, 1, -(f.ang + f.arc / 2), f.arc), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); rg.rotation.x = -Math.PI / 2; rg.position.y = z + y; g.add(rg); (u.sw = u.sw || []).push([rg, op]); }
    for (let i = 0; i < 14; i++) { const a = f.ang - f.arc / 2 + f.arc * Math.random(), rr = f.range * (.6 + Math.random() * .45); emitP(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, z + 24, i % 2 ? f.color : '#ffffff', .35, { vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, vz: 60 }); }
  }
  if (f.k === 'ring' || f.k === 'ring2') { const rg = flatRing(f.k === 'ring' ? .84 : .94, 1, f.color, .9); rg.position.y = 2; g.add(rg); u.rg = rg; if (f.k === 'ring') { const d = flatDisc(f.color, .18); d.position.y = 1.5; g.add(d); u.d = d; } }
  return g;
}
function updFx(f, g) {
  const p = Math.min(1, f.t / f.dur), u = g.userData;
  if (u.gh) { u.gh.material.opacity = .35 * (1 - p); u.gh.scale.setScalar(1 - p * .3); }
  if (u.rg2) { u.rg2.scale.setScalar(Math.max(.01, f.R * (.3 + p))); u.rg2.material.opacity = .9 * (1 - p); u.sp.scale.setScalar(f.R * 2.2 * (1 - p * .5)); u.sp.material.opacity = 1 - p; }
  if (u.bolts) u.bolts.forEach((b, i) => { zig(b.geometry, (Math.random() * 2 - 1) * 20, 700, (Math.random() * 2 - 1) * 20, (Math.random() * 2 - 1) * f.R * .4, 0, (Math.random() * 2 - 1) * f.R * .4, 26 + i * 10); b.material.opacity = p < .6 ? (Math.random() < .75 ? 1 : .2) : (1 - p) * 2; });
  if (u.s) { u.s.scale.setScalar(f.R * (.6 + p * .5)); u.s.position.y = f.R * .25; u.s.material.opacity = (1 - p) * .6; }
  if (u.sw) for (const [rg, op] of u.sw) { rg.material.opacity = op * (1 - p); rg.scale.setScalar(.85 + p * .25); }
  if (u.rg) {
    const R = f.k === 'ring' ? f.R * p : f.R * p + 20; u.rg.scale.setScalar(Math.max(.01, R)); u.rg.material.opacity = .9 * (1 - p * .6); if (u.d) { u.d.scale.setScalar(Math.max(.01, R)); u.d.material.opacity = .18 * (1 - p); }
    if (f.k === 'ring') for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2;
      if (f.type === 'GROUND') emitP(f.x + Math.cos(a) * R, f.y + Math.sin(a) * R, 6, i ? '#c9a35a' : '#7a6440', .8, { big: 1, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, vz: 250 + Math.random() * 350, g: 1300 });
      else if (f.type === 'ICE') { const b = a + p * 4; emitP(f.x + Math.cos(b) * R, f.y + Math.sin(b) * R, 10 + Math.random() * 60, i ? '#e8fdff' : '#7fe7ff', .6, { big: i === 0 ? 1 : 0, vx: -Math.sin(b) * 260, vy: Math.cos(b) * 260, vz: 30 }); }
      else emitP(f.x + Math.cos(a) * R, f.y + Math.sin(a) * R, 8, f.color, .4, { big: i === 0 ? 1 : 0, vz: 120 }); }
    if (f.k === 'ring2' && Math.random() < .9) { const a = f.t * 14 + Math.random(); emitP(f.x + Math.cos(a) * 40, f.y + Math.sin(a) * 40, 10 + p * 90, Math.random() < .5 ? f.color : '#ffffff', .5, { vz: 160, big: Math.random() < .3 ? 1 : 0 }); }
  }
}
function sectorGeo(arc) { const g = new THREE.RingGeometry(0, 1, 40, 1, -arc / 2, arc); return g; }

// ---------- 每一幀 ----------
function render3D(dt) {
  const T = performance.now() / 1000;
  if (G && R3.mapId !== MAP.id) buildArena(MAP);
  if (!G && R3.mapId !== (window.previewMapId || 'star')) buildArena(mapById(window.previewMapId || 'star'));
  if (R3.lastG !== G) { for (const ch of [...R3.dyn.children]) { R3.dyn.remove(ch); disposeObj(ch); } R3.maps = { proj: new Map(), zone: new Map(), fx: new Map() }; R3.lastG = G; if (G) for (const s of G.sides) for (const m of s.team) m.model = null; }
  for (const lv of R3.lava) { const k = .5 + .5 * Math.sin(T * 2 + lv.l.x); lv.core.material.opacity = .55 + .35 * k; lv.pl.intensity = 1.1 + .6 * k; if (G && Math.random() < .25) emitP(lv.l.x + (Math.random() * 2 - 1) * lv.l.r * .7, lv.l.y + (Math.random() * 2 - 1) * lv.l.r * .7, 4, Math.random() < .5 ? '#ff7a1a' : '#ffd060', 1, { vz: 70 + Math.random() * 60, big: Math.random() < .3 ? 1 : 0 }); }
  if (G) {
    const me = G.me;
    for (const s of G.sides) s.team.forEach((m, i) => { if (!m.model) { m.model = buildModel(m); R3.dyn.add(m.model); } const on = i === s.idx && !m.fainted; m.model.visible = on; if (on) poseModel(m, m.model, dt, G.t); });
    syncList(G.projs, R3.maps.proj, makeProj, (p, g) => updProj(p, g, dt));
    if (G.shakeReq) { R3.shake = Math.max(R3.shake, G.shakeReq); G.shakeReq = 0; }
    for (const fl of G.flashes) { flashAt(fl.x, fl.z, fl.y, fl.c, fl.big ? 4 : 2.2); G.cfx.push({ k: 'shock', x: fl.x, y: fl.y, z: fl.z, R: fl.big ? 90 : 55, color: fl.c, t: 0, dur: fl.big ? .38 : .26 });
      for (let i = 0; i < (fl.big ? 26 : 12); i++) { const a = Math.random() * Math.PI * 2, v = 150 + Math.random() * (fl.big ? 420 : 240); emitP(fl.x, fl.y, fl.z, i % 3 ? fl.c : '#ffffff', .35 + Math.random() * .25, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: (Math.random() * 2 - 1) * v * .7, g: 500 }); } }
    G.flashes.length = 0;
    for (const l of R3.lights) l.intensity *= Math.pow(.0005, dt);
    syncList(G.zones, R3.maps.zone, z => { const g = new THREE.Group(); const d = flatDisc(z.color, .15); d.scale.setScalar(z.R); g.add(d); g.add(flatRing(z.R - 4, z.R, z.color, .85)); const pr = flatRing(.9, 1, z.color, .9); g.add(pr);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(z.R * .35, z.R * .35, 700, 20, 1, true), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = 350; g.add(beam);
        g.position.set(z.x - W / 2, 1.6, z.y - 375); g.userData = { d, pr, beam }; return g; },
      (z, g) => { const p = Math.min(1, z.t / z.delay); g.userData.pr.scale.setScalar(Math.max(.01, z.R * p)); g.userData.d.material.opacity = .1 + p * .3; g.userData.beam.material.opacity = p > .75 ? (p - .75) * 2.4 : 0; });
    syncList(G.fx.concat(G.cfx), R3.maps.fx, makeFx, updFx);
    const P = activeOf(me), E = activeOf(1 - me);
    R3.ringP.visible = !P.fainted; R3.ringP.position.set(P.x - W / 2, Math.max(1.2, groundH(P.x, P.y) + 1.2), P.y - 375);
    R3.ringE.visible = !E.fainted; R3.ringE.position.set(E.x - W / 2, Math.max(1.2, groundH(E.x, E.y) + 1.2), E.y - 375);
    const hov = INPUT.hover || INPUT.attacking; R3.ringE.scale.setScalar(hov ? 1.12 + .06 * Math.sin(T * 10) : 1); R3.ringE.material.opacity = hov ? .95 : .6; stage.style.cursor = INPUT.touch ? 'default' : (INPUT.hover ? 'pointer' : 'crosshair');
    const showAim = !P.fainted && !G.over && !INPUT.touch; R3.cross.visible = R3.aimLine.visible = showAim && INPUT.scheme !== 'lol';
    R3.cross.position.x = mouse.x - W / 2; R3.cross.position.z = mouse.y - 375; R3.cross.rotation.y = T * 1.5;
    const ap = R3.aimLine.geometry.attributes.position; ap.setXYZ(0, P.x - W / 2, 3, P.y - 375); ap.setXYZ(1, mouse.x - W / 2, 3, mouse.y - 375); ap.needsUpdate = true;
    updateIndicators(P, E);
    if (INPUT.moveTo && !P.fainted) { R3.moveMark.visible = true; R3.moveMark.position.x = INPUT.moveTo.x - W / 2; R3.moveMark.position.z = INPUT.moveTo.y - 375; const k = 1 + .2 * Math.sin(T * 10); R3.moveMark.scale.setScalar(k); } else R3.moveMark.visible = false;
    const wt = G.weather && G.weather.type;
    R3.sun.intensity += ((wt === 'SUN' ? R3.sunBase * 1.3 : wt === 'RAIN' ? R3.sunBase * .5 : R3.sunBase) - R3.sun.intensity) * Math.min(1, dt * 3);
    R3.sun.color.set(wt === 'SUN' ? '#ffe2b0' : wt === 'RAIN' ? '#a8c0ff' : R3.sunColor);
    R3.hemi.intensity = wt === 'RAIN' ? R3.hemiBase * .7 : R3.hemiBase; R3.rain.visible = wt === 'RAIN';
    for (const m of [P, E]) if (!m.fainted && m.hitFlash > .13) R3.shake = Math.max(R3.shake, m === P ? 7 : 4);
    const lolCam = INPUT.scheme === 'lol' && !INPUT.touch; const wE = lolCam ? .12 : .38;
    let tx = P.x, ty = P.y; if (!P.fainted && !E.fainted) { tx = P.x + (E.x - P.x) * wE; ty = P.y + (E.y - P.y) * wE; }
    const d = (P.fainted || E.fainted) ? 600 : dist(P, E), k = lolCam ? 1.08 : clamp(d / 760, .92, 1.3);
    const pz = Math.max(0, P.z || 0);
    const want = new THREE.Vector3(tx - W / 2, 560 * k + pz * .25, ty - 375 + 520 * k), look = new THREE.Vector3(tx - W / 2, 20 + pz * .3, ty - 375 - 20);
    R3.camPos.lerp(want, Math.min(1, dt * 3.5)); R3.camLook.lerp(look, Math.min(1, dt * 4.5));
    R3.shake *= Math.pow(.02, dt);
    R3.camera.position.copy(R3.camPos).add(new THREE.Vector3((Math.random() - .5) * R3.shake, (Math.random() - .5) * R3.shake, (Math.random() - .5) * R3.shake));
    R3.camera.lookAt(R3.camLook);
    ambient(dt);
  } else {
    R3.ringP.visible = R3.ringE.visible = R3.cross.visible = R3.aimLine.visible = R3.moveMark.visible = R3.rain.visible = false; R3.ind.visible = false;
    const a = T * .1; R3.camera.position.set(Math.sin(a) * 1150, 720, Math.cos(a) * 950); R3.camera.lookAt(0, 0, 0); R3.camPos.copy(R3.camera.position);
  }
  const P1 = R3.points.geometry.attributes, P2 = R3.points2.geometry.attributes; let n1 = 0, n2 = 0; const tc = new THREE.Color();
  if (G) for (const p of G.parts) { const a = Math.max(0, p.life / p.max); tc.set(p.c); if (p.big) { if (n2 >= R3.MAXP) continue; P2.position.setXYZ(n2, p.x - W / 2, p.z || 10, p.y - 375); P2.color.setXYZ(n2, tc.r * a, tc.g * a, tc.b * a); n2++; } else { if (n1 >= R3.MAXP) continue; P1.position.setXYZ(n1, p.x - W / 2, p.z || 10, p.y - 375); P1.color.setXYZ(n1, tc.r * a, tc.g * a, tc.b * a); n1++; } }
  P1.position.needsUpdate = P1.color.needsUpdate = P2.position.needsUpdate = P2.color.needsUpdate = true; R3.points.geometry.setDrawRange(0, n1); R3.points2.geometry.setDrawRange(0, n2);
  if (R3.rain.visible) { const rp = R3.rain.geometry.attributes.position; for (let i = 0; i < R3.NR; i++) { let y = rp.getY(i * 2) - 900 * dt; if (y < 0) y += 500; const x = rp.getX(i * 2), z = rp.getZ(i * 2); rp.setXYZ(i * 2, x, y, z); rp.setXYZ(i * 2 + 1, x - 4, y + 20, z); } rp.needsUpdate = true; }
  if (R3.hq && R3.composer) R3.composer.render(); else R3.renderer.render(R3.scene, R3.camera);
}
function ambient(dt) {
  const a = MAP.amb; if (!a) return; const rx = () => AR.x0 + Math.random() * (AR.x1 - AR.x0), ry = () => AR.y0 + Math.random() * (AR.y1 - AR.y0);
  if (a === 'ember' && Math.random() < .5) emitP(rx(), ry(), 5, Math.random() < .5 ? '#ff7a1a' : '#ffb347', 2, { vz: 60, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30 });
  if (a === 'snow') for (let i = 0; i < 2; i++) emitP(rx(), ry(), 300, '#ffffff', 3, { vz: -100, vx: 30, vy: 10 });
  if (a === 'leaf' && Math.random() < .25) emitP(rx(), ry(), 220, Math.random() < .5 ? '#8fd16a' : '#e8d070', 4, { vz: -55, vx: 60, vy: 20, big: 1 });
  if (a === 'sand' && Math.random() < .6) emitP(AR.x0, ry(), 10 + Math.random() * 80, '#f0dcae', 2.5, { vx: 500, vy: 0, vz: 0 });
  if (a === 'cloud' && Math.random() < .08) emitP(rx(), ry(), -40, '#ffffff', 4, { big: 1, vz: 15, vx: 20 });
}
// 範圍指示（INPUT.aiming = {i, mv}）
function updateIndicators(P, E) {
  const A = INPUT.aiming; const vis = !!(A && !P.fainted && !G.over); R3.ind.visible = vis; if (!vis) return;
  const mv = A.mv, mode = castMode(mv), range = moveRange(mv), pz = Math.max(0, groundH(P.x, P.y));
  R3.ind.position.set(P.x - W / 2, pz, P.y - 375);
  R3.indRange.visible = range > 0; R3.indRange.scale.setScalar(Math.max(1, range));
  const ang = Math.atan2(mouse.y - P.y, mouse.x - P.x);
  R3.indRectG.visible = false; R3.indSectorG.visible = false; R3.indCircle.visible = false; R3.indTarget.visible = false;
  const col = TYPES[mv.type].c;
  if (mode === 'dir') {
    if (mv.shape === 'melee') { const arc = (mv.arc || 100) * Math.PI / 180; if (R3.sectorArc !== arc) { R3.indSectorG.clear(); const s = new THREE.Mesh(sectorGeo(arc), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide })); s.rotation.x = -Math.PI / 2; R3.indSectorG.add(s); R3.sectorArc = arc; R3.sectorMesh = s; } R3.sectorMesh.material.color.set(col); R3.indSectorG.visible = true; R3.indSectorG.scale.setScalar(range); R3.indSectorG.rotation.y = -ang; }
    else { R3.indRectG.visible = true; const wdt = mv.shape === 'dash' ? P.r * 2 : Math.max(16, (mv.r || 12) * accScale(mv) * 2); R3.indRect.scale.set(wdt, range, 1); R3.indRectG.rotation.y = -ang - Math.PI / 2; R3.indRect.material.color.set(col); }
  } else if (mode === 'point') {
    let dx = mouse.x - P.x, dy = mouse.y - P.y; const d = Math.hypot(dx, dy) || 1; if (d > range) { dx *= range / d; dy *= range / d; }
    R3.indCircle.visible = true; R3.indCircle.position.set(dx, 2.7, dy); const rr = mv.shape === 'blink' ? P.r * 1.3 : (mv.radius || 75) * accScale(mv); R3.indCircle.scale.setScalar(rr); R3.indCircle.children[0].material.color.set(col);
  } else if (mode === 'self') {
    if (mv.shape === 'aoeSelf') { R3.indCircle.visible = true; R3.indCircle.position.set(0, 2.7, 0); R3.indCircle.scale.setScalar(range); R3.indCircle.children[0].material.color.set(col); R3.indRange.visible = false; }
  } else if (mode === 'unit') {
    if (E && !E.fainted) { const inR = dist(P, E) <= range + E.r; R3.indTarget.visible = true; R3.indTarget.position.set(E.x - P.x, 2.8 + Math.max(0, groundH(E.x, E.y)) - pz, E.y - P.y); R3.indTarget.material.color.set(inR ? '#7dffb0' : '#ff7a7a'); }
  }
}
function updateMouseWorld() { R3.ray.setFromCamera(mouseNDC, R3.camera); const pt = new THREE.Vector3(); if (R3.ray.ray.intersectPlane(R3.plane, pt)) { mouse.x = pt.x + W / 2; mouse.y = pt.z + 375; } }
function prj(x, h, y) { R3.v.set(x - W / 2, h, y - 375).project(R3.camera); return { X: (R3.v.x + 1) / 2 * W, Y: (1 - R3.v.y) / 2 * H, ok: R3.v.z < 1 }; }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawOverlay() {
  for (const s of G.sides) {
    const m = s.team[s.idx]; if (m.fainted || !m.model) continue; const u = m.model.userData;
    const fl = u.float ? 10 : 0; const top = prj(m.x, u.top + fl + 12 + (m.z || 0), m.y); if (!top.ok) continue;
    const bw = 58, by = top.Y - 6, mine = isMe(s.i);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(top.X - bw / 2 - 1, by - 1, bw + 2, 7, 3); ctx.fill();
    const pc = m.hp / m.maxhp; ctx.fillStyle = pc > .5 ? '#5cd68a' : pc > .2 ? '#e8c95a' : '#ff5c5c'; rr(top.X - bw / 2, by, bw * pc, 5, 2); ctx.fill();
    ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(m.name, top.X, by - 5); ctx.fillStyle = mine ? '#8fdcff' : '#ff9c9c'; ctx.fillText(m.name, top.X, by - 5);
    if (m.status) { ctx.font = `bold 11px ${FONT}`; ctx.fillStyle = STATUSN[m.status][1]; ctx.strokeText(STATUSN[m.status][0], top.X, by + 18); ctx.fillText(STATUSN[m.status][0], top.X, by + 18); }
    if (m.status === 'SLP') { ctx.fillStyle = '#cfd8ff'; ctx.font = `bold ${15 + Math.sin(G.t * 3) * 2}px ${FONT}`; ctx.fillText('Z z', top.X + 34, by - 14); }
    if (m.cast && MOVES[m.cast.id] && !MOVES[m.cast.id].basic) { const c = prj(m.x, m.r * 1.3 + (m.z || 0), m.y), p = 1 - m.cast.t / m.cast.total; ctx.strokeStyle = TYPES[MOVES[m.cast.id].type].c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.X, c.Y, 40, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke(); }
    ctx.textAlign = 'left';
  }
  ctx.textAlign = 'center';
  for (const t of G.texts) { const p = prj(t.x, t.h, t.y); if (!p.ok) continue; ctx.globalAlpha = 1 - Math.max(0, (t.t - .6) / (t.dur - .6)); ctx.font = `900 ${t.size}px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t.txt, p.X, p.Y); ctx.fillStyle = t.c; ctx.fillText(t.txt, p.X, p.Y); }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
