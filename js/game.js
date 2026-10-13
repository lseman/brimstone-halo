'use strict';
/* Brimstone Halo · simulation: the hero, the Fallen, combat, waves, loot and the lifecycle of a descent */

let P = null, S = null, W = null, state = 'title', time = 0, lastCls = 'seraph';
let eb = [], pb = [], gems = [], parts = [], enemies = [], loot = [];
const ebPool = [], pbPool = [];
const stats = { kills: 0, grazes: 0, asc: 0, time: 0, score: 0, loot: 0, deepest: 0 };
const GLOBAL = { stillT: 0 };

/* ======================= POOLS ======================= */
function spawnEB(x, z, ang, spd, c, r, turn) {
  if (eb.length >= MAX_EB) return;
  const b = ebPool.pop() || {};
  b.x = x; b.z = z; b.vx = Math.cos(ang) * spd; b.vz = Math.sin(ang) * spd; b.c = c || 0; b.r = r || 0.32; b.turn = turn || 0; b.grazed = false; b.age = 0;
  eb.push(b);
}
function removeEB(i) { ebPool.push(eb[i]); eb[i] = eb[eb.length - 1]; eb.pop(); }
function spawnPB(x, z, ang, spd, dmg, o) {
  if (pb.length >= MAX_PB) return;
  const b = pbPool.pop() || { hits: [] };
  b.x = x; b.z = z; b.vx = Math.cos(ang) * spd; b.vz = Math.sin(ang) * spd; b.spd = spd; b.dmg = dmg; b.hits.length = 0;
  b.pierce = o && o.pierce != null ? o.pierce : 0; b.life = o && o.life || 1.1; b.home = o && o.home || 0;
  b.L = o && o.L || 0.75; b.w = o && o.w || 0.13; b.col = o && o.col || C.gold; b.erase = !!(o && o.erase); b.pet = !!(o && o.pet);
  pb.push(b);
}
function spawnPart(x, y, z, vx, vy, vz, life, size, col, grav) {
  if (parts.length >= MAX_PART) parts.shift();
  parts.push({ x, y, z, vx, vy, vz, life, max: life, size, col, grav: grav ?? -6 });
}
function burst(x, z, n, col, spd, size, y) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rand(0.3, 1) * spd; spawnPart(x, y ?? 0.8, z, Math.cos(a) * s, rand(1, 6), Math.sin(a) * s, rand(0.35, 0.8), size * rand(0.6, 1.2), col); } }
function dropGem(x, z, val, kind) {
  if (gems.length >= MAX_GEM) { const g = gems[(Math.random() * gems.length) | 0]; if (g.kind === 0 && kind === 0) g.val += val; return; }
  const a = Math.random() * TAU, s = rand(1, 4);
  gems.push({ x, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, val, kind: kind || 0, pull: false, t: Math.random() * 6 });
}
function recycleAll(arr, pool) { for (const b of arr) pool.push(b); arr.length = 0; }

/* ======================= HERO MODELS ======================= */
const pGroup = new THREE.Group(); scene.add(pGroup);
const HERO = {};
function heroModel(cls) {
  if (!HERO[cls]) {
    const root = cls === 'seraph' ? buildSeraph() : cls === 'archangel' ? buildKnight(PAL.archangel) : buildWheels(false);
    pGroup.add(root); HERO[cls] = { root, rig: rigOf(root) };
  }
  return HERO[cls];
}
const ORB_TPL = buildOrbWheel(), orbMeshes = [];
for (let i = 0; i < 12; i++) { const m = ORB_TPL.clone(true); m.visible = false; scene.add(m); orbMeshes.push(m); }

/* ======================= HERO STATE & STATS ======================= */
function freshPlayer(cls) {
  const h = hero(cls);
  return { cls, h, equip: h.equip, bag: h.bag, x: 0, z: 4, y: 0, hp: 100, aimX: -0.7, aimZ: -0.7, aimPt: { x: 0, z: 0 }, fireT: 0,
    dashCd: 0, dashT: 0, dvx: 0, dvz: 0, dashHits: [], charges: 1,
    slots: h.skills.loadout.map(id => ({ id, cd: 0 })),
    fx: { novaT: -1, novaR: 6, novaCol: 0, aegisT: 0, whirlT: 0, whirlTick: 0, leap: null, wardT: 0, streamT: 0, streamTick: 0, wheelT: 0 },
    grace: 0, ascT: 0, inv: 0, orbA: 0, orbR: 2.4, martyrCd: 0, swingT: 0, swingA: 0, swingSide: 1,
    level: 1, xp: 0, xpNext: 10, pending: 0, ranks: {}, bagNew: false, moveAmt: 0, walkPh: 0 };
}
const xpFor = l => Math.round(9 + Math.pow(l, 1.55) * 4);
function computeStats(equip) {
  const s = Object.assign({}, BASE_STATS, CLASSES[P.cls].stats, { flags: {} });
  const rk = rankOf(P.h.xp).rank;
  for (const u of UPG) { const r = P.ranks[u.id] || 0; for (let i = 0; i < r; i++) u.apply(s); }
  const pct = { dmg: 0, atk: 0, move: 0, grace: 0, graze: 0, magnet: 0, crit: 0, critDmg: 0, cdr: 0, skill: 0, pet: 0 };
  for (const slot of SLOTS) {
    const it = equip[slot]; if (!it) continue;
    for (const m of it.mods) {
      if (m.k === 'life') s.maxHp += m.v; else if (m.k === 'armor') s.armor += m.v; else if (m.k === 'lok') s.lifeOnKill += m.v;
      else if (m.k === 'extra') { if (P.cls === 'seraph') s.shots += m.v; else if (P.cls === 'archangel') s.arc += m.v; else s.orbs += m.v; }
      else if (m.k in pct) pct[m.k] += m.v;
    }
    if (it.power) s.flags[it.power] = true;
  }
  s.dmg *= (1 + pct.dmg / 100) * (1 + RANK_BONUS.dmg * rk); s.maxHp += RANK_BONUS.life * rk; s.armor += RANK_BONUS.armor * rk;
  s.atkRate *= 1 + pct.atk / 100; s.speed *= 1 + pct.move / 100;
  s.graceMul *= 1 + pct.grace / 100; s.grazeR *= 1 + pct.graze / 100; s.magnet *= 1 + pct.magnet / 100;
  s.crit += pct.crit / 100; s.critDmg += pct.critDmg / 100; s.cdr = Math.min(0.45, pct.cdr / 100);
  s.skillPow *= 1 + pct.skill / 100; s.petPow *= 1 + pct.pet / 100;
  if (s.flags.thorns) s.orbs += 2;
  if (s.flags.patience) s.ascDur += 3;
  if (s.flags.ember) { s.skillCdMul *= 0.65; s.skillArea *= 1.3; }
  if (s.flags.tithe) s.lifeOnKill += 3;
  s.arc = Math.min(s.arc, 240); s.orbs = Math.min(s.orbs, 12);
  s.dashCdE = s.dashCd * (1 - s.cdr); s.charges = s.flags.sandals ? 2 : 1;
  s.dr = 100 / (100 + s.armor);
  s.baseDps = s.dmg * s.atkRate * Math.max(1, s.shots || 1);
  return s;
}
const skillCdOf = id => skillDef(P.cls, id).cd * S.skillCdMul * (1 - S.cdr);
function recalc() {
  const s = computeStats(P.equip);
  const oldMax = S ? S.maxHp : s.maxHp;
  S = s; P.S = s;
  if (s.maxHp > oldMax) P.hp += s.maxHp - oldMax;
  P.hp = Math.min(P.hp, s.maxHp); P.charges = Math.min(Math.max(P.charges, 1), s.charges);
  rebuildSector();
}
function earn(v) { v = Math.round(v); if (v <= 0) return; stats.score += v; SAVE.souls += v; SAVE.totals.souls += v; markDirty(); }
function gainXp(v) {
  P.xp += v;
  const before = rankOf(P.h.xp).rank; P.h.xp += v; const after = rankOf(P.h.xp).rank;
  if (after > before) { toast(`${CLASSES[P.cls].name} reaches <b>rank ${after}</b> · +2% damage, +3 life, +1 armor`, 'legend'); sfx('level'); recalc(); }
  while (P.xp >= P.xpNext) { P.xp -= P.xpNext; P.level++; P.xpNext = xpFor(P.level); P.pending++; }
  markDirty();
  if (P.pending > 0 && state === 'play') openLevelUp();
}

/* ======================= ITEMS ======================= */
function rollMod(k, l) { const A = AFFIX[k]; return { k, v: clamp(Math.round(A.roll(l) * rand(0.75, 1.15)), 1, A.cap) }; }
function makeItem(rarity, ilvl, slot) {
  slot = slot || pick(SLOTS);
  const base = slot === 'weapon' ? pick(WEAPON_BASES[P.cls]) : pick(BASES[slot]);
  const it = { id: SAVE.nextId++, slot, rarity, base, ilvl, cls: P.cls, mods: [], power: null, isNew: true, name: base };
  let impKey;
  if (slot === 'weapon') { impKey = 'dmg'; it.mods.push({ k: 'dmg', v: Math.round((8 + ilvl * 3) * rand(.85, 1.15)), imp: true }); }
  else if (slot === 'amulet' || slot === 'ring') { impKey = pick(['crit', 'grace', 'life', 'lok', 'skill']); const m = rollMod(impKey, ilvl); m.imp = true; it.mods.push(m); }
  else { impKey = 'armor'; it.mods.push({ k: 'armor', v: Math.round((5 + ilvl * 3) * (slot === 'chest' ? 1.6 : 1) * rand(.85, 1.15)), imp: true }); }
  let n = { common: 0, magic: randInt(1, 2), rare: randInt(3, 4), legend: 3 }[rarity];
  if (slot === 'weapon' && ((rarity === 'rare' && Math.random() < .3) || (rarity === 'legend' && Math.random() < .5))) { it.mods.push({ k: 'extra', v: EXTRA[P.cls].v }); n--; }
  const pool = Object.keys(AFFIX).filter(k => k !== impKey && (k !== 'move' || ['boots', 'amulet', 'ring'].includes(slot)));
  for (let i = 0; i < n && pool.length; i++) it.mods.push(rollMod(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], ilvl));
  if (rarity === 'legend') { it.power = pick(Object.keys(POWERS)); it.name = POWERS[it.power].name; }
  else if (rarity === 'rare') it.name = pick(RARE_A) + ' ' + pick(RARE_B);
  else if (rarity === 'magic') {
    const pre = it.mods.find(m => !m.imp && AFFIX[m.k] && AFFIX[m.k].pre), suf = it.mods.find(m => !m.imp && AFFIX[m.k] && AFFIX[m.k].suf);
    it.name = (pre ? AFFIX[pre.k].pre + ' ' : '') + base + (suf ? ' ' + AFFIX[suf.k].suf : '');
  }
  return it;
}
const canEquip = it => it.slot !== 'weapon' || it.cls === P.cls;
function modText(m, cls) {
  const u = m.k === 'extra' ? EXTRA[cls || P.cls].u : AFFIX[m.k].u;
  return `${m.v < 0 ? '−' : '+'}${fmt(Math.abs(m.v))}${u}`;
}
function rollRarity(boss) {
  const r = Math.random(), n = W.n;
  if (r < (boss ? 0.45 : 0.02 + n * 0.004)) return 'legend';
  if (r < (boss ? 0.95 : 0.14 + n * 0.012)) return 'rare';
  if (r < 0.55) return 'magic';
  return 'common';
}
const lootGeo = new THREE.OctahedronGeometry(0.26), beamGeo = new THREE.CylinderGeometry(.07, .07, 7, 8, 1, true);
const labelsEl = $('labels');
function dropItem(x, z, rarity, slot) {
  const it = makeItem(rarity, Math.max(1, W.n), slot);
  const g = new THREE.Group();
  const box = new THREE.Mesh(lootGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(RCOL[rarity]).multiplyScalar(2.5) })); box.castShadow = true; box.position.y = .5; box.scale.set(1, 1.5, 1); g.add(box);
  if (rarity !== 'common') { const beam = new THREE.Mesh(beamGeo, additive(RCOL[rarity], rarity === 'legend' ? .6 : rarity === 'rare' ? .38 : .22)); beam.position.y = 3.5; g.add(beam); }
  const a = Math.random() * TAU, d = rand(0.6, 1.6);
  let lx = x + Math.cos(a) * d, lz = z + Math.sin(a) * d;
  const rr = Math.hypot(lx, lz); if (rr > ARENA_R - 2) { lx *= (ARENA_R - 2) / rr; lz *= (ARENA_R - 2) / rr; }
  g.position.set(lx, 0, lz); scene.add(g);
  const el = document.createElement('div'); el.className = 'loot r-' + rarity; el.textContent = it.name; labelsEl.appendChild(el);
  loot.push({ it, x: lx, z: lz, g, box, el, t: Math.random() * 6 });
  if (loot.length > 40) { const i = loot.findIndex(l => l.it.rarity === 'common'); removeLoot(i >= 0 ? i : 0); }
  if (rarity === 'legend') { sfx('legend'); toast(`A legendary relic falls: <b>${esc(it.name)}</b>`, 'legend'); }
  else if (rarity === 'rare') sfx('rare');
}
function removeLoot(i) { const l = loot[i]; scene.remove(l.g); l.el.remove(); loot.splice(i, 1); }
function clearLoot() { while (loot.length) removeLoot(0); }
function takeLoot(i) {
  const l = loot[i], it = l.it;
  if (P.bag.length >= BAG_SIZE) return false;
  P.bag.push(it); P.bagNew = true; stats.loot++; markDirty();
  toast(`${TIER_LABEL[it.rarity]} ${SLOT_LABEL[it.slot].toLowerCase()}: <b>${esc(it.name)}</b>`, it.rarity); sfx('pickup');
  if (stats.loot === 1 && SAVE.totals.runs <= 2) showTip(input.touch ? 'Open the reliquary from your belt to equip it' : 'Press I to open the reliquary and equip it');
  burst(l.x, l.z, 10, new THREE.Color(RCOL[it.rarity]), 3, 0.14, 0.6);
  removeLoot(i); return true;
}

/* ======================= THE FALLEN ======================= */
let nextId = 1;
function spawnEnemy(type, x, z) {
  const T = ETYPES[type];
  const hpMul = type === 'boss' ? 1 + (W.n / 5 - 1) * 0.7 : 1 + (W.n - 1) * 0.17;
  const m = makeEnemyModel(type), holder = new THREE.Group();
  holder.add(m.root); holder.add(blob(T.r * 2.8));
  holder.position.set(x, 0, z); holder.scale.setScalar(0.01); scene.add(holder);
  const e = { id: nextId++, type, x, z, hp: T.hp * hpMul, maxHp: T.hp * hpMul, r: T.r, speed: T.speed * rand(0.9, 1.1), T,
    mesh: holder, rig: m.rig, flashMat: m.flash, flashT: 0, stun: 0, spawnT: type === 'boss' ? 1.6 : 0.8, cd: rand(0.8, 2.2), cd2: rand(1, 3),
    a: Math.random() * TAU, b: 0, k: 0, t: Math.random() * 10, phase: 1, wx: x, wz: z, orbT: 0, petT: 0, dead: false, burstOn: true, burstT: 0, mvx: 0, mvz: 0, punch: 0, moving: 0 };
  enemies.push(e);
  burst(x, z, type === 'boss' ? 60 : 14, new THREE.Color(T.col), type === 'boss' ? 9 : 4, 0.18, 0.2);
  return e;
}
function removeEnemy(i) { const e = enemies[i]; scene.remove(e.mesh); e.flashMat.dispose(); enemies.splice(i, 1); }

function freshWave() { return { n: 0, queue: [], spawnT: 0, interval: 1, between: 0, active: false, boss: null, bossIdx: 0 }; }
function spawnPoint() {
  for (let t = 0; t < 30; t++) {
    const a = Math.random() * TAU, r = rand(12, ARENA_R - 3), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - P.x, z - P.z) < 10) continue;
    if (pillars.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 1.5)) continue;
    return [x, z];
  }
  return [-P.x * 0.5, -P.z * 0.5];
}
const bossName = () => BOSSES[W.bossIdx % BOSSES.length];
function startWave(n) {
  W.n = n; W.active = true; W.spawnT = 0.6; stats.deepest = Math.max(stats.deepest, n);
  if (n % 5 === 0) {
    W.queue = ['boss']; W.bossIdx = n / 5 - 1;
    const [nm, ep] = bossName(); showBanner(nm, `Circle ${roman(n)} · ${ep}`);
  } else {
    const count = 6 + Math.floor(n * 2.3), q = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random(); let t = 'imp';
      if (n >= 2 && r < 0.32) t = 'caster';
      if (n >= 3 && r < 0.16) t = 'spinner';
      if (n >= 4 && r < 0.07) t = 'brute';
      q.push(t);
    }
    W.queue = q; W.interval = Math.max(0.28, 1.15 - n * 0.06);
    showBanner(`Circle ${roman(n)}`, n === 1 ? 'graze the fire · gather grace' : `${count} of the Fallen rise`);
  }
  sfx('wave');
}
function updateWaves(dt) {
  if (W.active) {
    W.spawnT -= dt;
    if (W.queue.length && W.spawnT <= 0) {
      const t = W.queue.shift();
      if (t === 'boss') { W.boss = spawnEnemy('boss', 0, -Math.sign(P.z || 1) * 12); W.spawnT = 2; }
      else { const [x, z] = spawnPoint(); spawnEnemy(t, x, z); W.spawnT = W.interval * rand(0.6, 1.3); }
    }
    if (!W.queue.length && !enemies.length) {
      W.active = false; W.between = 3;
      P.hp = Math.min(S.maxHp, P.hp + S.maxHp * 0.15);
      showBanner('Circle cleared', 'the flames gutter · life returns');
      for (const b of eb) burst(b.x, b.z, 1, C.gold, 2, 0.12, 0.6);
      recycleAll(eb, ebPool); saveNow();
    }
  } else if (W.between > 0) { W.between -= dt; if (W.between <= 0) startWave(W.n + 1); }
}

/* ======================= ENEMY AI ======================= */
const bm = () => Math.min(1 + W.n * 0.028, 1.65);
function ring(x, z, n, spd, off, c, r, turn) { for (let i = 0; i < n; i++) spawnEB(x, z, off + TAU * i / n, spd, c, r, turn); }
function fan(x, z, base, n, spread, spd, c, r) { for (let i = 0; i < n; i++) spawnEB(x, z, base + (n > 1 ? -spread / 2 + spread * i / (n - 1) : 0), spd, c, r); }
const angTo = e => Math.atan2(P.z - e.z, P.x - e.x);
function updateEnemy(e, dt) {
  const T = e.T; e.t += dt;
  if (e.spawnT > 0) { e.spawnT -= dt; const s = 1 - Math.max(0, e.spawnT) / (e.type === 'boss' ? 1.6 : 0.8); e.mesh.scale.setScalar(Math.max(0.01, s)); e.mesh.position.set(e.x, 0, e.z); animEnemy(e, dt, 0, 0); return; }
  const slow = GLOBAL.stillT > 0 ? 0.5 : 1, edt = dt * slow;
  const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  let mvx = 0, mvz = 0; const M = bm();
  if (e.stun > 0) {
    e.stun -= dt; if (Math.random() < 0.15) spawnPart(e.x + rand(-0.4, 0.4), 2 + e.r, e.z + rand(-0.4, 0.4), 0, 1, 0, 0.5, 0.12, C.gold, 0);
  } else switch (e.type) {
    case 'imp':
      mvx = ux; mvz = uz; e.cd -= edt;
      if (e.cd <= 0 && d < 20) { e.cd = rand(2, 2.8); fan(e.x, e.z, angTo(e), W.n >= 6 ? 5 : 3, W.n >= 6 ? 0.6 : 0.36, 6.4 * M, 0, 0.3); }
      break;
    case 'caster': {
      const want = d < 9 ? -1 : d > 13 ? 1 : 0; mvx = ux * want - uz * 0.6; mvz = uz * want + ux * 0.6; e.cd -= edt;
      if (e.cd <= 0) { e.cd = rand(2.8, 3.6); e.k++; const n = 10 + Math.min(14, Math.floor(W.n / 2) * 2);
        ring(e.x, e.z, n, 4.4 * M, e.k * 0.17, 1, 0.34); if (W.n >= 7) ring(e.x, e.z, n, 3.1 * M, e.k * 0.17 + Math.PI / n, 1, 0.3); }
      break; }
    case 'spinner': {
      if (Math.hypot(e.wx - e.x, e.wz - e.z) < 1) { const [x, z] = spawnPoint(); e.wx = x * 0.7; e.wz = z * 0.7; }
      const wx = e.wx - e.x, wz = e.wz - e.z, wd = Math.hypot(wx, wz) || 1; mvx = wx / wd; mvz = wz / wd;
      e.burstT -= edt; if (e.burstT <= 0) { e.burstOn = !e.burstOn; e.burstT = e.burstOn ? 2.6 : 1.6; }
      e.cd -= edt;
      if (e.burstOn && e.cd <= 0) { e.cd = 0.12; e.a += 0.23; const arms = W.n >= 8 ? 4 : 3; for (let k = 0; k < arms; k++) spawnEB(e.x, e.z, e.a + k * TAU / arms, 5.2 * M, 2, 0.3); }
      break; }
    case 'brute':
      mvx = ux; mvz = uz; e.cd -= edt;
      if (e.cd <= 0 && d < 22) { e.cd = 3.6; fan(e.x, e.z, angTo(e), 9, 1.1, 4.2 * M, 0, 0.5); }
      break;
    case 'boss': updateBoss(e, edt, ux, uz); mvx = e.mvx; mvz = e.mvz; break;
  }
  e.x += mvx * e.speed * edt; e.z += mvz * e.speed * edt; e.moving = Math.hypot(mvx, mvz);
  for (const p of pillars) { const px = e.x - p.x, pz = e.z - p.z, pd = Math.hypot(px, pz), min = p.r + e.r; if (pd < min && pd > 0) { e.x = p.x + px / pd * min; e.z = p.z + pz / pd * min; } }
  const rr = Math.hypot(e.x, e.z), lim = ARENA_R - e.r - 0.5; if (rr > lim) { e.x *= lim / rr; e.z *= lim / rr; }
  if (d < e.r + 0.45 && e.stun <= 0) hurt(T.contact);
  if (S.orbs) {
    e.orbT -= dt;
    if (e.orbT <= 0) {
      const big = P.fx.wheelT > 0, hr = big ? 0.75 : 0.45;
      for (let i = 0; i < S.orbs; i++) { const a = P.orbA + i * TAU / S.orbs; const ox = P.x + Math.cos(a) * P.orbR, oz = P.z + Math.sin(a) * P.orbR;
        if (Math.hypot(ox - e.x, oz - e.z) < e.r + hr) { playerHit(e, S.dmg * S.orbDmg * (big ? S.skillPow : 1)); e.orbT = big ? 0.15 : 0.3; break; } }
    }
  }
  e.mesh.rotation.y = Math.atan2(ux, uz);
  animEnemy(e, dt, e.moving * slow, d);
}
function animEnemy(e, dt, moving, d) {
  const r = e.rig, t = e.t, stunned = e.stun > 0;
  let y = 0;
  switch (e.type) {
    case 'imp':
      animWings(r, t, 1, stunned ? 0.2 : 1); animLegs(r, t * 11, 0.55 * moving);
      if (r.parts.tail) r.parts.tail.rotation.y = Math.sin(t * 4) * 0.5;
      if (r.parts.armL) { r.parts.armL.rotation.x = -0.3 + Math.sin(t * 11) * 0.4 * moving; r.parts.armR.rotation.x = -0.3 - Math.sin(t * 11) * 0.4 * moving; }
      y = Math.abs(Math.sin(t * 11)) * 0.08 * moving; break;
    case 'caster': animWings(r, t, 1); animSpin(r, dt); y = 0.25 + Math.sin(t * 2 + e.id) * 0.12; break;
    case 'spinner': animSpin(r, dt, stunned ? 0.1 : 1); y = Math.sin(t * 3 + e.id) * 0.1; break;
    case 'brute':
      animLegs(r, t * 5.5, 0.4 * moving);
      if (r.parts.armL) { r.parts.armL.rotation.x = Math.sin(t * 5.5) * 0.45 * moving; r.parts.armR.rotation.x = -Math.sin(t * 5.5) * 0.45 * moving; }
      if (e.cd < 0.5) { r.parts.armL.rotation.x = r.parts.armR.rotation.x = -1.2 * (1 - e.cd / 0.5); }
      y = Math.abs(Math.sin(t * 5.5)) * 0.05 * moving; break;
    case 'boss': animWings(r, t, 1, 0.8); animSpin(r, dt); animLegs(r, t * 4, 0.35 * moving); y = Math.sin(t * 1.5) * 0.15; break;
  }
  e.flashT = Math.max(0, e.flashT - dt); setFlash(e.flashMat, e.flashT > 0 ? e.flashT / 0.08 : 0);
  e.punch = Math.max(0, e.punch - dt * 7);
  if (e.spawnT <= 0) { e.mesh.position.set(e.x, y, e.z); e.mesh.scale.set(1 + e.punch * 0.2, 1 - e.punch * 0.12, 1 + e.punch * 0.2); }
}
function updateBoss(e, dt, ux, uz) {
  const f = e.hp / e.maxHp, ph = f > 0.66 ? 1 : f > 0.33 ? 2 : 3, M = bm();
  if (ph !== e.phase) {
    e.phase = ph; shake(1.2); sfx('phase');
    for (const b of eb) dropGem(b.x, b.z, 1, 0);
    recycleAll(eb, ebPool);
    showBanner(PHASES[ph - 1], 'the Watcher changes its song'); e.cd = 1.2; e.cd2 = 2;
  }
  e.mvx = 0; e.mvz = 0;
  if (ph === 1) {
    const tx = P.x - ux * 10, tz = P.z - uz * 10, vx = tx - e.x, vz = tz - e.z, vd = Math.hypot(vx, vz);
    if (vd > 1) { e.mvx = vx / vd * 0.6; e.mvz = vz / vd * 0.6; }
    e.cd -= dt; if (e.cd <= 0) { e.cd = 0.8; e.k++; ring(e.x, e.z, 22, 4.3 * M, e.k * 0.13, 3, 0.36, (e.k % 2 ? 1 : -1) * 0.32); }
    e.cd2 -= dt; if (e.cd2 <= 0) { e.cd2 = 1.7; fan(e.x, e.z, angTo(e), 5, 0.5, 8 * M, 0, 0.32); }
  } else if (ph === 2) {
    const oa = e.t * 0.35, tx = Math.cos(oa) * 4, tz = Math.sin(oa) * 4, vx = tx - e.x, vz = tz - e.z, vd = Math.hypot(vx, vz);
    if (vd > 0.5) { e.mvx = vx / vd; e.mvz = vz / vd; }
    e.cd -= dt;
    if (e.cd <= 0) { e.cd = 0.085; e.a += 0.19; e.b -= 0.26; for (let k = 0; k < 4; k++) { spawnEB(e.x, e.z, e.a + k * TAU / 4, 5.4 * M, 3, 0.32); spawnEB(e.x, e.z, e.b + k * TAU / 4, 3.8 * M, 1, 0.28); } }
    e.cd2 -= dt; if (e.cd2 <= 0) { e.cd2 = 6; for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; spawnEnemy('imp', e.x + Math.cos(a) * 4, e.z + Math.sin(a) * 4); } }
  } else {
    if (!e.dest || Math.hypot(e.dest[0] - e.x, e.dest[1] - e.z) < 1) { const a = Math.random() * TAU, r = rand(5, 16); e.dest = [Math.cos(a) * r, Math.sin(a) * r]; }
    const vx = e.dest[0] - e.x, vz = e.dest[1] - e.z, vd = Math.hypot(vx, vz) || 1; e.mvx = vx / vd * 1.6; e.mvz = vz / vd * 1.6;
    e.cd -= dt;
    if (e.cd <= 0) { e.cd = 0.5; e.k++; const n = 30, gap = angTo(e) + Math.sin(e.k * 0.7) * 0.9; for (let i = 2; i < n - 2; i++) spawnEB(e.x, e.z, gap + TAU * i / n, 4.6 * M, 3, 0.36); }
    e.cd2 -= dt;
    if (e.cd2 <= 0) { e.cd2 = 0.1; e.burstT += 1; if ((e.burstT % 26) < 9) spawnEB(e.x, e.z, angTo(e) + rand(-0.06, 0.06), 10.5 * M, 4, 0.3); }
  }
}

/* ======================= COMBAT ======================= */
function playerHit(e, dmg) {
  if (e.dead || e.spawnT > 0) return;
  let d = dmg; const crit = Math.random() < S.crit;
  if (crit) { d *= S.critDmg; spawnPart(e.x, 1.4, e.z, 0, 4, 0, 0.4, 0.5, C.white, -4); }
  e.hp -= d; e.flashT = 0.08; e.punch = Math.min(1, e.punch + (crit ? 1 : 0.5));
  dmgNum(e.x, e.z, d, crit ? 'crit' : '', T_HB(e));
  if (e.type !== 'boss' && S.slay && e.hp > 0 && e.hp / e.maxHp < S.slay) { e.hp = 0; burst(e.x, e.z, 10, C.gold, 6, 0.2); }
  if (e.hp <= 0) killEnemy(e);
}
const T_HB = e => e.type === 'boss' ? 5.5 : e.T.hb;
function killEnemy(e) {
  e.dead = true; stats.kills++; SAVE.totals.kills++;
  const T = e.T, col = new THREE.Color(T.col);
  shockwave(e.x, e.z, T.col, e.type === 'boss' ? 14 : e.r * 4.2); scorch(e.x, e.z, e.r * 2.6);
  if (e.type === 'brute') hitStop = Math.max(hitStop, 0.06); else if (e.type === 'boss') hitStop = 0.35;
  earn(T.score * (1 + Math.floor(W.n / 3))); addGrace(e.type === 'boss' ? 30 : 1.5);
  if (S.lifeOnKill) healHero(S.lifeOnKill, true);
  burst(e.x, e.z, e.type === 'boss' ? 160 : 22 + T.xp * 4, col, e.type === 'boss' ? 16 : 7, e.type === 'boss' ? 0.35 : 0.2);
  burst(e.x, e.z, 8, C.white, 5, 0.14);
  const xp = Math.round((T.xp + Math.floor(W.n / 4)) * (S.flags.raziel ? 1.4 : 1));
  const n = e.type === 'boss' ? 30 : Math.min(4, xp);
  for (let i = 0; i < n; i++) dropGem(e.x, e.z, Math.max(1, Math.round(xp / n)), 0);
  if (Math.random() < (e.type === 'brute' ? 0.25 : 0.035)) dropGem(e.x, e.z, Math.round(S.maxHp * 0.12), 1);
  if (e.type === 'boss') { dropItem(e.x, e.z, 'legend'); dropItem(e.x, e.z, rollRarity(true)); dropItem(e.x, e.z, rollRarity(true)); }
  else if (Math.random() < T.drop) dropItem(e.x, e.z, rollRarity(false));
  if (e.type === 'brute') ring(e.x, e.z, 16, 3.8 * bm(), Math.random(), 2, 0.34);
  if (e.type === 'boss') {
    shake(2.5); sfx('bossdie');
    for (const b of eb) dropGem(b.x, b.z, 1, 0);
    recycleAll(eb, ebPool);
    for (let i = 0; i < 4; i++) dropGem(e.x, e.z, Math.round(S.maxHp * 0.2), 1);
    W.boss = null;
    const had = gatesFor(P.h).length; P.h.deepest = Math.max(P.h.deepest, W.n); const now = gatesFor(P.h);
    if (now.length > had) toast(`A gate opens: you may now begin a descent at <b>Circle ${roman(now[now.length - 1])}</b>`, 'legend');
    saveNow();
  } else { shake(0.25); sfx('boom'); }
}
let shakeAmt = 0;
function shake(a) { shakeAmt = Math.min(3, shakeAmt + a * (reduced ? 0.3 : 1)); }
function healHero(v, quiet) { const before = P.hp; P.hp = Math.min(S.maxHp, P.hp + v); if (!quiet && P.hp - before >= 1) dmgNum(P.x, P.z, P.hp - before, 'heal', 2.6); }
function addGrace(v) {
  if (P.ascT > 0) return;
  const was = P.grace >= 100;
  P.grace = Math.min(100, P.grace + v * S.graceMul);
  if (!was && P.grace >= 100) { sfx('ready'); showTip(input.touch ? 'Grace is full · tap the halo to ascend' : 'Grace is full · press E to ascend'); }
}
let hurtFlash = 0;
function hurt(dmg) {
  if (P.inv > 0 || P.ascT > 0 || P.dashT > 0 || P.fx.leap || state !== 'play') return;
  if (P.fx.wardT > 0) dmg *= 0.5;
  P.hp -= dmg * S.dr; P.inv = 1.0; shake(1); sfx('hurt'); hurtFlash = 1; hitStop = Math.max(hitStop, 0.07);
  for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; if (Math.hypot(b.x - P.x, b.z - P.z) < 2.6) { burst(b.x, b.z, 2, C.white, 3, 0.1, 0.6); removeEB(i); } }
  if (P.hp <= 0) { P.hp = 0; die(); return; }
  if (S.flags.martyr && P.martyrCd <= 0) { P.martyrCd = 3; useSkill(0, true); }
}
function dash() {
  if (state !== 'play' || P.charges <= 0 || P.fx.leap || P.dashT > 0) return;
  let mx = moveVec.x, mz = moveVec.z;
  if (!mx && !mz) { mx = P.aimX; mz = P.aimZ; }
  const l = Math.hypot(mx, mz) || 1, charge = P.cls === 'archangel', spd = charge ? 26 : 30;
  P.dvx = mx / l * spd; P.dvz = mz / l * spd; P.dashT = charge ? 0.26 : 0.17; P.dashHits.length = 0;
  P.charges--; if (P.dashCd <= 0) P.dashCd = S.dashCdE; sfx('dash');
}
function ascend() {
  if (state !== 'play' || P.grace < 100 || P.ascT > 0) return;
  P.ascT = S.ascDur; P.grace = 0; stats.asc++; sfx('ascend'); shake(1.4);
  showBanner('Ascension', 'their fire becomes your light');
  for (const b of eb) { spawnPart(b.x, BULLET_Y, b.z, rand(-1, 1), rand(4, 8), rand(-1, 1), 0.9, 0.16, C.gold, -2); if (Math.random() < 0.25) dropGem(b.x, b.z, 1, 0); }
  recycleAll(eb, ebPool); hideTip();
}

/* ======================= HERO UPDATE ======================= */
const moveVec = new THREE.Vector3();
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BULLET_Y), groundHit = new THREE.Vector3();
function nearestEnemy(x, z, maxD) { let best = null, bd = maxD * maxD; for (const e of enemies) { if (e.spawnT > 0 || e.dead) continue; const d = (e.x - x) ** 2 + (e.z - z) ** 2; if (d < bd) { bd = d; best = e; } } return best; }
const down = (...c) => c.some(k => keys.has(k));
function inSwing(x, z, extra) {
  const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz);
  if (d > S.reach + extra) return false;
  if (d < 0.9) return true;
  return Math.abs(wrapAng(Math.atan2(dz, dx) - P.swingA)) <= S.arc * DEG / 2 + Math.atan2(extra, d);
}
function confine(o, rad) {
  for (const p of pillars) { const px = o.x - p.x, pz = o.z - p.z, pd = Math.hypot(px, pz), min = p.r + rad; if (pd < min && pd > 0) { o.x = p.x + px / pd * min; o.z = p.z + pz / pd * min; } }
  const rr = Math.hypot(o.x, o.z), lim = ARENA_R - 0.8; if (rr > lim) { o.x *= lim / rr; o.z *= lim / rr; }
}
function updatePlayer(dt) {
  let sx = 0, sy = 0;
  if (down('KeyW', 'ArrowUp')) sy += 1;
  if (down('KeyS', 'ArrowDown')) sy -= 1;
  if (down('KeyA', 'ArrowLeft')) sx -= 1;
  if (down('KeyD', 'ArrowRight')) sx += 1;
  if (input.stickId !== null) { sx += input.sx; sy -= input.sy; }
  const sl = Math.hypot(sx, sy); if (sl > 1) { sx /= sl; sy /= sl; }
  moveVec.set(SCR_R.x * sx + SCR_U.x * sy, 0, SCR_R.z * sx + SCR_U.z * sy);
  const focus = down('ShiftLeft', 'ShiftRight');
  for (const s of P.slots) s.cd = Math.max(0, s.cd - dt);
  P.inv = Math.max(0, P.inv - dt); P.martyrCd -= dt;
  if (P.charges < S.charges) { P.dashCd -= dt; if (P.dashCd <= 0) { P.charges++; P.dashCd = P.charges < S.charges ? S.dashCdE : 0; } }
  const ox = P.x, oz = P.z;
  if (P.fx.leap) { /* skills.js moves the hero through the air */ }
  else if (P.dashT > 0) {
    P.dashT -= dt; P.x += P.dvx * dt; P.z += P.dvz * dt;
    spawnPart(P.x, 1, P.z, 0, 0.5, 0, 0.35, 0.3, P.cls === 'ophan' ? C.eye : C.gold, 0);
    if (P.cls === 'archangel') for (const e of enemies) { if (e.dead || e.spawnT > 0 || P.dashHits.includes(e.id)) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < e.r + 1.1) { P.dashHits.push(e.id); playerHit(e, S.dmg * 1.2); if (e.type !== 'boss' && d > 0) { e.x += (e.x - P.x) / d * 1.8; e.z += (e.z - P.z) / d * 1.8; } } }
    if (P.dashT <= 0 && S.flags.wings) for (let i = 0; i < 12; i++) spawnPB(P.x, P.z, i * TAU / 12, 20, S.dmg * (P.cls === 'archangel' ? .5 : 1), { pierce: 1, life: .8 });
  } else {
    const spd = S.speed * (focus ? 0.42 : 1) * (P.ascT > 0 ? 1.15 : 1) * (P.fx.whirlT > 0 ? 0.85 : 1);
    P.x += moveVec.x * spd * dt; P.z += moveVec.z * spd * dt;
  }
  confine(P, 0.45);
  P.moveAmt = lerp(P.moveAmt, Math.min(1, Math.hypot(P.x - ox, P.z - oz) / dt / 8), Math.min(1, dt * 10));

  // aim
  const melee = P.cls === 'archangel';
  let target = null;
  if (input.touch) {
    target = nearestEnemy(P.x, P.z, melee ? 14 : 22);
    if (target) { const ax = target.x - P.x, az = target.z - P.z, al = Math.hypot(ax, az) || 1; P.aimX = ax / al; P.aimZ = az / al; P.aimPt.x = target.x; P.aimPt.z = target.z; }
    else { if (moveVec.lengthSq() > 0.01) { const l = moveVec.length(); P.aimX = moveVec.x / l; P.aimZ = moveVec.z / l; } P.aimPt.x = P.x + P.aimX * 7; P.aimPt.z = P.z + P.aimZ * 7; }
  } else {
    ndc.set(input.cx / innerWidth * 2 - 1, -(input.cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (ray.ray.intersectPlane(aimPlane, groundHit)) {
      const ax = groundHit.x - P.x, az = groundHit.z - P.z, al = Math.hypot(ax, az);
      if (al > 0.05) { P.aimX = ax / al; P.aimZ = az / al; }
      P.aimPt.x = groundHit.x; P.aimPt.z = groundHit.z;
      reticle.position.set(groundHit.x, BULLET_Y, groundHit.z);
    }
  }
  // attack
  P.fireT -= dt;
  const asc = P.ascT > 0;
  let wantFire = (input.touch ? !!target : (input.autofire || input.firing)) && !P.fx.leap && P.fx.whirlT <= 0;
  if (melee && input.touch && target) wantFire = wantFire && (Math.hypot(target.x - P.x, target.z - P.z) < S.reach + target.r + 1.2 || eb.some(b => (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < S.reach * S.reach));
  if (wantFire && P.fireT <= 0) {
    P.fireT = 1 / (S.atkRate * (asc ? 1.8 : 1));
    if (melee) swing(asc);
    else {
      const n = S.shots + (asc ? 2 : 0), spread = n > 1 ? Math.min((P.cls === 'ophan' ? 0.35 : 0.11) * (n - 1), 1.4) : 0;
      const base = Math.atan2(P.aimZ, P.aimX);
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? -spread / 2 + spread * i / (n - 1) : 0) + rand(-0.02, 0.02);
        if (P.cls === 'ophan') spawnPB(P.x + Math.cos(a) * 0.9, P.z + Math.sin(a) * 0.9, a, S.bulletSpeed, S.dmg * (asc ? 1.5 : 1), { pierce: S.pierce, home: S.homing, life: 1.6, L: .3, w: .26, col: C.eye });
        else spawnPB(P.x + Math.cos(a) * 0.6, P.z + Math.sin(a) * 0.6, a, S.bulletSpeed, S.dmg * (asc ? 1.5 : 1), { pierce: S.pierce, home: S.homing });
      }
      sfx('shoot');
    }
  }
  if (P.swingT > 0) {
    P.swingT -= dt;
    for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; if (inSwing(b.x, b.z, b.r)) { spawnPart(b.x, BULLET_Y, b.z, rand(-3, 3), rand(2, 5), rand(-3, 3), 0.35, 0.14, C.flame, -8); addGrace(0.9); removeEB(i); sfx('parry'); } }
  }
  updateSkillFx(dt);
  const wheeling = P.fx.wheelT > 0;
  P.orbR += ((wheeling ? 5 * S.skillArea : 2.4) - P.orbR) * Math.min(1, dt * 6);
  P.orbA += dt * (wheeling ? 7 : 2.7);
  if (asc) {
    P.ascT -= dt;
    for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; if (Math.hypot(b.x - P.x, b.z - P.z) < 8) { spawnPart(b.x, BULLET_Y, b.z, 0, rand(3, 6), 0, 0.7, 0.14, C.gold, -1); if (Math.random() < 0.15) dropGem(b.x, b.z, 1, 0); removeEB(i); } }
    if (Math.random() < 0.6) spawnPart(P.x + rand(-1.5, 1.5), 0.2, P.z + rand(-1.5, 1.5), 0, rand(5, 10), 0, 1, 0.12, C.gold, 0);
  }
  if (S.orbs) {
    const hr = wheeling ? 0.75 : 0.45;
    for (let i = 0; i < S.orbs; i++) {
      const a = P.orbA + i * TAU / S.orbs, ox2 = P.x + Math.cos(a) * P.orbR, oz2 = P.z + Math.sin(a) * P.orbR;
      for (let j = eb.length - 1; j >= 0; j--) { const b = eb[j]; const dx = b.x - ox2, dz = b.z - oz2; if (dx * dx + dz * dz < (hr + b.r) ** 2) { spawnPart(b.x, BULLET_Y, b.z, 0, 2, 0, 0.3, 0.12, C.gold, 0); if (wheeling) addGrace(0.4); removeEB(j); } }
    }
  }
}
function swing(asc) {
  P.swingT = 0.14; P.swingA = Math.atan2(P.aimZ, P.aimX); P.swingSide *= -1; sfx('swing');
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    if (inSwing(e.x, e.z, e.r)) {
      playerHit(e, S.dmg * (asc ? 1.5 : 1));
      const d = Math.hypot(e.x - P.x, e.z - P.z);
      if (e.type !== 'boss' && d > 0) { e.x += (e.x - P.x) / d * 0.7; e.z += (e.z - P.z) / d * 0.7; }
      spawnPart(e.x, 1, e.z, rand(-3, 3), rand(2, 5), rand(-3, 3), 0.4, 0.2, C.flame);
    }
  }
  const n = S.waves + (asc ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = P.swingA + (n > 1 ? (-0.5 + i / (n - 1)) * S.arc * DEG * 0.6 : 0);
    spawnPB(P.x + Math.cos(a), P.z + Math.sin(a), a, 18, S.dmg * 0.6, { pierce: 99, life: 0.55, L: 0.3, w: 1.0, col: C.flame, erase: true });
  }
}

/* ======================= BULLETS · SOULS · RELICS · SPARKS ======================= */
function updateEnemyBullets(dt) {
  const gr = S.grazeR, px = P.x, pz = P.z, safe = P.inv > 0 || P.dashT > 0 || P.ascT > 0 || !!P.fx.leap, lim2 = (ARENA_R + 4) ** 2;
  const bdt = dt * (GLOBAL.stillT > 0 ? 0.25 : 1);
  for (let i = eb.length - 1; i >= 0; i--) {
    const b = eb[i]; if (!b) continue;   // a hit can clear nearby bullets mid-loop
    b.age += dt;
    if (b.turn) { const c = Math.cos(b.turn * bdt), s = Math.sin(b.turn * bdt), vx = b.vx * c - b.vz * s; b.vz = b.vx * s + b.vz * c; b.vx = vx; }
    b.x += b.vx * bdt; b.z += b.vz * bdt;
    let kill = b.x * b.x + b.z * b.z > lim2;
    if (!kill) for (const p of pillars) { const dx = b.x - p.x, dz = b.z - p.z; if (dx * dx + dz * dz < p.r * p.r) { kill = true; spawnPart(b.x, BULLET_Y, b.z, rand(-2, 2), 2, rand(-2, 2), 0.25, 0.1, BCOL[b.c], -6); break; } }
    if (!kill) {
      const dx = b.x - px, dz = b.z - pz, d2 = dx * dx + dz * dz, hit = 0.2 + b.r * 0.62;
      if (d2 < hit * hit && !safe) { kill = true; hurt(12 + Math.floor(W.n * 0.6)); }
      else if (!b.grazed && d2 < (gr + b.r) ** 2) {
        b.grazed = true; stats.grazes++; earn(2); addGrace(2.2);
        spawnPart(b.x, BULLET_Y, b.z, -dx * 3, 2, -dz * 3, 0.28, 0.12, C.white, 0); sfx('graze');
        if (S.flags.echo) { const t = nearestEnemy(P.x, P.z, 18); if (t) spawnPB(P.x, P.z, Math.atan2(t.z - P.z, t.x - P.x), 24, S.dmg * (P.cls === 'archangel' ? 0.35 : 0.7), { home: 3, life: 1.4 }); }
      }
    }
    if (kill && eb[i] === b) removeEB(i);
  }
}
function updatePlayerBullets(dt) {
  for (let i = pb.length - 1; i >= 0; i--) {
    const b = pb[i]; b.life -= dt;
    if (b.home) {
      const t = nearestEnemy(b.x, b.z, 10);
      if (t) { const cur = Math.atan2(b.vz, b.vx), df = wrapAng(Math.atan2(t.z - b.z, t.x - b.x) - cur), st = clamp(df, -b.home * 3.2 * dt, b.home * 3.2 * dt), na = cur + st; b.vx = Math.cos(na) * b.spd; b.vz = Math.sin(na) * b.spd; }
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    let kill = b.life <= 0 || b.x * b.x + b.z * b.z > (ARENA_R + 2) ** 2;
    if (!kill && !b.erase) for (const p of pillars) { const dx = b.x - p.x, dz = b.z - p.z; if (dx * dx + dz * dz < p.r * p.r) { kill = true; spawnPart(b.x, BULLET_Y, b.z, rand(-2, 2), 3, rand(-2, 2), 0.25, 0.1, b.col); break; } }
    if (!kill && b.erase) for (let j = eb.length - 1; j >= 0; j--) { const e = eb[j]; const dx = e.x - b.x, dz = e.z - b.z; if (dx * dx + dz * dz < (b.w + e.r) ** 2) { spawnPart(e.x, BULLET_Y, e.z, 0, 3, 0, 0.3, 0.12, C.flame, -4); removeEB(j); } }
    if (!kill) for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || b.hits.includes(e.id)) continue;
      const dx = e.x - b.x, dz = e.z - b.z, rr = e.r + Math.max(0.25, b.w * 0.6);
      if (dx * dx + dz * dz < rr * rr) {
        playerHit(e, b.dmg); b.hits.push(e.id);
        if (b.pet) petStruck();
        spawnPart(b.x, 0.8, b.z, -b.vx * 0.08 + rand(-2, 2), rand(1, 3), -b.vz * 0.08 + rand(-2, 2), 0.25, 0.12, b.col);
        sfx('hit');
        if (b.pierce-- <= 0) kill = true;
        break;
      }
    }
    if (kill) { pbPool.push(b); pb[i] = pb[pb.length - 1]; pb.pop(); }
  }
}
function collectGem(i) {
  const g = gems[i];
  if (g.kind === 1) { healHero(g.val); sfx('heal'); burst(P.x, P.z, 8, C.heal, 3, 0.14, 1); }
  else { gainXp(g.val); sfx('gem'); }
  gems[i] = gems[gems.length - 1]; gems.pop();
}
function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i]; g.t += dt;
    const dx = P.x - g.x, dz = P.z - g.z, d = Math.hypot(dx, dz) || 1;
    if (d < S.magnet || g.pull || (P.ascT > 0 && d < 14) || (!W.active && W.between > 0)) g.pull = true;
    if (g.pull) { const s = 10 + Math.min(20, g.t * 6); g.vx = dx / d * s; g.vz = dz / d * s; } else { g.vx *= 0.9; g.vz *= 0.9; }
    g.x += g.vx * dt; g.z += g.vz * dt;
    if (d < 0.7) collectGem(i);
  }
}
let bagFullT = 0;
function updateLoot(dt) {
  bagFullT -= dt;
  for (let i = loot.length - 1; i >= 0; i--) {
    const l = loot[i]; l.t += dt;
    if (Math.hypot(P.x - l.x, P.z - l.z) < 1.15 && !takeLoot(i) && bagFullT <= 0) {
      showTip(input.touch ? 'Your bag is full · open the reliquary to salvage' : 'Your bag is full · press I to salvage'); bagFullT = 3;
    }
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vy += p.grav * dt; p.vx *= 0.96; p.vz *= 0.96; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
  }
}

/* ======================= LIFECYCLE ======================= */
function resetWorld() {
  for (let i = enemies.length - 1; i >= 0; i--) removeEnemy(i);
  recycleAll(eb, ebPool); recycleAll(pb, pbPool); gems = []; parts = []; clearLoot(); scorches = [];
  for (const w of waves) w.m.visible = false;
  for (const s of strikes) { s.fx.busy = false; s.fx.col.visible = s.fx.tele.visible = false; } strikes.length = 0;
  GLOBAL.stillT = 0; hurtFlash = 0; shakeAmt = 0; hitStop = 0;
}
function setHero(cls) {
  lastCls = cls; P = freshPlayer(cls); S = null;
  if (!P.h.starter) { P.h.starter = true; if (!P.equip.weapon) { const w = makeItem('common', 1, 'weapon'); w.isNew = false; P.equip.weapon = w; } markDirty(); }
  recalc(); P.hp = S.maxHp;
  for (const k of CLASS_KEYS) if (HERO[k]) HERO[k].root.visible = false;
  heroModel(cls).root.visible = true;
  sectorKey = ''; rebuildSector();
}
function startRun(cls, gate) {
  initAudio(); hideOverlays(); resetWorld(); setHero(cls); W = freshWave(); refreshSkillIcons();
  gate = gatesFor(P.h).includes(gate) ? gate : 1;
  P.h.gate = gate; P.h.runs++; SAVE.totals.runs++;
  Object.assign(stats, { kills: 0, grazes: 0, asc: 0, time: 0, score: 0, loot: 0, deepest: gate });
  P.x = 0; P.z = 4; spawnPet();
  state = 'play'; showHud(true); hideTip(); camSnap();
  W.n = gate - 1; startWave(gate);
  const bonus = Math.floor((gate - 1) / 5) * 3;
  if (bonus) { P.level += bonus; P.pending += bonus; showTip(`The gate grants ${bonus} relics`); setTimeout(() => { if (state === 'play' && P.pending) openLevelUp(); }, 900); }
  else if (SAVE.totals.runs <= 2) showTip(input.touch ? 'Drag to move · your attacks find the nearest foe' : 'WASD to move · aim with the mouse · Q and R cast your choir skills');
  saveNow();
}
function die() {
  state = 'dead'; input.firing = false; sfx('die'); shake(2);
  burst(P.x, P.z, 80, C.gold, 10, 0.25, 1);
  finishRun(true);
}
function finishRun(died) {
  P.h.best = Math.max(P.h.best, stats.score);
  if (!died) for (let i = loot.length - 1; i >= 0; i--) takeLoot(i);   // walking out gathers what lies on the floor
  saveNow();
  showRunSummary(died);
}
