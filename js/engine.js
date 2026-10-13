'use strict';
/* Brimstone Halo · rendering: HDR pipeline, lighting, the arena, atmosphere, instanced pools and impact effects */

/* ======================= RENDERER ======================= */
const canvas = $('gl');
if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;   // hex colors are sRGB; lighting runs in linear HDR
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setClearColor(0x040206);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
const camOff = new THREE.Vector3(1, 1.22, 1).normalize().multiplyScalar(70);
const SCR_R = new THREE.Vector3(1, 0, -1).normalize();
const SCR_U = new THREE.Vector3(-1, 0, -1).normalize();
const FACE_CAM = Math.atan2(camOff.x, camOff.z);   // model yaw that faces the viewer
// Billboard orientation: every camera-facing quad shares the fixed isometric view rotation
const BB_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camOff, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
// Final grade: ACES filmic, split-tone (violet shadows, ember highlights), chromatic aberration, vignette, grain
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 0.95 }, uHurt: { value: 0 }, uAsc: { value: 0 }, uCA: { value: 0.0015 }, uVig: { value: 1 }, uStill: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uExposure, uHurt, uAsc, uCA, uVig, uStill; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r = length(d);
      float ca = uCA * (0.35 + r * r * 4.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * ca).b);
      c *= uExposure * (1.0 + uAsc * 0.25);
      c = aces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * vec3(0.9, 0.88, 1.16), (1.0 - smoothstep(0.0, 0.4, l)) * 0.55);
      c = mix(c, c * vec3(1.08, 1.0, 0.86), smoothstep(0.45, 1.0, l) * 0.45);
      c = mix(vec3(l), c, 1.1);
      c = mix(c, c * vec3(1.1, 1.03, 0.85) + vec3(0.04, 0.03, 0.0), uAsc * 0.7);
      c = mix(c, vec3(l) * vec3(0.82, 0.95, 1.2), uStill * 0.55);
      c *= mix(1.0, smoothstep(0.92, 0.28, r * 1.18), uVig);
      c = mix(c, vec3(0.45, 0.0, 0.04), uHurt * smoothstep(0.3, 0.85, r) * 0.55);
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      c += (hash(vUv * vec2(1213.0, 857.0) + fract(uTime)) - 0.5) * 0.03;
      gl_FragColor = vec4(c, 1.0);
    }`
};
let composer = null, gradePass = null;
try {
  if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.ShaderPass && renderer.capabilities.isWebGL2) {
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, cam));
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.65, 0.92));
    gradePass = new THREE.ShaderPass(GradeShader); composer.addPass(gradePass);
  }
} catch (e) { composer = null; gradePass = null; }
if (!composer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2; renderer.outputEncoding = THREE.sRGBEncoding; }

// View: half the visible height in world units. Smaller is closer. The wheel changes `want`.
const VIEW = { half: 10.5, want: 10.5, shift: 0, wantShift: 0, lift: 0, wantLift: 0 };
function applyView() {
  const a = innerWidth / innerHeight, halfH = Math.max(VIEW.half, VIEW.half * 0.8 / a);
  cam.left = -halfH * a; cam.right = halfH * a; cam.top = halfH; cam.bottom = -halfH; cam.updateProjectionMatrix();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); if (composer) composer.setSize(innerWidth, innerHeight); applyView(); }
addEventListener('resize', resize);

const hemi = new THREE.HemisphereLight(0x6a5a90, 0x1c0c08, 0.16); scene.add(hemi);
// Light from the heavens above: the shadow-casting key light that follows the camera
const sun = new THREE.DirectionalLight(0xc8c0ff, 0.42);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-14, 34, 8), SUN_COOL = new THREE.Color(0xc8c0ff), SUN_GOLD = new THREE.Color(0xffe2b8);
const torch = new THREE.PointLight(0xffa860, 5, 15, 1.6); scene.add(torch);
// a soft key light on the hero, so armor and feathers read even far from the braziers
const heroLight = new THREE.PointLight(0xfff0dc, 1.4, 7, 1.8); scene.add(heroLight);
// Image-based lighting: a dark sky with a heavenly disk overhead and an ember ring below the horizon
(() => {
  try {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x0d0812 })));
    const disk = new THREE.Mesh(new THREE.CircleGeometry(13, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5, 3.4), side: THREE.DoubleSide }));
    disk.position.set(-8, 44, 6); disk.lookAt(0, 0, 0); env.add(disk);
    const disk2 = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.9), side: THREE.DoubleSide }));
    disk2.position.set(30, 20, 30); disk2.lookAt(0, 0, 0); env.add(disk2);
    const er = new THREE.Mesh(new THREE.TorusGeometry(46, 5, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.7, 0.15) }));
    er.rotation.x = Math.PI / 2; er.position.y = -8; env.add(er);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
  } catch (e) {}
})();
const HEMI_SKY = new THREE.Color(0x6a5a80), HEMI_GOLD = new THREE.Color(0xffe2a0), TORCH_C = new THREE.Color(0xffb070), TORCH_GOLD = new THREE.Color(0xfff0c0);

/* ======================= SHARED TEXTURES ======================= */
function makeGlowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.16, 'rgba(255,255,255,.9)'); gr.addColorStop(0.36, 'rgba(255,255,255,.32)');
  gr.addColorStop(0.65, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const GLOW_TEX = makeGlowTex();
const BB_GEO = new THREE.PlaneGeometry(2, 2).applyQuaternion(BB_Q);
function glowSprite(color, size) {
  const m = new THREE.Mesh(BB_GEO, new THREE.MeshBasicMaterial({ map: GLOW_TEX, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.scale.setScalar(size); m.renderOrder = 6; return m;
}

/* ======================= ARENA ======================= */
function makeFloorTextures() {
  const S = 1024, k = S / (2 * FLOOR_R);
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#1d1517'; g.fillRect(0, 0, S, S);
  const N = 22, cs = S / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const off = (j % 2) * cs * 0.5;
    g.fillStyle = `hsl(${10 + Math.random() * 25},${7 + Math.random() * 8}%,${15 + Math.random() * 9}%)`;
    g.fillRect(i * cs + off + 2, j * cs + 2, cs - 4, cs - 4);
    for (let q = 0; q < 26; q++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.22})`; g.fillRect(i * cs + off + Math.random() * cs, j * cs + Math.random() * cs, 1 + Math.random() * 4, 1 + Math.random() * 4); }
  }
  const e = document.createElement('canvas'); e.width = e.height = S; const h = e.getContext('2d');
  h.fillStyle = '#000'; h.fillRect(0, 0, S, S);
  const cx = S / 2; h.strokeStyle = '#fff'; h.lineCap = 'round';
  const circ = (r, w, a) => { h.globalAlpha = a; h.lineWidth = w; h.beginPath(); h.arc(cx, cx, r * k, 0, TAU); h.stroke(); };
  circ(7.2, 3, .55); circ(8.2, 1.5, .4); circ(ARENA_R - 0.4, 4, .45); circ(ARENA_R - 1.4, 1.2, .25); circ(18, 1, .14);
  // nine-pointed star: the nine choirs
  h.globalAlpha = .45; h.lineWidth = 2.4; h.beginPath();
  for (let i = 0; i <= 9; i++) { const a = -Math.PI / 2 + (i * 4 % 9) * TAU / 9; const x = cx + Math.cos(a) * 7.2 * k, y = cx + Math.sin(a) * 7.2 * k; i ? h.lineTo(x, y) : h.moveTo(x, y); }
  h.stroke(); h.globalAlpha = .5; h.lineWidth = 2;
  for (let i = 0; i < 45; i++) { const a = i * TAU / 45; const r0 = 7.5 * k, r1 = (i % 5 ? 7.85 : 8.1) * k; h.beginPath(); h.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0); h.lineTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1); h.stroke(); }
  for (let s = 0; s < 14; s++) {
    let a = Math.random() * TAU, r = rand(10, ARENA_R - 3);
    h.globalAlpha = rand(.15, .35); h.lineWidth = rand(1, 2.5); h.beginPath(); h.moveTo(cx + Math.cos(a) * r * k, cx + Math.sin(a) * r * k);
    for (let t = 0; t < 7; t++) { a += rand(-.08, .08); r += rand(-1.6, 1.6); h.lineTo(cx + Math.cos(a) * r * k, cx + Math.sin(a) * r * k); }
    h.stroke();
  }
  // height -> normal map, plus roughness with wet puddles that catch the light
  const NS = 512, nk = NS / S, hgt = new Float32Array(NS * NS), ncs = cs * nk;
  for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) {
    const row = Math.floor(y / ncs), off = (row % 2) * ncs * 0.5, lx = ((x - off) % ncs + ncs) % ncs, ly = y % ncs;
    const edge = Math.min(lx, ncs - lx, ly, ncs - ly);
    hgt[y * NS + x] = Math.min(1, edge / 2.2) * 0.8 + Math.random() * 0.12 + Math.sin(x * 0.11 + row) * Math.cos(y * 0.13) * 0.05;
  }
  const nc = document.createElement('canvas'); nc.width = nc.height = NS; const ng = nc.getContext('2d'); const nd = ng.createImageData(NS, NS);
  const rc = document.createElement('canvas'); rc.width = rc.height = NS; const rg = rc.getContext('2d'); const rd = rg.createImageData(NS, NS);
  const puddles = Array.from({ length: 16 }, () => [Math.random() * NS, Math.random() * NS, rand(18, 60)]);
  for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) {
    const i = y * NS + x, hx = hgt[y * NS + Math.min(NS - 1, x + 1)] - hgt[y * NS + Math.max(0, x - 1)], hy = hgt[Math.min(NS - 1, y + 1) * NS + x] - hgt[Math.max(0, y - 1) * NS + x];
    let nx = -hx * 2.2, ny = -hy * 2.2, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    nd.data[i * 4] = (nx * 0.5 + 0.5) * 255; nd.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; nd.data[i * 4 + 2] = nz * 255; nd.data[i * 4 + 3] = 255;
    let wet = 0; for (const p of puddles) { const d = Math.hypot(x - p[0], y - p[1]) / p[2]; if (d < 1) wet = Math.max(wet, 1 - d * d); }
    wet *= 1 - hgt[i] * 0.5;
    const rough = 235 - wet * 190;
    rd.data[i * 4] = rd.data[i * 4 + 1] = rd.data[i * 4 + 2] = rough; rd.data[i * 4 + 3] = 255;
  }
  ng.putImageData(nd, 0, 0); rg.putImageData(rd, 0, 0);
  const map = new THREE.CanvasTexture(c), em = new THREE.CanvasTexture(e), nrm = new THREE.CanvasTexture(nc), rgh = new THREE.CanvasTexture(rc);
  map.encoding = THREE.sRGBEncoding; map.anisotropy = em.anisotropy = nrm.anisotropy = 8;
  return { map, em, nrm, rgh };
}
const ft = makeFloorTextures();
const floorMat = new THREE.MeshStandardMaterial({ map: ft.map, emissiveMap: ft.em, emissive: 0xff4a18, emissiveIntensity: 1.6, normalMap: ft.nrm, normalScale: new THREE.Vector2(1.1, 1.1), roughnessMap: ft.rgh, roughness: 1, metalness: 0.08, envMapIntensity: 0.45, color: 0x9a8c88 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R, 96), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const cliff = new THREE.Mesh(new THREE.CylinderGeometry(FLOOR_R, FLOOR_R - 3, 9, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x140d0e, roughness: 1, emissive: 0x2a0602, emissiveIntensity: 0.4 }));
cliff.position.y = -4.5; scene.add(cliff);
const rim = new THREE.Mesh(new THREE.TorusGeometry(FLOOR_R, 0.12, 6, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a2e).multiplyScalar(3) })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; scene.add(rim);
const EMB = 420, embGeo = new THREE.BufferGeometry(), embPos = new Float32Array(EMB * 3), embSpd = new Float32Array(EMB);
function seedEmber(i, anyY) { const a = Math.random() * TAU, r = rand(FLOOR_R + 1, FLOOR_R + 26); embPos[i * 3] = Math.cos(a) * r; embPos[i * 3 + 1] = anyY ? rand(-20, 8) : -20; embPos[i * 3 + 2] = Math.sin(a) * r; embSpd[i] = rand(1.2, 4); }
for (let i = 0; i < EMB; i++) seedEmber(i, true);
embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
scene.add(new THREE.Points(embGeo, new THREE.PointsMaterial({ color: 0xff7a3a, size: 3, sizeAttenuation: false, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false })));

const pillars = [], braziers = [];
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a3c38, roughness: 0.82, metalness: 0.05, emissive: 0x120604, envMapIntensity: 0.35, flatShading: true });
const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a3a).multiplyScalar(4) });
function addPillar(x, z, h, r, brazier) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 8), stoneMat); shaft.position.y = h / 2; g.add(shaft);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.35, 0.4, 8), stoneMat); base.position.y = 0.2; g.add(base);
  if (brazier) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 0.6, 0.5, 8), stoneMat); bowl.position.y = h + 0.25; g.add(bowl);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(r * 0.7, 1.4, 7), fireMat); fl.position.y = h + 1.1; g.add(fl);
    const L = new THREE.PointLight(0xff7a30, 3, 13, 1.6); L.position.set(x, h + 1.6, z); scene.add(L);
    braziers.push({ fl, L, ph: Math.random() * 10 });
  }
  g.traverse(o => { if (o.isMesh && o.material !== fireMat) { o.castShadow = true; o.receiveShadow = true; } });
  if (brazier) { const gl = glowSprite(new THREE.Color(1, 0.45, 0.12).multiplyScalar(2.2), 2.4); gl.position.set(0, h + 1.2, 0); g.add(gl); }
  g.position.set(x, 0, z); scene.add(g); pillars.push({ x, z, r: r * 1.05 });
}
for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + TAU / 12; addPillar(Math.cos(a) * 13.5, Math.sin(a) * 13.5, rand(2.2, 3.6), 0.85, false); }
for (let i = 0; i < 4; i++) { const a = i * TAU / 4; addPillar(Math.cos(a) * 23, Math.sin(a) * 23, 4.2, 1.0, true); }

/* ---------- atmosphere ---------- */
const NOISE_GLSL = `float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }`;
const shafts = [];
function makeShaft(x, z, rTop, rBot, k) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(1.0, 0.82, 0.55) }, uI: { value: k }, uT: { value: Math.random() * 100 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vF = abs(n.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uCol; uniform float uI, uT; varying vec2 vUv; varying float vF;
      void main(){ float a = pow(vF, 2.5) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        a *= 0.7 + 0.3 * sin(vUv.x * 37.0 + uT * 0.6) * sin(vUv.x * 13.0 - uT * 0.35);
        gl_FragColor = vec4(uCol * a * uI, 1.0); }`
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 34, 40, 1, true), mat);
  m.position.set(x + 5, 17, z - 3); m.rotation.set(0.12, 0, 0.18); m.renderOrder = 5; scene.add(m);
  shafts.push({ m, k, ph: Math.random() * 10 });
}
[[-9, -6, 1.6, 4.2, .16], [7, 9, 1.2, 3.4, .13], [14, -12, 1.0, 3.0, .1], [-16, 12, 1.4, 3.6, .11], [1, -1, 2.0, 5.2, .09]].forEach(a => makeShaft(...a));
const MOTES = 260, moteGeo = new THREE.BufferGeometry(), motePos = new Float32Array(MOTES * 3), moteV = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * ARENA_R; motePos[i * 3] = Math.cos(a) * r; motePos[i * 3 + 1] = rand(0.2, 9); motePos[i * 3 + 2] = Math.sin(a) * r; moteV[i] = rand(0.15, 0.6); }
moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
scene.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: GLOW_TEX, color: new THREE.Color(1.6, 1.25, 0.8), size: 7, sizeAttenuation: false, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })));
const mists = [];
function makeMist(y, scale, col, a, spd) {
  const R = (ARENA_R + 6).toFixed(1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: col }, uA: { value: a }, uS: { value: scale }, uSpd: { value: spd } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: NOISE_GLSL + `uniform float uT, uA, uS, uSpd; uniform vec3 uCol; varying vec2 vP;
      void main(){ float n = fbm(vP * uS + vec2(uT * uSpd, uT * uSpd * 0.6)); n *= fbm(vP * uS * 0.5 - vec2(uT * uSpd * 0.4, 0.0) + 3.0) * 1.6;
        float r = length(vP); float edge = smoothstep(${R}, ${R} - 10.0, r);
        float a = smoothstep(0.3, 0.9, n) * uA * edge; gl_FragColor = vec4(uCol * a, 1.0); }`
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), mat); m.position.y = y; m.renderOrder = 1; scene.add(m); mists.push(mat);
}
makeMist(0.25, 0.09, new THREE.Color(0.32, 0.2, 0.42), 0.4, 0.35);
makeMist(0.9, 0.05, new THREE.Color(0.5, 0.18, 0.08), 0.35, -0.22);
{
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 40, 128, 128, 128); gr.addColorStop(0, 'rgba(255,90,30,0)'); gr.addColorStop(0.45, 'rgba(255,90,30,.9)'); gr.addColorStop(0.7, 'rgba(160,30,10,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: new THREE.Color(1.6, 1, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.y = -10; scene.add(m);
}
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
function blob(s) { const m = new THREE.Mesh(shadowGeo, shadowMat); m.scale.setScalar(s); m.position.y = 0.03; m.name = 'blob'; return m; }

/* ======================= PLAYER-SIDE MARKERS & SKILL FX ======================= */
const additive = (color, opacity, side) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity ?? 0, blending: THREE.AdditiveBlending, depthWrite: false, side: side || THREE.FrontSide });
const heart = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4), depthTest: false }));
heart.renderOrder = 10; scene.add(heart);
const focusRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending }));
focusRing.renderOrder = 9; scene.add(focusRing);
const aimArrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 3).rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .8 }));
aimArrow.position.y = 0.08; scene.add(aimArrow);
const pShadow = blob(1.9); scene.add(pShadow);
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .55, depthWrite: false }));
reticle.position.y = BULLET_Y; scene.add(reticle);
const ascBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 22, 32, 1, true), additive(0xffd98a, 0, THREE.DoubleSide)); scene.add(ascBeam);
const novaRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2), additive(0xffe39a, 0, THREE.DoubleSide)); novaRing.position.y = 0.3; scene.add(novaRing);
const aegisShell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), additive(0xffd27a, 0.1, THREE.FrontSide)); aegisShell.visible = false; scene.add(aegisShell);
const wardShell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), additive(0x7ddc8a, 0.1, THREE.DoubleSide)); wardShell.visible = false; scene.add(wardShell);
const sectorMat = additive(0xffe2a8, 0, THREE.DoubleSide);
const sector = new THREE.Mesh(new THREE.BufferGeometry(), sectorMat); sector.position.y = BULLET_Y; scene.add(sector);
const whirlDisc = new THREE.Mesh(new THREE.RingGeometry(0.4, 1, 48, 1).rotateX(-Math.PI / 2), additive(0xffb060, 0, THREE.DoubleSide)); whirlDisc.position.y = BULLET_Y; scene.add(whirlDisc);
let sectorKey = '';
function rebuildSector() {
  const key = S.arc + ':' + S.reach.toFixed(2); if (key === sectorKey || !S.arc) return; sectorKey = key;
  sector.geometry.dispose(); const ar = Math.min(S.arc, 359) * DEG;
  sector.geometry = new THREE.RingGeometry(0.5, S.reach, 32, 1, -ar / 2, ar).rotateX(-Math.PI / 2);
}
// Flame Strike columns and their ground telegraphs
const strikeFx = [];
for (let i = 0; i < 6; i++) {
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 1, 28, 1, true), additive(new THREE.Color(3, 1.3, 0.35), 0, THREE.DoubleSide));
  const tele = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), additive(new THREE.Color(2, 0.8, 0.2), 0, THREE.DoubleSide));
  col.visible = tele.visible = false; tele.position.y = 0.1; scene.add(col, tele); strikeFx.push({ col, tele, busy: false });
}

/* ======================= INSTANCED POOLS ======================= */
const unitSphere = new THREE.SphereGeometry(1, 10, 8);
function inst(geo, mat, n) { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); return m; }
function withColors(m, n) { const c = new THREE.Color(1, 1, 1); for (let i = 0; i < n; i++) m.setColorAt(i, c); m.instanceColor.setUsage(THREE.DynamicDrawUsage); return m; }
const ebHalo = withColors(inst(BB_GEO, new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX_EB), MAX_EB);
const ebCore = inst(unitSphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.7) }), MAX_EB);
const pbMesh = withColors(inst(unitSphere, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX_PB), MAX_PB);
const gemMesh = withColors(inst(new THREE.OctahedronGeometry(1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_GEM), MAX_GEM);
const partMesh = withColors(inst(BB_GEO, new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX_PART), MAX_PART);
ebHalo.renderOrder = 3; pbMesh.renderOrder = 2; partMesh.renderOrder = 4;
const BCOL = [new THREE.Color(0xff3020), new THREE.Color(0x9a62ff), new THREE.Color(0xff9418), new THREE.Color(0xff5aa0), new THREE.Color(0xffd27a)];
const C = { gold: new THREE.Color(0xffd27a), white: new THREE.Color(0xffffff), soul: new THREE.Color(0x9fe8ff), heal: new THREE.Color(0xff3048), flame: new THREE.Color(0xffb060),
  eye: new THREE.Color(0xb8e8ff), green: new THREE.Color(0x7ddc8a), violet: new THREE.Color(0xb58aff), feather: new THREE.Color(0xfff1d0) };
function setTS(a, i, x, y, z, s) { const o = i * 16; a[o] = s; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = s; a[o + 6] = 0; a[o + 7] = 0; a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = s; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1; }
function setCol(a, i, c, k) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }

/* ======================= IMPACT EFFECTS ======================= */
let hitStop = 0;
const waves = [];
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2), additive(0xffffff, 0)); m.position.y = 0.12; m.visible = false; scene.add(m); waves.push({ m, t: 1, max: 1, R: 1 }); }
let waveIdx = 0;
function shockwave(x, z, col, R) { const w = waves[waveIdx++ % waves.length]; w.m.material.color.set(col).multiplyScalar(3); w.m.position.set(x, 0.12, z); w.t = 0; w.max = R > 8 ? 0.9 : 0.45; w.R = R; w.m.visible = true; }
const scorchTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(0.5, 'rgba(10,2,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 64); const a = Math.random() * TAU; g.lineTo(64 + Math.cos(a) * rand(30, 60), 64 + Math.sin(a) * rand(30, 60)); g.stroke(); } return new THREE.CanvasTexture(c); })();
const MAX_SCORCH = 48;
const scorchMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false }), MAX_SCORCH);
scorchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scorchMesh.frustumCulled = false; scorchMesh.count = 0; scorchMesh.renderOrder = 0; scene.add(scorchMesh);
let scorches = [];
function scorch(x, z, s) { if (scorches.length >= MAX_SCORCH) scorches.shift(); scorches.push({ x, z, s, t: 0, rot: Math.random() * TAU }); }
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _sc = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function updateImpacts(dt) {
  for (const w of waves) { if (!w.m.visible) continue; w.t += dt; const k = w.t / w.max; if (k >= 1) { w.m.visible = false; continue; } w.m.scale.setScalar(0.3 + w.R * (1 - Math.pow(1 - k, 3))); w.m.material.opacity = (1 - k) * 0.9; }
  for (let i = scorches.length - 1; i >= 0; i--) { const s = scorches[i]; s.t += dt; if (s.t > 9) scorches.splice(i, 1); }
  for (let i = 0; i < scorches.length; i++) { const s = scorches[i], k = s.t < 6 ? 1 : 1 - (s.t - 6) / 3; _q.setFromAxisAngle(_up, s.rot); _m4.compose(_v.set(s.x, 0.04 + i * 0.0004, s.z), _q, _sc.set(s.s * k, 1, s.s * k)); scorchMesh.setMatrixAt(i, _m4); }
  scorchMesh.count = scorches.length; scorchMesh.instanceMatrix.needsUpdate = true;
}
// enemy health bars: camera-facing instanced quads, left-anchored fill
const MAX_HB = 90;
const hbMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }), MAX_HB * 2);
hbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hbMesh.frustumCulled = false; hbMesh.renderOrder = 12; scene.add(hbMesh);
{ const c = new THREE.Color(); for (let i = 0; i < MAX_HB * 2; i++) hbMesh.setColorAt(i, c); }
const HB_BG = new THREE.Color(0x120809), HB_FG = new THREE.Color(0xe0303e), HB_STUN = new THREE.Color(0xffe39a);
const _rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(BB_Q);
// floating damage numbers (DOM pool, projected each frame)
const dmgLayer = $('dmg');
const DN = []; for (let i = 0; i < 56; i++) { const el = document.createElement('div'); el.className = 'dn'; el.hidden = true; el._d = { t: 9 }; dmgLayer.appendChild(el); DN.push(el); }
let dnIdx = 0;
function dmgNum(x, z, v, kind, y) {
  if (v < 0.5) return;
  const el = DN[dnIdx++ % DN.length];
  el.textContent = (kind === 'heal' ? '+' : '') + fmt(v); el.className = 'dn' + (kind ? ' ' + kind : ''); el.hidden = false;
  el._d = { x: x + rand(-0.4, 0.4), z: z + rand(-0.4, 0.4), y, t: 0, vx: rand(-0.6, 0.6) };
}
const projV = new THREE.Vector3();
function toScreen(x, y, z) { projV.set(x, y, z).project(cam); return [(projV.x + 1) / 2 * innerWidth, (1 - projV.y) / 2 * innerHeight]; }
function updateDmgNums(dt, show) {
  dmgLayer.hidden = !show; if (!show) return;
  for (const el of DN) {
    if (el.hidden) continue; const d = el._d; d.t += dt;
    if (d.t > 0.85) { el.hidden = true; continue; }
    const [x, y] = toScreen(d.x + d.vx * d.t, d.y + d.t * 2.2 - d.t * d.t * 1.2, d.z), pop = d.t < 0.08 ? 1 + (0.08 - d.t) * 6 : 1;
    el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${pop.toFixed(2)})`;
    el.style.opacity = d.t > 0.55 ? ((0.85 - d.t) / 0.3).toFixed(2) : '1';
  }
}
