'use strict';
/* Brimstone Halo · procedural models.
   Every character is built from primitives at load time. Parts that share a material are merged into one mesh
   (vertex colors carry the palette), so an angel or a demon costs a handful of draw calls. Animated parts
   (wings, legs, arms, tails, wheels) are separate groups tagged in userData so clones can find them again.
   Models face +Z. */

/* ---------- geometry helpers ---------- */
const _M = new THREE.Matrix4(), _Qm = new THREE.Quaternion(), _Em = new THREE.Euler(), _Pm = new THREE.Vector3(), _Sm = new THREE.Vector3(), _Ym = new THREE.Vector3(0, 1, 0);
function mtx(pos, rot, scl) {
  _Pm.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
  _Em.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  _Qm.setFromEuler(_Em);
  if (Array.isArray(scl)) _Sm.set(scl[0], scl[1], scl[2]); else _Sm.setScalar(scl == null ? 1 : scl);
  return _M.compose(_Pm, _Qm, _Sm);
}
const HDR = (c, k) => new THREE.Color(c).multiplyScalar(k);
function paint(g, c1, c2) {
  const a = new THREE.Color().copy(c1 instanceof THREE.Color ? c1 : new THREE.Color(c1));
  const b = c2 == null ? a : (c2 instanceof THREE.Color ? c2 : new THREE.Color(c2));
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  let lo = Infinity, hi = -Infinity;
  if (c2 != null) for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < lo) lo = y; if (y > hi) hi = y; }
  for (let i = 0; i < n; i++) {
    const t = c2 == null ? 0 : clamp((p.getY(i) - lo) / ((hi - lo) || 1), 0, 1);
    col[i * 3] = a.r + (b.r - a.r) * t; col[i * 3 + 1] = a.g + (b.g - a.g) * t; col[i * 3 + 2] = a.b + (b.b - a.b) * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function mergeGeos(list) {
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 20);   // points bottom → top
function bentHorn(r, h, bend, radial) {
  const g = new THREE.ConeGeometry(r, h, radial || 8, 14); g.translate(0, h / 2, 0);
  const p = g.attributes.position, R = h / bend;
  for (let i = 0; i < p.count; i++) {   // curl the cone backwards (-Z) around a center at z = -R
    const y = p.getY(i), z = p.getZ(i), a = y / R, d = R + z;
    p.setY(i, d * Math.sin(a)); p.setZ(i, d * Math.cos(a) - R);
  }
  g.computeVertexNormals(); return g;
}
function taperTube(points, r0, r1, tub, rad) {
  tub = tub || 18; rad = rad || 6;
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const g = new THREE.TubeGeometry(curve, tub, 1, rad, false), p = g.attributes.position, c = new THREE.Vector3();
  for (let i = 0; i <= tub; i++) {
    curve.getPointAt(i / tub, c); const f = lerp(r0, r1, i / tub);
    for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; p.setXYZ(k, c.x + (p.getX(k) - c.x) * f, c.y + (p.getY(k) - c.y) * f, c.z + (p.getZ(k) - c.z) * f); }
  }
  g.computeVertexNormals(); return g;
}
const PR = {
  sph: new THREE.SphereGeometry(1, 16, 12), sphLo: new THREE.SphereGeometry(1, 9, 7),
  hemi: new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 10), cone4: new THREE.ConeGeometry(1, 1, 4),
  box: new THREE.BoxGeometry(1, 1, 1), disk: new THREE.CylinderGeometry(1, 1, 1, 18), ico: new THREE.IcosahedronGeometry(1, 1),
  oct: new THREE.OctahedronGeometry(1)
};
// a feather: 1 long on +Y, asymmetric vane, rounded tip
const FEATHER = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(0.52, 0.22, 0.44, 0.68); s.quadraticCurveTo(0.3, 0.98, 0, 1.0);
  s.quadraticCurveTo(-0.3, 0.92, -0.38, 0.62); s.quadraticCurveTo(-0.42, 0.2, 0, 0);
  return new THREE.ShapeGeometry(s, 5);
})();

class Kit {
  constructor() { this.b = {}; }
  push(mat, g) { (this.b[mat] || (this.b[mat] = [])).push(g); return this; }
  add(mat, geo, c1, pos, rot, scl, c2) { const g = paint(geo.clone(), c1, c2); g.applyMatrix4(mtx(pos, rot, scl)); return this.push(mat, g); }
  // a tapered cylinder from point a (radius r0) to point b (radius r1)
  limb(mat, c, a, b, r0, r1, seg) {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), len = d.length() || 1e-3;
    const g = paint(new THREE.CylinderGeometry(r1 == null ? r0 : r1, r0, len, seg || 10), c);
    _Qm.setFromUnitVectors(_Ym, d.normalize()); _M.compose(A.add(B).multiplyScalar(0.5), _Qm, _Sm.set(1, 1, 1));
    g.applyMatrix4(_M); return this.push(mat, g);
  }
  feather(mat, x, y, z, ang, L, W, c1, c2, tilt) {   // ang: 0 = hangs straight down, π/2 = points outward (+X)
    const g = paint(FEATHER.clone(), c1, c2); g.applyMatrix4(mtx([x, y, z], [tilt || 0, 0, ang + Math.PI], [W, L, 1])); return this.push(mat, g);
  }
  build(mats, noShadow) {
    const grp = new THREE.Group();
    for (const k in this.b) {
      const m = new THREE.Mesh(mergeGeos(this.b[k]), mats[k]);
      m.name = 'm:' + k; m.castShadow = !noShadow && k !== 'glow'; grp.add(m);
    }
    return grp;
  }
}

/* ---------- shared materials ---------- */
const CRACK_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#ffb060'; g.shadowColor = '#ff6a10'; g.shadowBlur = 6; g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * 256, y = Math.random() * 256; g.lineWidth = rand(0.8, 2.4); g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += rand(-22, 22); y += rand(-22, 22); g.lineTo(x, y); }
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
})();
const std = o => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.7, metalness: 0 }, o));
const MAT = {
  cloth: std({ roughness: 0.82, side: THREE.DoubleSide }),
  skin: std({ roughness: 0.55 }),
  hair: std({ roughness: 0.45, metalness: 0.2 }),
  metal: std({ roughness: 0.24, metalness: 1, envMapIntensity: 1.6 }),
  gold: std({ roughness: 0.3, metalness: 1, envMapIntensity: 1.7, side: THREE.DoubleSide }),
  dark: std({ roughness: 0.42, metalness: 0.85, envMapIntensity: 1.1 }),
  feather: std({ roughness: 0.6, side: THREE.DoubleSide, emissive: 0x3a2a14, emissiveIntensity: 0.5 }),
  featherHot: std({ roughness: 0.55, side: THREE.DoubleSide, emissive: 0xff7a20, emissiveIntensity: 0.3 }),
  featherDark: std({ roughness: 0.5, side: THREE.DoubleSide, emissive: 0x220a2a, emissiveIntensity: 0.45 }),
  fur: std({ roughness: 0.9 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  membrane: std({ roughness: 0.6, side: THREE.DoubleSide, emissive: 0x3a0804, emissiveIntensity: 0.7 }),
  demon: std({ roughness: 0.48, emissive: 0x3a0804, emissiveIntensity: 1 }),
  crack: std({ roughness: 0.55, emissiveMap: CRACK_TEX, emissive: 0xff5a1a, emissiveIntensity: 1.8 }),
  horn: std({ roughness: 0.35, metalness: 0.15 }),
  robeDark: std({ roughness: 0.75, side: THREE.DoubleSide, emissive: 0x000000 })
};

/* ---------- rigging helpers ---------- */
function featherWing(o) {
  const s = o.size, arm = new Kit(), handK = new Kit(), M = o.mat || 'feather';
  const base = new THREE.Color(o.base), tip = new THREE.Color(o.tip), mid = base.clone().lerp(tip, 0.45);
  const rag = () => o.ragged ? rand(0.7, 1.05) : 1, skip = () => o.ragged && Math.random() < 0.2;
  const wx = 0.62 * s, wy = 0.2 * s;
  arm.limb(M, base, [0, 0, 0], [wx, wy, 0], 0.05 * s, 0.04 * s, 6);
  for (let i = 0; i < 8; i++) { const t = i / 7; if (skip()) continue; arm.feather(M, lerp(0.05, 0.6, t) * s, lerp(0.02, 0.19, t) * s, -0.012, lerp(0.04, 0.32, t), (0.8 + 0.14 * t) * s * rag(), 0.25 * s, base, tip); }
  for (let i = 0; i < 8; i++) { const t = i / 7; arm.feather(M, lerp(0.04, 0.6, t) * s, lerp(0.04, 0.21, t) * s, 0.012, lerp(0.2, 0.45, t), 0.44 * s * rag(), 0.2 * s, base, mid); }
  for (let i = 0; i < 7; i++) { const t = i / 6; arm.feather(M, lerp(0.04, 0.58, t) * s, lerp(0.06, 0.22, t) * s, 0.024, lerp(0.5, 0.7, t), 0.22 * s, 0.17 * s, base, base); }
  const hand = new THREE.Group(); hand.name = 'hand'; hand.position.set(wx, wy, 0);
  const hx = 0.48 * s, hy = 0.1 * s;
  handK.limb(M, base, [0, 0, 0], [hx, hy, 0], 0.04 * s, 0.025 * s, 6);
  for (let i = 0; i < 9; i++) { const t = i / 8; if (skip()) continue; handK.feather(M, lerp(0.0, hx, t), lerp(0.0, hy, t), -0.006 * i, lerp(0.42, 1.62, t), (1.0 + 0.3 * Math.sin(t * 2.6)) * s * rag(), 0.21 * s, base, tip); }
  for (let i = 0; i < 6; i++) { const t = i / 5; handK.feather(M, lerp(0.02, hx * 0.9, t), lerp(0.02, hy, t), 0.014, lerp(0.6, 1.45, t), 0.46 * s, 0.17 * s, base, mid); }
  const pivot = new THREE.Group(); pivot.name = 'wing';
  pivot.add(arm.build(MAT)); hand.add(handK.build(MAT)); pivot.add(hand);
  return pivot;
}
function batWing(s, mem, bone) {
  const k = new Kit(), wrist = [0.38 * s, 0.2 * s, 0];
  const tips = [[0.98, 0.46], [1.08, 0.04], [0.86, -0.32], [0.48, -0.46]].map(p => [p[0] * s, p[1] * s]);
  k.limb('demon', bone, [0, 0, 0], wrist, 0.035 * s, 0.028 * s, 6);
  for (const t of tips) k.limb('demon', bone, wrist, [t[0], t[1], 0], 0.022 * s, 0.008 * s, 5);
  k.add('horn', PR.cone, 0x1a1210, [wrist[0], wrist[1] + 0.05 * s, 0], [0, 0, -0.3], [0.025 * s, 0.1 * s, 0.025 * s]);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(wrist[0], wrist[1]); sh.lineTo(tips[0][0], tips[0][1]);
  const scallop = (a, b) => { const cx = lerp((a[0] + b[0]) / 2, wrist[0], 0.38), cy = lerp((a[1] + b[1]) / 2, wrist[1], 0.38); sh.quadraticCurveTo(cx, cy, b[0], b[1]); };
  for (let i = 1; i < tips.length; i++) scallop(tips[i - 1], tips[i]);
  scallop(tips[3], [0.05 * s, -0.3 * s]); sh.lineTo(0, 0);
  k.push('membrane', paint(new THREE.ShapeGeometry(sh, 6), mem));
  const pivot = new THREE.Group(); pivot.name = 'wing'; pivot.add(k.build(MAT)); return pivot;
}
// a mirrored pair of wings; the left one lives in a group scaled -1 on X (three.js flips the winding for us)
function wingPair(root, make, pos, rot, amp, spd, ph) {
  const w = make();
  for (const sx of [1, -1]) {
    const holder = new THREE.Group(); holder.position.set(pos[0] * sx, pos[1], pos[2]); if (sx < 0) holder.scale.x = -1;
    const p = sx > 0 ? w : w.clone(true);
    p.rotation.set(rot[0], rot[1], rot[2]); p.userData.wing = { rx: rot[0], ry: rot[1], rz: rot[2], amp, spd, ph: ph || 0 };
    holder.add(p); root.add(holder);
  }
}
function part(name, pos, tag) { const g = new THREE.Group(); g.name = name; if (pos) g.position.set(pos[0], pos[1], pos[2]); if (tag) Object.assign(g.userData, tag); return g; }
// collect animated parts from userData tags (works on clones too)
function rigOf(root) {
  const r = { root, wings: [], legs: [], arms: {}, spin: [], parts: {} };
  root.traverse(o => {
    const u = o.userData;
    if (u.wing) r.wings.push({ p: o, hand: o.getObjectByName('hand'), ...u.wing });
    if (u.leg) r.legs.push({ o, s: u.leg, b: o.rotation.x });
    if (u.spin) r.spin.push({ o, v: u.spin });
    if (o.name && !o.isMesh) r.parts[o.name] = o;
  });
  return r;
}

/* ---------- angels ---------- */
const PAL = {
  archangel: { plate: 0xcdd3dc, plate2: 0x9aa2ae, trim: 0xd9a84a, skirt: 0x8c1622, cape: 0x7a1020, plume: 0xf2ece0,
    eyes: HDR(0xfff0c0, 4), blade: HDR(0xfff0d0, 3.2), emblem: HDR(0xffd27a, 3), halo: HDR(0xffd27a, 3.4),
    wingMat: 'feather', wingBase: 0xfaf6ee, wingTip: 0xe0b464, wingSize: 1.12, wings: 1 },
  prince: { plate: 0x2c2228, plate2: 0x1a1216, trim: 0x8a5a2a, skirt: 0x2a0810, cape: 0x3a0610, plume: 0x1a0a0e,
    eyes: HDR(0xff4020, 6), blade: HDR(0xff5a20, 4), emblem: HDR(0xff3a2a, 3), halo: HDR(0xff2a4a, 3.6), broken: true,
    wingMat: 'featherDark', wingBase: 0x120c10, wingTip: 0x4a1a2a, ragged: true, wingSize: 1.25, wings: 2, horns: true }
};
function buildKnight(P) {
  const root = new THREE.Group(), body = new Kit();
  for (const sx of [-1, 1]) {
    const leg = part(sx < 0 ? 'legL' : 'legR', [0.14 * sx, 0.98, 0], { leg: sx }), k = new Kit();
    k.limb('metal', P.plate, [0, 0, 0], [0, -0.46, 0.02], 0.115, 0.095)
      .add('metal', PR.sph, P.trim, [0, -0.48, 0.05], 0, [0.085, 0.08, 0.09])
      .limb('metal', P.plate, [0, -0.5, 0.02], [0, -0.88, -0.01], 0.092, 0.075)
      .add('metal', PR.sph, P.plate, [0, -0.93, 0.06], 0, [0.095, 0.06, 0.17])
      .add('metal', PR.cone, P.trim, [0, -0.93, 0.21], [Math.PI / 2, 0, 0], [0.05, 0.1, 0.03]);
    leg.add(k.build(MAT)); root.add(leg);
  }
  // skirt, tabard, tassets
  body.add('cloth', lathe([[0.42, 0.4], [0.37, 0.62], [0.3, 0.85], [0.21, 1.08]], 22), P.skirt)
    .add('cloth', PR.box, P.skirt, [0, 0.74, 0.31], [-0.12, 0, 0], [0.26, 0.62, 0.02])
    .add('metal', PR.box, P.trim, [0.135, 0.74, 0.315], [-0.12, 0, 0], [0.018, 0.62, 0.025])
    .add('metal', PR.box, P.trim, [-0.135, 0.74, 0.315], [-0.12, 0, 0], [0.018, 0.62, 0.025])
    .add('metal', lathe([[0.36, 0.86], [0.31, 0.98], [0.24, 1.1]], 22), P.plate2);
  // cuirass
  body.add('metal', lathe([[0.2, 1.04], [0.23, 1.15], [0.29, 1.32], [0.31, 1.44], [0.27, 1.6], [0.15, 1.7]], 24), P.plate, 0, 0, [1, 1, 0.8])
    .add('metal', new THREE.TorusGeometry(1, 0.1, 6, 28), P.trim, [0, 1.06, 0], [Math.PI / 2, 0, 0], [0.215, 0.215 * 0.8, 0.25])
    .add('metal', new THREE.TorusGeometry(1, 0.1, 6, 24), P.trim, [0, 1.69, 0], [Math.PI / 2, 0, 0], [0.152, 0.152 * 0.85, 0.2])
    .add('metal', new THREE.TorusGeometry(1, 0.06, 5, 24), P.plate2, [0, 1.15, 0], [Math.PI / 2, 0, 0], [0.232, 0.232 * 0.8, 0.2])
    .add('metal', new THREE.TorusGeometry(1, 0.06, 5, 24), P.plate2, [0, 1.24, 0], [Math.PI / 2, 0, 0], [0.26, 0.26 * 0.8, 0.2])
    .add('metal', PR.box, P.trim, [0, 1.38, 0.245], [0.12, 0, 0], [0.026, 0.42, 0.03])
    .add('glow', PR.disk, P.emblem, [0, 1.46, 0.248], [Math.PI / 2 - 0.1, 0, 0], [0.055, 0.01, 0.055])
    .add('metal', lathe([[0.15, 1.65], [0.135, 1.72], [0.125, 1.79]], 18), P.plate2);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; body.add('glow', PR.box, P.emblem, [Math.cos(a) * 0.085, 1.46 + Math.sin(a) * 0.085, 0.244], [-0.1, 0, a], [0.012, 0.055, 0.01]); }
  // pauldrons: three overlapping lames with a gilt edge
  for (const sx of [-1, 1]) {
    body.add('metal', PR.hemi, P.plate, [0.33 * sx, 1.6, 0], [0, 0, -0.5 * sx], [0.2, 0.15, 0.21])
      .add('metal', PR.hemi, P.plate2, [0.38 * sx, 1.5, 0], [0, 0, -0.62 * sx], [0.18, 0.12, 0.19])
      .add('metal', PR.hemi, P.plate, [0.41 * sx, 1.41, 0], [0, 0, -0.72 * sx], [0.16, 0.1, 0.17])
      .add('metal', new THREE.TorusGeometry(1, 0.07, 5, 22), P.trim, [0.33 * sx, 1.6, 0], [Math.PI / 2, -0.5 * sx, 0], [0.2, 0.21, 0.2]);
  }
  root.add(body.build(MAT));
  // sword arm
  const armR = part('armR', [0.38, 1.52, 0]), ka = new Kit();
  ka.limb('metal', P.plate, [0, 0, 0], [0.02, -0.34, 0.02], 0.072, 0.066).add('metal', PR.sph, P.trim, [0.02, -0.36, 0.03], 0, 0.07)
    .limb('metal', P.trim, [0.02, -0.38, 0.03], [0.03, -0.64, 0.1], 0.08, 0.068).add('metal', PR.sph, P.plate, [0.03, -0.68, 0.12], 0, [0.075, 0.07, 0.085]);
  armR.add(ka.build(MAT));
  const sword = part('sword', [0.03, -0.68, 0.12]), ks = new Kit();
  ks.limb('hair', 0x3a2418, [0, -0.12, 0], [0, 0.08, 0], 0.024).add('metal', PR.sph, P.trim, [0, -0.14, 0], 0, 0.04)
    .add('metal', PR.box, P.trim, [0, 0.1, 0], 0, [0.32, 0.04, 0.05]).add('metal', PR.sph, P.trim, [0.17, 0.1, 0], 0, 0.035).add('metal', PR.sph, P.trim, [-0.17, 0.1, 0], 0, 0.035)
    .add('glow', PR.box, P.blade, [0, 0.69, 0], 0, [0.075, 1.15, 0.02]).add('glow', PR.cone4, P.blade, [0, 1.36, 0], [0, Math.PI / 4, 0], [0.054, 0.2, 0.014]);
  sword.add(ks.build(MAT)); sword.rotation.x = 1.25; armR.add(sword); armR.rotation.x = -0.45; root.add(armR);
  // shield arm
  const armL = part('armL', [-0.38, 1.52, 0]), kl = new Kit();
  kl.limb('metal', P.plate, [0, 0, 0], [-0.02, -0.34, 0.02], 0.072, 0.066).add('metal', PR.sph, P.trim, [-0.02, -0.36, 0.03], 0, 0.07)
    .limb('metal', P.trim, [-0.02, -0.38, 0.03], [-0.03, -0.64, 0.1], 0.08, 0.068).add('metal', PR.sph, P.plate, [-0.03, -0.68, 0.12], 0, [0.075, 0.07, 0.085]);
  const kite = new THREE.Shape(); kite.moveTo(0, 0.42); kite.quadraticCurveTo(0.31, 0.43, 0.3, 0.14); kite.lineTo(0, -0.46); kite.lineTo(-0.3, 0.14); kite.quadraticCurveTo(-0.31, 0.43, 0, 0.42);
  const face = new THREE.ExtrudeGeometry(kite, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 1, curveSegments: 8 });
  const rimG = new THREE.ExtrudeGeometry(kite, { depth: 0.02, bevelEnabled: false, curveSegments: 8 });
  const shield = part('shield', [-0.12, -0.5, 0.16]), ksh = new Kit();
  ksh.add('metal', face, P.plate2, [0, 0, 0.012]).add('metal', rimG, P.trim, [0, 0, -0.01], 0, [1.12, 1.1, 1])
    .add('glow', PR.box, P.emblem, [0, 0.02, 0.072], 0, [0.04, 0.5, 0.01]).add('glow', PR.box, P.emblem, [0, 0.14, 0.072], 0, [0.34, 0.04, 0.01]);
  shield.add(ksh.build(MAT)); shield.rotation.set(0, -1.05, 0.1); armL.add(kl.build(MAT)); armL.add(shield); armL.rotation.x = -0.25; root.add(armL);
  // head: winged great helm with a lit visor
  const head = part('head', [0, 1.86, 0.01]), kh = new Kit();
  kh.add('metal', PR.sph, P.plate, [0, 0, 0], 0, [0.155, 0.175, 0.17])
    .add('metal', PR.box, P.plate2, [0, -0.02, 0.13], [0.1, 0, 0], [0.2, 0.14, 0.06])
    .add('glow', PR.box, P.eyes, [0, 0.02, 0.165], 0, [0.17, 0.024, 0.02])
    .add('metal', PR.box, P.trim, [0, -0.03, 0.172], 0, [0.03, 0.13, 0.03])
    .add('metal', new THREE.TorusGeometry(1, 0.06, 5, 24), P.trim, [0, -0.07, 0], [Math.PI / 2, 0, 0], [0.16, 0.17, 0.16])
    .add(P.horns ? 'horn' : 'cloth', bentHorn(0.05, 0.5, 1.7), P.plume, [0, 0.14, 0.06], [-0.1, 0, 0]);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const g = paint(FEATHER.clone(), P.trim); g.applyMatrix4(mtx([0.15 * sx, 0.03 + i * 0.02, -0.02 - i * 0.03], [-0.5 - i * 0.35, Math.PI / 2, 0], [0.07, 0.24 - i * 0.04, 1])); kh.push('gold', g);
  }
  if (P.horns) for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.42; kh.add('horn', bentHorn(0.035, 0.32, 0.9), 0x2a1c1c, [Math.cos(a) * 0.13, 0.12, Math.sin(a) * -0.1 + 0.02], [0, -a - Math.PI / 2, 0]); }
  kh.add('glow', new THREE.TorusGeometry(1, 0.08, 6, 40, P.broken ? TAU * 0.78 : TAU), P.halo, [0, 0.32, -0.07], [Math.PI / 2 - 0.28, 0, 0.6], 0.21);
  head.add(kh.build(MAT));
  const hs = glowSprite(P.halo.clone().multiplyScalar(0.35), 0.55); hs.position.set(0, 0.3, -0.07); head.add(hs);
  root.add(head);
  // cape
  const cape = part('cape', [0, 1.62, -0.13]), kc = new Kit();
  kc.add('cloth', new THREE.CylinderGeometry(0.27, 0.52, 1.36, 18, 3, true, Math.PI - 1.15, 2.3), P.cape, [0, -0.68, -0.02]);
  cape.add(kc.build(MAT)); root.add(cape);
  // wings
  wingPair(root, () => featherWing({ size: P.wingSize, base: P.wingBase, tip: P.wingTip, mat: P.wingMat, ragged: P.ragged }), [0.16, 1.58, -0.2], [0, 0.5, 0.3], 0.16, 3, 0);
  if (P.wings > 1) wingPair(root, () => featherWing({ size: P.wingSize * 0.75, base: P.wingBase, tip: P.wingTip, mat: P.wingMat, ragged: P.ragged }), [0.14, 1.28, -0.22], [0, 0.4, -0.45], 0.12, 3, 1.2);
  return root;
}
function buildSeraph() {
  const root = new THREE.Group(), k = new Kit();
  const robe = 0xf3eee4, hem = 0xe6cfa0, gold = 0xd9a84a;
  k.add('cloth', lathe([[0.5, 0.0], [0.48, 0.1], [0.4, 0.45], [0.31, 0.82], [0.25, 1.08], [0.27, 1.3], [0.24, 1.52], [0.12, 1.68]], 26), hem, 0, 0, 1, robe)
    .add('metal', new THREE.TorusGeometry(1, 0.05, 6, 36), gold, [0, 0.05, 0], [Math.PI / 2, 0, 0], [0.49, 0.49, 0.5])
    .add('metal', new THREE.TorusGeometry(1, 0.025, 5, 36), gold, [0, 0.16, 0], [Math.PI / 2, 0, 0], [0.46, 0.46, 0.5])
    .add('metal', new THREE.TorusGeometry(1, 0.11, 6, 30), gold, [0, 1.08, 0], [Math.PI / 2, 0, 0], [0.255, 0.23, 0.26])
    .add('cloth', PR.box, 0x9a1a24, [0.13, 0.78, 0.27], [-0.2, 0, 0.1], [0.08, 0.55, 0.015])
    .add('metal', lathe([[0.255, 1.1], [0.29, 1.3], [0.27, 1.48], [0.15, 1.62]], 22), gold, 0, 0, [1, 1, 0.85])
    .add('glow', PR.disk, HDR(0xffa040, 3), [0, 1.38, 0.235], [Math.PI / 2 - 0.15, 0, 0], [0.05, 0.01, 0.05])
    .add('metal', new THREE.TorusGeometry(1, 0.1, 6, 24), gold, [0, 1.62, 0], [Math.PI / 2, 0, 0], [0.15, 0.13, 0.2]);
  root.add(k.build(MAT));
  // arms in bell sleeves; one bears a staff crowned with the living coal (Isaiah 6:6)
  const armR = part('armR', [0.29, 1.5, 0]), kr = new Kit();
  kr.limb('cloth', robe, [0, 0, 0], [0.1, -0.36, 0.16], 0.06, 0.13).add('skin', PR.sph, 0xf0d6bc, [0.1, -0.42, 0.17], 0, 0.055);
  armR.add(kr.build(MAT));
  const staff = part('staff', [0.1, -0.42, 0.17]), kst = new Kit();
  kst.limb('metal', gold, [0, -1.0, 0], [0, 0.85, 0], 0.024, 0.02).add('metal', new THREE.TorusGeometry(1, 0.12, 6, 24), gold, [0, 0.98, 0], 0, 0.11)
    .add('metal', PR.cone, gold, [0, 0.82, 0], [Math.PI, 0, 0], [0.05, 0.12, 0.05]).add('glow', PR.ico, HDR(0xff8a30, 4), [0, 0.98, 0], 0, 0.07);
  staff.add(kst.build(MAT)); const coal = glowSprite(HDR(0xff7a20, 1.4), 0.5); coal.position.set(0, 0.98, 0); staff.add(coal);
  armR.add(staff); root.add(armR);
  const armL = part('armL', [-0.29, 1.5, 0]), kl = new Kit();
  kl.limb('cloth', robe, [0, 0, 0], [-0.16, -0.3, 0.2], 0.06, 0.13).add('skin', PR.sph, 0xf0d6bc, [-0.18, -0.35, 0.22], 0, 0.055);
  armL.add(kl.build(MAT)); root.add(armL);
  // head: golden hair, eyes like burning coals, a wide halo
  const head = part('head', [0, 1.8, 0.02]), kh = new Kit();
  kh.add('skin', PR.sph, 0xf0d6bc, [0, 0, 0], 0, [0.13, 0.145, 0.135])
    .add('hair', PR.sph, 0xd9b26a, [0, 0.035, -0.03], 0, [0.145, 0.15, 0.145])
    .add('hair', taperTube([[0, 0.02, -0.08], [0, -0.15, -0.14], [0, -0.38, -0.16]], 0.12, 0.07, 10, 8), 0xd9b26a)
    .add('glow', PR.sph, HDR(0xfff0c0, 4), [0.045, 0.005, 0.12], 0, 0.02).add('glow', PR.sph, HDR(0xfff0c0, 4), [-0.045, 0.005, 0.12], 0, 0.02)
    .add('glow', new THREE.TorusGeometry(1, 0.08, 6, 44), HDR(0xffd27a, 3.6), [0, 0.28, -0.08], [Math.PI / 2 - 0.2, 0, 0], 0.25);
  head.add(kh.build(MAT));
  const hs = glowSprite(HDR(0xffc860, 0.9), 0.7); hs.position.set(0, 0.26, -0.09); head.add(hs);
  root.add(head);
  // six wings (Isaiah 6:2): two cover the face, two cover the feet, two to fly
  const W = (sz) => () => featherWing({ size: sz, base: 0xfff6e8, tip: 0xffa040, mat: 'featherHot' });
  wingPair(root, W(0.62), [0.08, 1.98, -0.1], [-0.35, 0.2, 1.05], 0.08, 3, 0.4);
  wingPair(root, W(1.05), [0.15, 1.6, -0.16], [0, 0.5, 0.25], 0.18, 3, 0);
  wingPair(root, W(0.72), [0.12, 1.15, -0.18], [0.15, 0.35, -0.65], 0.1, 3, 0.8);
  return root;
}
// wheels within wheels; `fallen` gives the dark iron, red-eyed version the Watchers corrupted
function buildWheels(fallen) {
  const root = new THREE.Group(), y = fallen ? 1.1 : 1.25;
  const metalKey = fallen ? 'dark' : 'metal', rimC = fallen ? 0x4a3832 : 0xd9a84a, rimC2 = fallen ? 0x2a1e1c : 0xa8782e;
  const irisC = fallen ? HDR(0xff3010, 3.5) : HDR(0x6ad8ff, 2.6), coreC = fallen ? HDR(0xff5a10, 3.2) : HDR(0xfff0c0, 3.2);
  const core = part('core', [0, y, 0]), kc = new Kit();
  kc.add('glow', PR.ico, coreC, 0, 0, fallen ? 0.24 : 0.26);
  core.add(kc.build(MAT, true)); core.add(glowSprite(coreC.clone().multiplyScalar(0.4), 1.5)); root.add(core);
  const specs = [[0.84, 10, [0, 0, 0], [0.9, 0, 0]], [0.66, 8, [Math.PI / 2, 0, 0], [0, 1.3, 0]], [0.48, 6, [0.6, 0.8, 0], [0, 0, 1.7]]];
  specs.forEach(([R, n, rot, spin], idx) => {
    const ring = part('ring' + idx, [0, y, 0], { spin: fallen ? spin.map(v => v * 1.8) : spin }), k = new Kit();
    k.add(metalKey, new THREE.TorusGeometry(R, 0.055, 8, 48), rimC).add(metalKey, new THREE.TorusGeometry(R - 0.07, 0.018, 5, 48), rimC2);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.2; k.limb(metalKey, rimC2, [0, 0, 0], [Math.cos(a) * (R - 0.06), Math.sin(a) * (R - 0.06), 0], 0.012); }
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, dx = Math.cos(a), dy = Math.sin(a), cx = dx * R, cy = dy * R;
      k.add('skin', PR.sph, fallen ? 0xc8b0a0 : 0xf4f0ea, [cx, cy, 0], 0, 0.085);
      const g1 = paint(PR.disk.clone(), irisC), g2 = paint(PR.disk.clone(), 0x050608);
      _Qm.setFromUnitVectors(_Ym, new THREE.Vector3(dx, dy, 0));
      g1.applyMatrix4(_M.compose(new THREE.Vector3(cx + dx * 0.07, cy + dy * 0.07, 0), _Qm, new THREE.Vector3(0.052, 0.02, 0.052))); k.push('glow', g1);
      g2.applyMatrix4(_M.compose(new THREE.Vector3(cx + dx * 0.085, cy + dy * 0.085, 0), _Qm, new THREE.Vector3(0.022, 0.012, 0.022))); k.push('skin', g2);
      if (fallen && idx === 0) k.add('horn', PR.cone, 0x1a1210, [dx * (R + 0.14), dy * (R + 0.14), 0], [0, 0, a - Math.PI / 2], [0.045, 0.2, 0.045]);
    }
    ring.add(k.build(MAT)); ring.rotation.set(rot[0], rot[1], rot[2]); root.add(ring);
  });
  if (!fallen) wingPair(core, () => featherWing({ size: 0.42, base: 0xfff6e8, tip: 0xffd27a, mat: 'feather' }), [0.18, 0.05, -0.12], [0, 0.6, 0.1], 0.3, 4, 0);
  return root;
}

/* ---------- the Fallen ---------- */
function buildImp() {
  const root = new THREE.Group(), k = new Kit(), skin = 0x8a2416, dark = 0x2a0c0a, belly = 0xb04a2a, hornC = 0x2b211d;
  for (const sx of [-1, 1]) {
    const leg = part(sx < 0 ? 'legL' : 'legR', [0.13 * sx, 0.55, -0.02], { leg: sx }), kl = new Kit();
    kl.limb('demon', skin, [0, 0, 0], [0, -0.22, 0.12], 0.08, 0.06).limb('demon', skin, [0, -0.22, 0.12], [0, -0.46, -0.04], 0.055, 0.04)
      .limb('demon', dark, [0, -0.46, -0.04], [0, -0.53, 0.12], 0.04, 0.03);
    for (const cz of [-0.04, 0, 0.04]) kl.add('horn', PR.cone, 0x1a1210, [cz, -0.54, 0.16], [Math.PI / 2, 0, 0], [0.018, 0.07, 0.018]);
    leg.add(kl.build(MAT)); root.add(leg);
  }
  k.add('demon', PR.sph, skin, [0, 0.82, 0], [0.35, 0, 0], [0.27, 0.3, 0.24]).add('demon', PR.sph, belly, [0, 0.78, 0.1], [0.35, 0, 0], [0.2, 0.22, 0.13])
    .add('demon', PR.sph, skin, [0.2, 0.98, 0.02], 0, 0.1).add('demon', PR.sph, skin, [-0.2, 0.98, 0.02], 0, 0.1);
  for (let i = 0; i < 4; i++) k.add('horn', PR.cone, hornC, [0, 0.9 + i * 0.07, -0.2 + i * 0.02], [-1.1, 0, 0], [0.03, 0.09, 0.03]);
  root.add(k.build(MAT));
  const head = part('head', [0, 1.12, 0.12]), kh = new Kit();
  kh.add('demon', PR.sph, skin, [0, 0, 0], 0, [0.2, 0.19, 0.21]).add('demon', PR.sph, skin, [0, -0.05, 0.16], 0, [0.12, 0.09, 0.12])
    .add('demon', PR.sph, dark, [0, -0.12, 0.11], 0, [0.13, 0.06, 0.12]).add('demon', PR.sph, dark, [0, 0.07, 0.15], 0, [0.18, 0.04, 0.06])
    .add('glow', PR.sph, HDR(0xffc020, 4), [0.08, 0.03, 0.17], 0, 0.045).add('glow', PR.sph, HDR(0xffc020, 4), [-0.08, 0.03, 0.17], 0, 0.045)
    .add('glow', PR.box, HDR(0xff6a10, 2.4), [0, -0.1, 0.22], 0, [0.12, 0.012, 0.02]);
  for (const sx of [-1, 1]) {
    kh.add('demon', PR.cone, skin, [0.19 * sx, 0.05, 0], [0, 0, -1.15 * sx], [0.05, 0.18, 0.03])
      .add('horn', bentHorn(0.055, 0.34, 1.8), hornC, [0.1 * sx, 0.14, 0.02], [0, 0, -0.35 * sx]);
  }
  head.add(kh.build(MAT)); root.add(head);
  for (const sx of [-1, 1]) {
    const arm = part(sx < 0 ? 'armL' : 'armR', [0.24 * sx, 0.95, 0.04]), ka = new Kit();
    ka.limb('demon', skin, [0, 0, 0], [0.05 * sx, -0.2, 0.1], 0.05, 0.04).limb('demon', skin, [0.05 * sx, -0.2, 0.1], [0.06 * sx, -0.36, 0.22], 0.04, 0.035)
      .add('demon', PR.sph, dark, [0.06 * sx, -0.39, 0.25], 0, 0.045);
    for (const cx of [-0.025, 0, 0.025]) ka.add('horn', PR.cone, 0x1a1210, [0.06 * sx + cx, -0.41, 0.3], [Math.PI / 2 - 0.4, 0, 0], [0.012, 0.06, 0.012]);
    arm.add(ka.build(MAT)); root.add(arm);
  }
  wingPair(root, () => batWing(0.85, 0x5a120c, dark), [0.1, 1.0, -0.17], [0, 0.55, 0.35], 0.55, 11, 0);
  const tail = part('tail', [0, 0.64, -0.2]), kt = new Kit();
  kt.add('demon', taperTube([[0, 0, 0], [0, -0.12, -0.3], [0, 0.04, -0.6], [0, 0.26, -0.74]], 0.045, 0.012), skin)
    .add('horn', PR.oct, dark, [0, 0.31, -0.76], [0.4, 0, 0], [0.07, 0.1, 0.02]);
  tail.add(kt.build(MAT)); root.add(tail);
  return root;
}
function buildWatcher() {
  const root = new THREE.Group(), k = new Kit(), robe = 0x231a2a, robe2 = 0x0f0a12, rust = 0x6a4a2a;
  k.add('robeDark', lathe([[0.42, 0.18], [0.38, 0.5], [0.3, 0.95], [0.26, 1.25], [0.3, 1.5], [0.2, 1.72], [0.1, 1.8]], 22), robe2, 0, 0, 1, robe);
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; k.add('robeDark', PR.cone, robe2, [Math.cos(a) * 0.38, 0.1, Math.sin(a) * 0.38], [Math.PI, 0, 0], [0.07, rand(0.18, 0.32), 0.03]); }
  k.add('dark', new THREE.TorusGeometry(1, 0.1, 6, 28), rust, [0, 1.25, 0], [Math.PI / 2, 0, 0], [0.265, 0.265, 0.25])
    .add('dark', PR.hemi, 0x2a2228, [0.25, 1.56, 0], [0, 0, -0.5], [0.15, 0.12, 0.16]).add('dark', PR.hemi, 0x2a2228, [-0.25, 1.56, 0], [0, 0, 0.5], [0.15, 0.12, 0.16])
    .add('robeDark', PR.sph, robe, [0, 1.9, -0.01], 0, [0.18, 0.21, 0.2]).add('robeDark', PR.cone, robe, [0, 1.95, -0.2], [-1.2, 0, 0], [0.12, 0.25, 0.1])
    .add('skin', PR.sph, 0x020103, [0, 1.87, 0.07], 0, [0.13, 0.14, 0.12])
    .add('glow', PR.sph, HDR(0xc080ff, 4), [0.045, 1.89, 0.17], 0, 0.022).add('glow', PR.sph, HDR(0xc080ff, 4), [-0.045, 1.89, 0.17], 0, 0.022);
  for (const sx of [-1, 1]) k.limb('robeDark', robe, [0.27 * sx, 1.5, 0], [0.17 * sx, 1.26, 0.32], 0.06, 0.1).add('skin', PR.sph, 0x8a8090, [0.14 * sx, 1.22, 0.38], 0, 0.05);
  k.add('glow', PR.ico, HDR(0xa060ff, 3.5), [0, 1.24, 0.46], 0, 0.1);
  root.add(k.build(MAT));
  const orb = glowSprite(HDR(0x9060ff, 1.3), 0.7); orb.position.set(0, 1.24, 0.46); root.add(orb);
  const halo = part('halo', [0, 2.16, -0.04], { spin: [0, 0, 0.4] }), kh = new Kit();
  kh.add('glow', new THREE.TorusGeometry(0.21, 0.018, 6, 36, TAU * 0.72), HDR(0xff3a6a, 3.2), 0, [Math.PI / 2 - 0.35, 0, 0]);
  halo.add(kh.build(MAT, true)); root.add(halo);
  wingPair(root, () => featherWing({ size: 0.95, base: 0x161016, tip: 0x3a2440, mat: 'featherDark', ragged: true }), [0.14, 1.62, -0.16], [0, 0.5, -0.15], 0.1, 2.2, 0);
  return root;
}
function buildNephil() {
  const root = new THREE.Group(), k = new Kit(), skin = 0x4a2220, leather = 0x2a1a12, hornC = 0x3a2c22, ivory = 0xd8ccb0;
  for (const sx of [-1, 1]) {
    const leg = part(sx < 0 ? 'legL' : 'legR', [0.24 * sx, 1.0, 0], { leg: sx }), kl = new Kit();
    kl.limb('crack', skin, [0, 0, 0], [0, -0.45, 0.06], 0.17, 0.14).limb('crack', skin, [0, -0.45, 0.06], [0, -0.88, -0.02], 0.13, 0.1)
      .add('horn', PR.cyl, 0x1a1210, [0, -0.94, 0.02], 0, [0.11, 0.12, 0.13]);
    leg.add(kl.build(MAT)); root.add(leg);
  }
  k.add('cloth', lathe([[0.5, 0.62], [0.44, 0.85], [0.38, 1.1]], 18), leather)
    .add('crack', PR.sph, skin, [0, 1.55, 0], 0, [0.56, 0.5, 0.42]).add('crack', PR.sph, skin, [0.17, 1.72, 0.27], 0, [0.22, 0.16, 0.12]).add('crack', PR.sph, skin, [-0.17, 1.72, 0.27], 0, [0.22, 0.16, 0.12])
    .add('crack', PR.sph, skin, [0, 1.26, 0.16], 0, [0.32, 0.32, 0.22]).add('crack', PR.sph, skin, [0.52, 1.88, 0], 0, 0.27).add('crack', PR.sph, skin, [-0.52, 1.88, 0], 0, 0.27);
  for (let i = 0; i < 5; i++) k.add('horn', PR.cone, hornC, [0, 1.35 + i * 0.16, -0.38 + i * 0.02], [-1.1, 0, 0], [0.06, 0.2, 0.06]);
  root.add(k.build(MAT));
  const head = part('head', [0, 2.05, 0.2]), kh = new Kit();
  kh.add('crack', PR.sph, skin, [0, 0, 0], 0, [0.19, 0.18, 0.19]).add('crack', PR.sph, skin, [0, -0.1, 0.08], 0, [0.17, 0.08, 0.15])
    .add('glow', PR.sph, HDR(0xff8a20, 4), [0.07, 0.03, 0.16], 0, 0.035).add('glow', PR.sph, HDR(0xff8a20, 4), [-0.07, 0.03, 0.16], 0, 0.035);
  for (const sx of [-1, 1]) kh.add('horn', PR.cone, ivory, [0.08 * sx, -0.08, 0.2], [0, 0, 0], [0.025, 0.12, 0.025])
    .add('horn', bentHorn(0.09, 0.78, 4.2, 10), hornC, [0.15 * sx, 0.1, -0.02], [0, 1.2 * sx, -0.5 * sx]);
  head.add(kh.build(MAT)); root.add(head);
  for (const sx of [-1, 1]) {
    const arm = part(sx < 0 ? 'armL' : 'armR', [0.6 * sx, 1.82, 0]), ka = new Kit();
    ka.limb('crack', skin, [0, 0, 0], [0.08 * sx, -0.45, 0.05], 0.14, 0.13).limb('crack', skin, [0.08 * sx, -0.45, 0.05], [0.1 * sx, -0.9, 0.14], 0.16, 0.14)
      .add('crack', PR.sph, skin, [0.1 * sx, -0.98, 0.16], 0, 0.19);
    for (const cx of [-0.08, 0, 0.08]) ka.add('horn', PR.cone, hornC, [0.1 * sx + cx, -0.92, 0.33], [Math.PI / 2, 0, 0], [0.03, 0.1, 0.03]);
    arm.add(ka.build(MAT)); root.add(arm);
  }
  return root;
}

/* ---------- companions ---------- */
function buildHound() {
  const root = new THREE.Group(), k = new Kit(), fur = 0xe9dcc4, fur2 = 0xb8946a;
  k.add('fur', PR.sph, fur, [0, 0.52, -0.02], 0, [0.2, 0.18, 0.38]).add('fur', PR.sph, fur, [0, 0.58, 0.26], 0, [0.17, 0.19, 0.16])
    .limb('fur', fur, [0, 0.62, 0.3], [0, 0.74, 0.4], 0.09, 0.08)
    .add('metal', new THREE.TorusGeometry(1, 0.15, 6, 24), 0xd9a84a, [0, 0.68, 0.36], [1.1, 0, 0], 0.095);
  root.add(k.build(MAT));
  const legs = [[0.1, 0.44, 0.25], [-0.1, 0.44, 0.25], [0.1, 0.44, -0.27], [-0.1, 0.44, -0.27]];
  legs.forEach((p, i) => { const leg = part('leg' + i, p, { leg: i % 2 ? (i < 2 ? -1 : 1) : (i < 2 ? 1 : -1) }), kl = new Kit(); kl.limb('fur', fur, [0, 0, 0], [0, -0.4, 0.02], 0.05, 0.04).add('fur', PR.sph, fur2, [0, -0.42, 0.04], 0, [0.045, 0.03, 0.06]); leg.add(kl.build(MAT)); root.add(leg); });
  const head = part('head', [0, 0.8, 0.44]), kh = new Kit();
  kh.add('fur', PR.sph, fur, [0, 0, 0], 0, [0.12, 0.12, 0.13]).limb('fur', fur, [0, -0.02, 0.06], [0, -0.05, 0.24], 0.07, 0.05)
    .add('skin', PR.sph, 0x1a1210, [0, -0.04, 0.25], 0, 0.028)
    .add('skin', PR.sph, 0x1a1210, [0.05, 0.03, 0.1], 0, 0.018).add('skin', PR.sph, 0x1a1210, [-0.05, 0.03, 0.1], 0, 0.018)
    .add('fur', PR.sph, fur2, [0.1, -0.02, -0.02], [0, 0, 0.35], [0.03, 0.11, 0.06]).add('fur', PR.sph, fur2, [-0.1, -0.02, -0.02], [0, 0, -0.35], [0.03, 0.11, 0.06])
    .add('glow', new THREE.TorusGeometry(1, 0.1, 6, 30), HDR(0xffd27a, 3), [0, 0.2, -0.02], [Math.PI / 2 - 0.2, 0, 0], 0.09);
  head.add(kh.build(MAT)); root.add(head);
  const tail = part('tail', [0, 0.6, -0.38]), kt = new Kit();
  kt.add('fur', bentHorn(0.035, 0.32, -1.2, 6), fur, [0, 0, 0], [-0.6, 0, 0]); tail.add(kt.build(MAT)); root.add(tail);
  return root;
}
function buildDove() {
  const root = new THREE.Group(), body = part('body', [0, 0, 0]), k = new Kit(), w = 0xfafaf6;
  k.add('fur', PR.sph, w, [0, 0, 0], 0, [0.11, 0.1, 0.19]).add('fur', PR.sph, w, [0, 0.07, 0.16], 0, 0.075)
    .add('skin', PR.cone, 0xd88a40, [0, 0.06, 0.25], [Math.PI / 2, 0, 0], [0.018, 0.06, 0.018])
    .add('skin', PR.sph, 0x101010, [0.035, 0.09, 0.2], 0, 0.012).add('skin', PR.sph, 0x101010, [-0.035, 0.09, 0.2], 0, 0.012)
    .limb('skin', 0x5a7a2a, [0, 0.05, 0.27], [0.08, 0.02, 0.33], 0.006).add('skin', PR.sph, 0x6aa04a, [0.06, 0.02, 0.33], [0, 0.4, 0], [0.04, 0.012, 0.018]).add('skin', PR.sph, 0x6aa04a, [0.1, 0.03, 0.31], [0, -0.5, 0], [0.04, 0.012, 0.018]);
  for (let i = 0; i < 5; i++) { const g = paint(FEATHER.clone(), w, 0xe8e2d6); g.applyMatrix4(mtx(0, [-Math.PI / 2 + 0.2, 0, 0], [0.07, 0.2, 1])); g.applyMatrix4(mtx([0, 0, -0.15], [0, (i - 2) * 0.22, 0])); k.push('feather', g); }
  body.add(k.build(MAT)); root.add(body);
  wingPair(body, () => featherWing({ size: 0.32, base: 0xffffff, tip: 0xe8e2d6, mat: 'feather' }), [0.08, 0.04, 0], [0, 0.1, 0.3], 0.7, 9, 0);
  return root;
}
function buildEagle() {
  const root = new THREE.Group(), body = part('body', [0, 0, 0]), k = new Kit(), brown = 0x5a3a1e, white = 0xf2ece0;
  k.add('fur', PR.sph, brown, [0, 0, 0], 0, [0.16, 0.15, 0.3]).add('fur', PR.sph, white, [0, 0.12, 0.26], 0, [0.11, 0.11, 0.12])
    .add('horn', bentHorn(0.03, 0.12, -1.6, 6), 0xe0b030, [0, 0.13, 0.36], [Math.PI / 2 + 0.3, 0, 0])
    .add('glow', PR.sph, HDR(0xffc040, 3), [0.05, 0.16, 0.33], 0, 0.015).add('glow', PR.sph, HDR(0xffc040, 3), [-0.05, 0.16, 0.33], 0, 0.015);
  for (const sx of [-1, 1]) k.limb('horn', 0xe0b030, [0.06 * sx, -0.1, 0.05], [0.06 * sx, -0.22, 0.1], 0.02, 0.015);
  body.add(k.build(MAT));
  const tk = new Kit(); for (let i = 0; i < 6; i++) { const g = paint(FEATHER.clone(), brown, white); g.applyMatrix4(mtx(0, [-Math.PI / 2 + 0.15, 0, 0], [0.09, 0.3, 1])); g.applyMatrix4(mtx([0, 0, -0.25], [0, (i - 2.5) * 0.16, 0])); tk.push('feather', g); }
  body.add(tk.build(MAT)); root.add(body);
  wingPair(body, () => featherWing({ size: 0.72, base: 0x6a4422, tip: 0xd8a24a, mat: 'feather' }), [0.12, 0.06, 0], [0, 0.05, 0.12], 0.35, 4, 0);
  return root;
}
function buildCherub() {
  const root = new THREE.Group(), body = part('body', [0, 0, 0]), k = new Kit(), g = 0xe8b85a;
  k.add('metal', PR.sph, g, [0, 0.2, 0], 0, 0.11).add('metal', lathe([[0.13, -0.18], [0.1, 0.0], [0.07, 0.1]], 16), g)
    .add('glow', PR.sph, HDR(0xfff0c0, 4), [0.035, 0.21, 0.095], 0, 0.014).add('glow', PR.sph, HDR(0xfff0c0, 4), [-0.035, 0.21, 0.095], 0, 0.014)
    .limb('metal', g, [0.08, 0.06, 0], [0.16, 0.0, 0.12], 0.025).limb('metal', g, [-0.08, 0.06, 0], [-0.12, 0.02, 0.14], 0.025)
    .add('metal', new THREE.TorusGeometry(0.16, 0.012, 5, 20, Math.PI), g, [0.18, 0.0, 0.16], [0, -Math.PI / 2, Math.PI / 2])
    .limb('glow', HDR(0xfff0d0, 2), [0.18, 0.16, 0.16], [0.18, -0.16, 0.16], 0.004)
    .add('glow', new THREE.TorusGeometry(1, 0.1, 6, 30), HDR(0xffd27a, 3.2), [0, 0.36, -0.02], [Math.PI / 2 - 0.2, 0, 0], 0.09);
  body.add(k.build(MAT)); root.add(body);
  wingPair(body, () => featherWing({ size: 0.42, base: 0xf0c060, tip: 0xffe9a0, mat: 'gold' }), [0.06, 0.12, -0.06], [0, 0.4, 0.5], 0.4, 6, 0);
  return root;
}
// the small burning wheels that orbit an Ophan (and anyone holding Ezekiel's Wheel)
function buildOrbWheel() {
  const k = new Kit();
  k.add('metal', new THREE.TorusGeometry(0.3, 0.05, 6, 24), 0xd9a84a).add('glow', PR.ico, HDR(0xfff0b0, 3), 0, 0, 0.08);
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; k.limb('metal', 0xa8782e, [0, 0, 0], [Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0], 0.012); }
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; k.add('glow', PR.sph, HDR(0x9fe8ff, 2.5), [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.04], 0, 0.035); }
  const g = k.build(MAT, true); g.add(glowSprite(HDR(0xffd27a, 0.6), 0.7)); return g;
}

/* ---------- templates, instancing, animation ---------- */
const MODEL = {}, MODEL_FLASH = { imp: MAT.demon, caster: MAT.robeDark, spinner: MAT.dark, brute: MAT.crack, boss: MAT.metal };
const MODEL_BUILD = { imp: buildImp, caster: buildWatcher, spinner: () => buildWheels(true), brute: buildNephil,
  boss: () => { const r = buildKnight(PAL.prince); r.scale.setScalar(2.1);
    for (let i = 0; i < 2; i++) { const ring = part('bring' + i, [0, 1.25, 0], { spin: i ? [0.5, 0.8, 0.3] : [0.7, 0.4, 0.2] }), k = new Kit(); k.add('glow', new THREE.TorusGeometry(1.35 - i * 0.28, 0.035, 6, 64), i ? HDR(0xffd27a, 2.4) : HDR(0xff6aa8, 3)); ring.add(k.build(MAT, true)); r.add(ring); }
    return r; } };
// an enemy instance: a clone of the type's template with its own material for hit flashes
function makeEnemyModel(type) {
  if (!MODEL[type]) MODEL[type] = MODEL_BUILD[type]();
  const root = MODEL[type].clone(true), base = MODEL_FLASH[type], flash = base.clone();
  root.traverse(o => { if (o.isMesh && o.material === base) o.material = flash; });
  flash.userData.e0 = flash.emissive.clone(); flash.userData.i0 = flash.emissiveIntensity;
  return { root, rig: rigOf(root), flash };
}
function setFlash(m, k) {
  if (k > 0) { m.emissive.setRGB(1, 0.85, 0.7); m.emissiveIntensity = 2.6 * k + 0.4; }
  else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.i0; }
}
function animWings(rig, t, k, spdMul) {
  for (const w of rig.wings) {
    const ph = t * w.spd * (spdMul || 1) + w.ph, a = w.amp * k;
    w.p.rotation.z = w.rz + Math.sin(ph) * a;
    w.p.rotation.y = w.ry - Math.sin(ph + 0.6) * a * 0.45;
    if (w.hand) w.hand.rotation.z = Math.sin(ph - 0.8) * a * 0.7;
  }
}
function animLegs(rig, phase, amt) { for (const l of rig.legs) l.o.rotation.x = l.b + Math.sin(phase) * amt * l.s; }
function animSpin(rig, dt, mul) { for (const s of rig.spin) { s.o.rotation.x += s.v[0] * dt * (mul || 1); s.o.rotation.y += s.v[1] * dt * (mul || 1); s.o.rotation.z += s.v[2] * dt * (mul || 1); } }
