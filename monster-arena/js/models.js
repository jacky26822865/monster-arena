'use strict';
// =====================================================================
// 3D 模型：部件式程序化怪獸＋自訂照片貼臉＋GLB 外部模型
// =====================================================================
function M3(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c), roughness: .5, metalness: .05 }, o || {})); }
function mesh3(g, m, x, y, z) { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; return o; }
function limb3(a, b, rad, mat) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length(); const o = mesh3(new THREE.CylinderGeometry(rad * .75, rad, len, 7), mat); o.position.copy(A).add(B).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o; }
const BODY_SHAPE = { round: [1, 1, 1, 1], tall: [.9, 1.25, .9, 1.25], blob: [1.15, .78, 1.1, .78], wisp: [1, 1, 1, 1], shell: [1, 1, 1, 1] };

const photoTexCache = {};
function photoTex(url) {
  if (!url) return null; let c = photoTexCache[url];
  if (!c) { const img = new Image(); const tex = new THREE.Texture(img); img.onload = () => { tex.needsUpdate = true; }; img.src = url; c = photoTexCache[url] = { tex, img }; }
  return c.tex;
}
function photoImgOf(url) { const c = url && photoTexCache[url]; return c && c.img.complete && c.img.naturalWidth ? c.img : null; }

// m 至少要有 {sp, types, r, photo}
function buildModel(m) {
  const sp = m.sp, L = Object.assign({ body: 'round', parts: [], legs: 'two', arms: false, acc: '#ffffff' }, sp.look || {});
  const parts = new Set(L.parts || []);
  const c1 = L.color || TYPES[m.types[0]].c, c2 = TYPES[m.types[1] || m.types[0]].c, r = m.r || 26;
  const [sx, sy, sz, cyk] = BODY_SHAPE[L.body] || BODY_SHAPE.round, cy = r * cyk;
  const P = (dx, dy, dz) => [dx * r * sx, cy + dy * r * sy, dz * r * sz];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mats = []; const mk = (c, o) => { const x = M3(c, o); mats.push(x); return x; };
  const bodyM = mk(c1), darkM = mk(shade(c1, -.3)), accM = mk(L.acc, { roughness: .4 });
  const float = L.legs === 'none' || L.body === 'wisp';
  const u = { body, mats, float, top: cy + r * sy, legs: [], arms: [], wings: [] };
  const deco = [], eyesArr = [], addTop = h => { u.top = Math.max(u.top, h); };
  // 身體
  const torso = mesh3(new THREE.SphereGeometry(r, 28, 20), L.body === 'wisp' ? mk(c1, { transparent: true, opacity: .92 }) : bodyM, 0, cy, 0); torso.scale.set(sx, sy, sz); body.add(torso);
  if (L.body === 'wisp') { const sk = mesh3(new THREE.ConeGeometry(r * .95, r * 1.1, 16, 1, true), mk(c1, { side: THREE.DoubleSide, transparent: true, opacity: .85 }), 0, r * .25, 0); sk.rotation.x = Math.PI; body.add(sk); }
  let eye = { p: P(.36, .22, .82), s: 1, x: .36 * r * sx };
  if (L.body === 'shell') {
    const sh = mesh3(new THREE.SphereGeometry(r * 1.18, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), mk(L.acc, { flatShading: true, metalness: .4, roughness: .35 }), 0, r * .9, -r * .05); sh.scale.set(1, .9, 1.05); body.add(sh);
    const rim = mesh3(new THREE.TorusGeometry(r * 1.15, r * .1, 6, 12), mk(c2, { metalness: .5 }), 0, r * .9, -r * .05); rim.rotation.x = Math.PI / 2; body.add(rim);
    body.add(mesh3(new THREE.SphereGeometry(r * .5, 16, 12), bodyM, 0, r * .95, r * 1.1));
    eye = { p: [.2 * r, r * 1.08, r * 1.45], s: .6, x: .2 * r }; addTop(r * 2.1);
  }
  const add = o => { body.add(o); return o; };
  const cone = (rad, h, mat, pos, rx, rz, seg) => { const c = mesh3(new THREE.ConeGeometry(rad, h, seg || 8), mat, ...pos); if (rx) c.rotation.x = rx; if (rz) c.rotation.z = rz; return add(c); };
  const ball = (rad, mat, pos, scl) => { const b = mesh3(new THREE.SphereGeometry(rad, 14, 10), mat, ...pos); if (scl) b.scale.set(...scl); return add(b); };
  // 部件
  if (parts.has('belly')) deco.push(ball(r * .62, mk(m.types[1] ? c2 : shade(c1, .35)), P(0, -.18, .5), [sx, .9 * sy, .55 * sz]));
  if (parts.has('creamBelly')) deco.push(ball(r * .6, mk('#f4e6cf'), P(0, -.15, .5), [sx, .95 * sy, .55 * sz]));
  if (parts.has('mane')) { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const p = P(Math.cos(a) * .92, Math.sin(a) * .92, -.25); cone(r * .22, r * .75, accM, p, 0, a - Math.PI / 2, 6); } addTop(cy + r * sy * 1.2); }
  if (parts.has('ears')) for (const s of [-1, 1]) cone(r * .2, r * .45, darkM, P(s * .5, .85, .05), 0, -s * .3);
  if (parts.has('bigEars')) { for (const s of [-1, 1]) { cone(r * .3, r * .8, bodyM, P(s * .55, .85, 0), 0, -s * .35); cone(r * .17, r * .5, accM, P(s * .57, .87, .08), 0, -s * .35); } addTop(cy + r * sy * 1.5); }
  if (parts.has('roundEars')) for (const s of [-1, 1]) ball(r * .3, darkM, P(s * .65, .72, -.05));
  if (parts.has('sideEars')) for (const s of [-1, 1]) cone(r * .18, r * .5, darkM, P(s * .85, .55, 0), 0, -s * 1.1);
  if (parts.has('antlers')) { for (const s of [-1, 1]) { const b = P(s * .3, .75, 0); const q = (x, y, z) => [b[0] + s * x * r, b[1] + y * r, b[2] + z * r];
      add(limb3(b, q(.4, .85, -.1), r * .09, accM)); add(limb3(q(.4, .85, -.1), q(.85, 1.4, -.2), r * .07, accM)); add(limb3(q(.25, .55, -.05), q(0, 1.25, .05), r * .06, accM)); add(limb3(q(.65, 1.15, -.15), q(1.2, 1.05, -.1), r * .055, accM)); } addTop(cy + r * sy + r * 1.4); }
  if (parts.has('horns')) { for (const s of [-1, 1]) { const b = P(s * .35, .8, .2); const tip = [b[0] + s * r * .25, b[1] + r * .55, b[2] + r * .25]; add(limb3(b, tip, r * .12, accM)); cone(r * .1, r * .3, accM, [tip[0] + s * r * .05, tip[1] + r * .12, tip[2] + r * .1], .6, -s * .3); } addTop(cy + r * sy + r * .8); }
  if (parts.has('smallHorns')) for (const s of [-1, 1]) cone(r * .1, r * .32, mk('#f0e6c8'), P(s * .35, .88, .2), .3, -s * .3);
  if (parts.has('noseHorn')) cone(r * .2, r * .75, mk('#efe6d2'), P(0, .1, 1.0), 1.1);
  if (parts.has('crest')) { for (let i = -1; i <= 1; i++) cone(r * .12, r * .6, accM, P(i * .18, 1.02, -.1 - Math.abs(i) * .1), -.5, -i * .3, 5); addTop(cy + r * sy + r * .5); }
  if (parts.has('antenna')) { for (const s of [-1, 1]) { const b = P(s * .25, .9, .2); const tip = [b[0] + s * r * .3, b[1] + r * .7, b[2] + r * .35]; add(limb3(b, tip, r * .04, darkM)); ball(r * .12, accM, tip); } addTop(cy + r * sy + r * .8); }
  if (parts.has('leaf')) ball(r * .35, mk(m.types.includes('GRASS') ? '#78c850' : c2), P(0, 1.0, -.2), [1.3, .5, 1]);
  if (parts.has('gem')) { const g = mesh3(new THREE.OctahedronGeometry(r * .16, 0), mk(L.acc, { emissive: new THREE.Color(L.acc), emissiveIntensity: .9, metalness: .3, roughness: .2 }), ...P(0, .55, .88)); add(g); }
  if (parts.has('cap')) { const cp = mesh3(new THREE.SphereGeometry(r * 1.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), accM, 0, cy + r * sy * .35, 0); cp.scale.set(1, .75, 1); add(cp);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, e = .5 + (i % 2) * .25; ball(r * .17, mk('#fff8f0'), [Math.cos(a) * r * 1.2 * e, cy + r * sy * .35 + r * 1.05 * Math.sqrt(1 - e * e * .7) * .75, Math.sin(a) * r * 1.2 * e], [1, .45, 1]); } addTop(cy + r * sy * .35 + r * 1.1); }
  if (parts.has('wool')) { const wm = mk(L.acc); for (let i = 0; i < 16; i++) { const a = i * 2.39996, yy = .1 + (i / 16) * .85, rr = Math.sqrt(1 - yy * yy); ball(r * .36, wm, P(Math.cos(a) * rr * .95, yy * .95, Math.sin(a) * rr * .95 - .1)); } addTop(cy + r * sy * 1.25); }
  if (parts.has('flameHead')) { const fl = mesh3(new THREE.SphereGeometry(r * .42, 14, 10), new THREE.MeshStandardMaterial({ color: L.acc, emissive: new THREE.Color(L.acc), emissiveIntensity: 1.4, transparent: true, opacity: .9 }), ...P(0, 1.25, 0)); fl.scale.set(.75, 1.35, .75); add(fl); u.flame = fl; const pl = new THREE.PointLight(L.acc, .9, 260); pl.position.set(...P(0, 1.3, 0)); body.add(pl); addTop(cy + r * sy + r * .9); }
  if (parts.has('handOrbs')) for (const s of [-1, 1]) ball(r * .22, bodyM, P(s * 1.25, 0, .2));
  if (parts.has('finDorsal')) { const d = cone(r * .5, r * 1.0, accM, P(0, 1.0, -.15), -.35, 0, 4); d.scale.set(.28, 1, 1); addTop(cy + r * sy + r * .5); }
  if (parts.has('tailFin')) { const tail = new THREE.Group(); tail.position.set(...P(0, -.1, -.95)); const tf = mesh3(new THREE.ConeGeometry(r * .55, r * .8, 4), accM, 0, 0, -r * .3); tf.rotation.x = -Math.PI / 2; tf.scale.set(.25, 1, 1); tail.add(tf); add(tail); u.tail = tail; }
  if (parts.has('sideFins')) for (const s of [-1, 1]) { const f = ball(r * .5, darkM, P(s * .95, -.25, .1), [1, .16, .55]); f.rotation.z = s * .45; }
  if (parts.has('jaw')) deco.push(ball(r * .55, mk('#e8eef8'), P(0, -.28, .62), [1, .45, .6]));
  const flapper = (mat, scl, tipC) => { for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(...P(s * .75, .15, 0)); const wg = mesh3(new THREE.SphereGeometry(r, 16, 12), mat, s * r * 1.0, 0, -r * .1); wg.scale.set(...scl); pv.add(wg); if (tipC) { const tip = mesh3(new THREE.ConeGeometry(r * .3, r * .9, 4), tipC, s * r * 2.1, 0, -r * .25); tip.rotation.z = -s * Math.PI / 2; tip.scale.set(1, 1, .2); pv.add(tip); } add(pv); u.wings.push(pv); } };
  if (parts.has('wings')) flapper(mk(shade(c2, -.05)), [1.2, .12, .55], darkM);
  if (parts.has('batWings')) flapper(mk(shade(c2, -.25)), [1.45, .07, .75], mk('#1a1424'));
  if (parts.has('smallWings')) for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(...P(s * .35, .35, -.8)); const wg = mesh3(new THREE.SphereGeometry(r * .7, 12, 8), new THREE.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: .55, roughness: .1 }), s * r * .5, r * .2, -r * .2); wg.scale.set(1, .08, .5); pv.add(wg); add(pv); u.wings.push(pv); }
  if (parts.has('tailFeathers')) for (let i = -1; i <= 1; i++) cone(r * .14, r * .8, mk(shade(c2, -.05)), P(i * .2, -.2, -1.15), -Math.PI / 2 - .3, 0, 5);
  if (parts.has('beak')) deco.push(cone(r * .2, r * .55, mk('#ffcf4a'), P(0, .02, 1.12), Math.PI / 2));
  if (parts.has('snout')) { deco.push(ball(r * .36, mk('#f2fbff'), P(0, -.08, .86), [1, .75, .8])); deco.push(ball(r * .11, mk('#1a2030'), P(0, .05, 1.13))); }
  if (parts.has('fangs')) for (const s of [-1, 1]) deco.push(cone(r * .06, r * .22, mk('#ffffff'), P(s * .16, -.12, .95), Math.PI));
  if (parts.has('flameTail')) { const tail = new THREE.Group(); tail.position.set(...P(0, -.3, -.85)); tail.add(limb3([0, 0, 0], [0, r * .5, -r * .7], r * .08, bodyM)); tail.add(mesh3(new THREE.SphereGeometry(r * .22, 10, 8), mk('#ff9a3c', { emissive: new THREE.Color('#ff6a00'), emissiveIntensity: .8 }), 0, r * .55, -r * .78)); add(tail); u.tail = tail; }
  if (parts.has('longTail')) { const tail = new THREE.Group(); tail.position.set(...P(0, -.4, -.8)); for (let i = 0; i < 6; i++) tail.add(mesh3(new THREE.SphereGeometry(r * (.32 - i * .03), 12, 10), i > 3 ? accM : bodyM, 0, r * (i * i * .05 + i * .1), -r * i * .3)); add(tail); u.tail = tail; }
  if (parts.has('bigRoundEars')) { addTop(cy + r * sy * 1.75); for (const s of [-1, 1]) { const e = ball(r * .55, bodyM, P(s * .6, .98, -.08), [1, 1.18, .32]); e.rotation.z = -s * .38; const i = ball(r * .4, accM, P(s * .61, .97, .07), [1, 1.15, .28]); i.rotation.z = -s * .38; } }
  if (parts.has('stripes')) { const sm = mk(shade(c1, -.18)); for (let i = -1; i <= 1; i++) { const st = ball(r * .3, sm, P(i * .2, .8, .55), [.16, .05, .7]); st.rotation.x = -.95; st.rotation.y = i * .25; } }
  if (parts.has('pinkNose')) deco.push(ball(r * .09, mk('#f2a9b5'), P(0, .02, 1.0), [1.3, .9, 1]));
  if (parts.has('whiskers')) { const wm = new THREE.MeshBasicMaterial({ color: '#4a4550' }); for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { const b = P(s * .26, -.02, .93); const w = limb3(b, [b[0] + s * r * .85, b[1] + k * r * .16, b[2] - r * .05], r * .012, wm); w.castShadow = false; deco.push(add(w)); } }
  if (parts.has('acorn')) { const g = new THREE.Group(); g.position.set(...P(0, -.32, 1.02)); g.add(mesh3(new THREE.SphereGeometry(r * .24, 14, 10), mk('#d9a35c', { roughness: .4 }), 0, -r * .06, 0)); const cap = mesh3(new THREE.SphereGeometry(r * .26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mk('#8a5a32'), 0, r * .02, 0); cap.scale.set(1, .6, 1); g.add(cap); g.add(mesh3(new THREE.CylinderGeometry(r * .03, r * .04, r * .12, 6), mk('#6a4426'), 0, r * .2, 0)); g.children[0].scale.set(1, 1.15, 1); add(g); u.holding = true; }
  if (parts.has('bushyTail')) { const tail = new THREE.Group(); tail.position.set(...P(0, -.45, -.8)); const tm = mk(shade(c1, .08)); const t1 = mesh3(new THREE.SphereGeometry(r * .62, 16, 12), tm, 0, r * .5, -r * .45); t1.scale.set(.8, 1.35, .8); t1.rotation.x = -.45; tail.add(t1); const t2 = mesh3(new THREE.SphereGeometry(r * .5, 14, 10), tm, 0, r * 1.25, -r * .62); t2.scale.set(.85, 1.1, .85); tail.add(t2); add(tail); u.tail = tail; addTop(cy + r * .9); }
  if (parts.has('fluffyTail')) { const tail = new THREE.Group(); tail.position.set(...P(0, -.35, -.85)); const t1 = mesh3(new THREE.SphereGeometry(r * .55, 14, 10), bodyM, 0, r * .45, -r * .45); t1.scale.set(.8, 1.25, .8); t1.rotation.x = -.6; tail.add(t1); tail.add(mesh3(new THREE.SphereGeometry(r * .32, 12, 8), accM, 0, r * 1.05, -r * .85)); add(tail); u.tail = tail; }
  if (parts.has('spikes')) for (let i = 0; i < 4; i++) { const a = .5 + i * .32; cone(r * .14, r * .45, accM, P(0, Math.cos(a), -Math.sin(a)), -a, 0, 5); }
  if (parts.has('crystals')) { const ic = mk(L.acc, { transparent: true, opacity: .88, emissive: new THREE.Color('#7fe7ff'), emissiveIntensity: .25, flatShading: true }); for (const [x, h, y, z] of [[-.4, .7, .55, -.5], [0, .95, .6, -.6], [.4, .7, .55, -.5], [0, .6, .2, -.95]]) cone(r * .17, r * h, ic, P(x, y, z), -.6, 0, 5); }
  if (parts.has('shellSpikes')) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; cone(r * .13, r * .45, mk(c2, { metalness: .6, roughness: .3 }), [Math.cos(a) * r * .6, r * 1.85, Math.sin(a) * r * .6 - r * .05], 0, 0, 5); }
  if (parts.has('lavaCracks')) { const lm = new THREE.MeshBasicMaterial({ color: '#ff7a1a' }); for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, r * .035, 4, 40), lm); t.position.set(0, cy, 0); t.scale.set(sx, sy, sz); t.rotation.set(Math.random() * 3, Math.random() * 3, 0); add(t); } }
  // 眼睛
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .3 }), black = new THREE.MeshStandardMaterial({ color: '#0f121a', roughness: .2 });
  if (L.eye === 'dot') for (const s of [-1, 1]) { const e = mesh3(new THREE.SphereGeometry(r * .17 * eye.s, 16, 12), black, s * eye.x, eye.p[1], eye.p[2]); e.scale.set(1, 1.18, .6); add(e); const hl = mesh3(new THREE.SphereGeometry(r * .055 * eye.s, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), s * eye.x + r * .05, eye.p[1] + r * .07, eye.p[2] + r * .09); add(hl); eyesArr.push(e, hl); }
  else for (const s of [-1, 1]) { const e = mesh3(new THREE.SphereGeometry(r * .2 * eye.s, 14, 12), white, s * eye.x, eye.p[1], eye.p[2]); e.scale.set(1, 1.15, .7); add(e); const pu = mesh3(new THREE.SphereGeometry(r * .1 * eye.s, 10, 8), black, s * eye.x, eye.p[1] + r * .02, eye.p[2] + r * .15 * eye.s); add(pu); eyesArr.push(e, pu); }
  // 自訂照片貼臉
  const ph = photoTex(m.photo);
  if (ph) {
    const fc = L.body === 'shell' ? { c: [0, r * .95, r * 1.1], R: r * .5, s: [1, 1, 1] } : { c: [0, cy, 0], R: r, s: [sx, sy, sz] };
    const face = new THREE.Mesh(new THREE.SphereGeometry(fc.R * 1.015, 32, 20, Math.PI / 2 - .82, 1.64, Math.PI / 2 - 1.0, 1.62), mk('#d0d0d0', { map: ph, roughness: .75 }));
    face.position.set(...fc.c); face.scale.set(...fc.s); add(face); eyesArr.concat(deco).forEach(o => o.visible = false);
  }
  // 腿與手
  if (!float) {
    const lift = L.body === 'shell' ? r * .28 : r * .34; const inner = new THREE.Group(); while (body.children.length) inner.add(body.children[0]); inner.position.y = lift; body.add(inner); u.top += lift;
    const hipY = lift + r * .3, legM = parts.has('pinkPaws') ? mk('#f2b8c0') : darkM;
    const mkLeg = (x, z, rad, p) => { const g = new THREE.Group(); g.position.set(x, hipY, z); g.add(limb3([0, 0, 0], [0, -hipY * .82, 0], rad, legM)); const f = mesh3(new THREE.SphereGeometry(rad * 1.35, 10, 8), legM, 0, -hipY + rad * .75, rad * .6); f.scale.set(1, .65, 1.45); g.add(f); body.add(g); u.legs.push({ g, p }); };
    if (L.legs === 'four') { const w = r * .72 * sx; mkLeg(-w, r * .55, r * .2, 0); mkLeg(w, -r * .55, r * .2, 0); mkLeg(w, r * .55, r * .2, Math.PI); mkLeg(-w, -r * .55, r * .2, Math.PI); }
    else { mkLeg(r * .42 * sx, r * .05, r * .15, 0); mkLeg(-r * .42 * sx, r * .05, r * .15, Math.PI); }
    const gloves = parts.has('gloves'), blades = parts.has('blades');
    if (L.arms || blades) for (const s of [-1, 1]) {
      const g = new THREE.Group(); const sp0 = P(s * .88, -.05, .12); g.position.set(sp0[0], sp0[1] + lift, sp0[2]);
      g.add(limb3([0, 0, 0], [s * r * .18, -r * .42, r * .05], r * .12, bodyM));
      if (blades) { const bl = mesh3(new THREE.ConeGeometry(r * .18, r * 1.1, 4), mk(L.acc, { metalness: .7, roughness: .25 }), s * r * .2, -r * .45, r * .45); bl.rotation.x = Math.PI / 2 + .3; bl.scale.set(.35, 1, 1); g.add(bl); }
      else g.add(mesh3(new THREE.SphereGeometry(r * (gloves ? .3 : .17), 12, 10), gloves ? mk(L.acc, { roughness: .35 }) : legM, s * r * .2, -r * .48, r * .07));
      body.add(g); u.arms.push({ g, p: s > 0 ? Math.PI : 0, hold: !!u.holding });
    }
  }
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.5, 0), new THREE.MeshStandardMaterial({ color: '#c8f6ff', transparent: true, opacity: .45, roughness: .1, metalness: .2, flatShading: true, depthWrite: false })); ice.position.y = r; ice.visible = false; body.add(ice); u.ice = ice;
  const blob = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 24), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: .35, depthWrite: false })); blob.rotation.x = -Math.PI / 2; root.add(blob); u.blob = blob;
  body.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const scale = 1.3 * (sp.scale || 1); root.scale.setScalar(scale); u.top *= scale; u.scale = scale;
  root.userData = u;
  if (sp.model) attachGLB(root, sp);
  return root;
}

// ---------- 外部 GLB 模型（模組用） ----------
const glbCache = {};
function attachGLB(root, sp) {
  if (!THREE.GLTFLoader) return;
  const u = root.userData;
  const load = glbCache[sp.model] || (glbCache[sp.model] = new Promise((res, rej) => new THREE.GLTFLoader().load(sp.model, res, undefined, rej)));
  load.then(gltf => {
    const obj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj), size = new THREE.Vector3(); box.getSize(size);
    const k = (26 * 2.2) / Math.max(1e-3, size.y); obj.scale.setScalar(k);
    obj.position.y = -box.min.y * k; if (sp.modelYaw) obj.rotation.y = sp.modelYaw;
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) { u.mats.push(...(Array.isArray(o.material) ? o.material : [o.material]).filter(mt => mt.emissive)); } } });
    const holder = new THREE.Group(); holder.add(obj);
    for (const ch of [...u.body.children]) ch.visible = ch === u.ice;
    u.body.add(holder); u.glb = holder; u.legs = []; u.arms = []; u.wings = []; u.tail = null; u.flame = null;
    if (gltf.animations && gltf.animations.length) {
      u.mixer = new THREE.AnimationMixer(obj); const find = re => gltf.animations.find(a => re.test(a.name));
      const idle = find(/idle|stand/i) || gltf.animations[0], walk = find(/walk|run|move/i);
      u.acts = { idle: u.mixer.clipAction(idle), walk: walk ? u.mixer.clipAction(walk) : null }; u.acts.idle.play(); if (u.acts.walk) { u.acts.walk.play(); u.acts.walk.weight = 0; }
    }
  }).catch(e => console.warn('GLB 載入失敗', sp.model, e));
}

// ---------- 動作 ----------
function poseModel(m, md, dt, T) {
  const u = md.userData;
  md.position.set(m.x - W / 2, m.z || 0, m.y - 375);
  const gh = G ? groundH(m.x, m.y) : 0; const ghh = gh < -1e8 ? -400 : gh;
  u.blob.position.y = (ghh - (m.z || 0)) / u.scale + .4; const hh = Math.max(0, (m.z || 0) - ghh); u.blob.material.opacity = gh < -1e8 ? 0 : .38 * Math.max(.25, 1 - hh / 220); u.blob.scale.setScalar(Math.max(.5, 1 - hh / 300));
  const tgt = Math.PI / 2 - m.face; md.rotation.y += angDiff(tgt, md.rotation.y) * Math.min(1, dt * 16);
  const spd = Math.hypot(m.vx || 0, m.vy || 0), moving = spd > 20, amt = (m.air || m.dash || m.dodge) ? 0 : clamp(spd / 220, 0, 1);
  u.ph = (u.ph || 0) + (m.air ? 0 : spd * dt * Math.PI * 2 / 80);
  const rel = moving ? angDiff(Math.atan2(m.vy, m.vx), m.face) : 0, fwd = Math.cos(rel), side = Math.sin(rel), sw = Math.sin(u.ph);
  const breathe = Math.sin(T * 3 + (m.side || 0)) * .025 * (1 - amt);
  const fl = u.float ? 10 + Math.sin(T * 4) * 3 : 0;
  u.body.position.y = Math.abs(Math.cos(u.ph)) * 5 * amt + fl;
  u.body.rotation.x = m.dash ? .45 : m.dodge ? -.25 : m.air ? clamp(-(m.vz || 0) / 1800, -.35, .35) : .14 * amt * fwd + (u.float && moving ? .28 * fwd : 0);
  u.body.rotation.y = m.flip > 0 ? (1 - m.flip) * Math.PI * 2 : 0;
  const sq = m.squash || 0, cs = m.cast ? 1 + .05 * Math.sin(T * 30) : 1; u.body.scale.set((1 + sq * .55) * cs, (1 - sq + breathe) * cs, (1 + sq * .55) * cs);
  u.body.rotation.z = m.status === 'SLP' ? .5 : sw * .1 * amt + (u.float ? Math.sin(T * 2.2) * .07 - (moving ? side * .28 : 0) : 0);
  for (const L2 of u.legs) { const s2 = Math.sin(u.ph + L2.p);
    if (m.air || m.dodge) { L2.g.rotation.x = -.65; L2.g.rotation.z = 0; } else if (m.dash) { L2.g.rotation.x = .95; L2.g.rotation.z = 0; }
    else { L2.g.rotation.x = -s2 * .8 * amt * fwd; L2.g.rotation.z = s2 * .5 * amt * side; } }
  for (const A of u.arms) { const s2 = Math.sin(u.ph + A.p); if (A.hold && !m.cast && !m.air && !m.dash) { A.g.rotation.x = -.95 + Math.sin(T * 3) * .05; A.g.rotation.z = (A.p ? -1 : 1) * .5; continue; } A.g.rotation.x = m.cast ? -1.4 : m.air ? -1.1 : m.dash ? 1.0 : -s2 * .95 * amt * fwd + Math.sin(T * 3) * .06; A.g.rotation.z = m.air ? (A.p ? -.5 : .5) : 0; }
  u.wings.forEach((w, i) => w.rotation.z = (i % 2 ? -1 : 1) * (.15 + Math.sin(T * (m.air ? 22 : moving ? 16 : 9)) * .5));
  if (u.flame) u.flame.scale.set(.75, 1.35 + Math.sin(T * 13) * .2, .75);
  if (u.tail) u.tail.rotation.y = Math.sin(T * (moving ? 12 : 5)) * .35;
  if (u.mixer) { u.mixer.update(dt); if (u.acts.walk) { u.acts.walk.weight = amt; u.acts.idle.weight = 1 - amt; } }
  const f = Math.max(0, (m.hitFlash || 0) / .15), par = m.status === 'PAR' && Math.sin(T * 35) > .55 ? .4 : 0, cast = m.cast ? .12 + .1 * Math.sin(T * 30) : 0;
  const tc = m.cast && MOVES[m.cast.id] ? new THREE.Color(TYPES[MOVES[m.cast.id].type].c) : null;
  for (const mt of u.mats) if (mt.emissive && !mt.map) mt.emissive.setRGB(f + par + (tc ? tc.r * cast : 0), f + par * .85 + (tc ? tc.g * cast : 0), f + (tc ? tc.b * cast : 0));
  u.ice.visible = m.status === 'FRZ';
  md.visible = !(m.invT > 0 && ((T * 25) | 0) % 2);
  if (!G) return;
  // 腳步塵土、殘影、狀態粒子（只在本機產生，不需同步）
  const step = Math.floor(u.ph / Math.PI); if (step !== u.lastStep) { u.lastStep = step; if (amt > .55 && u.legs.length) emitP(m.x - Math.cos(m.face) * 12, m.y - Math.sin(m.face) * 12, (m.z || 0) + 3, MAP.ice ? '#ffffff' : '#8f9cbc', .4, { vz: 35, vx: (Math.random() * 2 - 1) * 40, vy: (Math.random() * 2 - 1) * 40 }); }
  if ((m.dash || m.dodge) && (u.ghostT = (u.ghostT || 0) - dt) <= 0) { u.ghostT = .03; G.cfx.push({ k: 'ghost', x: m.x, y: m.y, z: m.z || 0, R: m.r, color: TYPES[m.types[0]].c, t: 0, dur: .28 }); if (m.dash) emitP(m.x, m.y, (m.z || 0) + m.r, TYPES[m.types[0]].c, .25, { big: 1, vz: 0 }); }
  if (m.status && (u.stT = (u.stT || 0) - dt) <= 0) { u.stT = .12; emitP(m.x + (Math.random() * 2 - 1) * m.r, m.y + (Math.random() * 2 - 1) * m.r * .6, (m.z || 0) + m.r * 1.3 + Math.random() * m.r, STATUSN[m.status][1], .6, { vz: 50 }); }
}
function emitP(x, y, z, c, life, o) { if (!G) return; G.parts.push(Object.assign({ x, y, z, vx: (Math.random() * 2 - 1) * 20, vy: (Math.random() * 2 - 1) * 20, vz: 10, life, max: life, c, r: 3 }, o || {})); }
function disposeObj(o) { o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach(mt => { if (!mt.map || !Object.values(photoTexCache).some(c => c.tex === mt.map)) mt.dispose(); }); }); }
