'use strict';
/* Brimstone Halo · companions. One walks with you at a time; they level up with souls and keep their level forever. */

let pet = null;
const PET_BUILD = { hound: buildHound, dove: buildDove, eagle: buildEagle, cherub: buildCherub };
const PET_TPL = {};
function spawnPet() {
  if (pet) { scene.remove(pet.mesh); pet = null; }
  const kind = SAVE.pets.active; if (!kind || !SAVE.pets.owned[kind]) return;
  if (!PET_TPL[kind]) PET_TPL[kind] = PET_BUILD[kind]();
  const model = PET_TPL[kind].clone(true), mesh = new THREE.Group();
  mesh.add(model); mesh.add(blob(kind === 'hound' ? 1.0 : kind === 'eagle' ? 1.1 : 0.6));
  const a = Math.random() * TAU;
  pet = { kind, lvl: SAVE.pets.owned[kind], mesh, model, rig: rigOf(model), x: P.x + Math.cos(a) * 1.6, z: P.z + Math.sin(a) * 1.6,
    alt: kind === 'hound' ? 0 : 1.8, t: 0, cd: 1, mode: 'idle', yaw: 0, healT: 4, target: null, orbit: a, stride: 0 };
  mesh.position.set(pet.x, 0, pet.z); scene.add(mesh);
}
const petPow = () => petPower(pet.lvl) * S.petPow;
function petStruck() { if (S.flags.raphael) healHero(S.maxHp * 0.02, true); }
function moveToward(p, x, z, spd, dt) {
  const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d < 1e-3) return 0;
  const step = Math.min(d, spd * dt); p.x += dx / d * step; p.z += dz / d * step;
  p.yaw = Math.atan2(dx, dz); return d - step;
}
function strongestNear(x, z, R) { let best = null; for (const e of enemies) { if (e.dead || e.spawnT > 0) continue; if (Math.hypot(e.x - x, e.z - z) > R) continue; if (!best || e.type === 'boss' || e.hp > best.hp && best.type !== 'boss') best = e; } return best; }

function updatePet(dt) {
  if (!pet) return;
  const p = pet, playing = state === 'play'; p.t += dt;
  const ox = p.x, oz = p.z;
  if (Math.hypot(P.x - p.x, P.z - p.z) > 24) { p.x = P.x - P.aimX * 2; p.z = P.z - P.aimZ * 2; }
  p.cd -= dt;
  if (p.kind === 'hound') {
    const tgt = playing ? nearestEnemy(P.x, P.z, 12) : null;
    if (tgt) {
      const left = moveToward(p, tgt.x, tgt.z, 11.5, dt);
      if (left < tgt.r + 0.55 && p.cd <= 0) { p.cd = 0.55; playerHit(tgt, (6 + S.baseDps * 0.22) * petPow()); petStruck(); sfx('bite'); spawnPart(tgt.x, 0.8, tgt.z, 0, 2, 0, 0.3, 0.2, C.white, -4); }
    } else {
      // fetch the nearest soul or relic within reach of the hero, else heel
      let best = -1, bd = 14 * 14, isLoot = false;
      if (playing) {
        for (let i = 0; i < gems.length; i++) { const g = gems[i]; if (g.pull) continue; const d = (g.x - P.x) ** 2 + (g.z - P.z) ** 2; if (d < bd) { bd = d; best = i; isLoot = false; } }
        if (P.bag.length < BAG_SIZE) for (let i = 0; i < loot.length; i++) { const l = loot[i]; const d = (l.x - P.x) ** 2 + (l.z - P.z) ** 2; if (d < bd) { bd = d; best = i; isLoot = true; } }
      }
      if (best >= 0) {
        const o = isLoot ? loot[best] : gems[best], left = moveToward(p, o.x, o.z, 11, dt);
        if (left < 0.6) { if (isLoot) takeLoot(best); else gems[best].pull = true; }
      } else {
        const hx = P.x - P.aimX * 1.6 + P.aimZ * 1.1, hz = P.z - P.aimZ * 1.6 - P.aimX * 1.1;
        if (Math.hypot(hx - p.x, hz - p.z) > 0.8) moveToward(p, hx, hz, Math.hypot(hx - p.x, hz - p.z) > 6 ? 14 : 8, dt);
        else if (!playing) p.yaw = FACE_CAM;
      }
    }
    const moved = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-4);
    p.stride += moved * dt * 3.2;
    animLegs(p.rig, p.stride, Math.min(0.7, moved * 0.08));
    if (p.rig.parts.tail) p.rig.parts.tail.rotation.y = Math.sin(p.t * (moved > 1 ? 10 : 16)) * 0.6;
    if (p.rig.parts.head) p.rig.parts.head.rotation.x = Math.sin(p.stride) * 0.06;
    p.model.position.y = Math.abs(Math.sin(p.stride)) * 0.05 * Math.min(1, moved / 4);
  } else if (p.kind === 'dove') {
    p.orbit += dt * 1.9;
    const tx = P.x + Math.cos(p.orbit) * 2.1, tz = P.z + Math.sin(p.orbit) * 2.1;
    p.x = lerp(p.x, tx, Math.min(1, dt * 8)); p.z = lerp(p.z, tz, Math.min(1, dt * 8)); p.yaw = Math.atan2(-Math.sin(p.orbit), Math.cos(p.orbit));
    p.alt = 1.7 + Math.sin(p.t * 2.2) * 0.2;
    if (playing) {
      for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; const dx = b.x - p.x, dz = b.z - p.z; if (dx * dx + dz * dz < 0.42 + b.r * b.r) { spawnPart(b.x, BULLET_Y, b.z, 0, 2, 0, 0.35, 0.14, C.white, 0); addGrace(0.3); removeEB(i); } }
      p.healT -= dt;
      if (p.healT <= 0) { p.healT = 6 / (1 + 0.05 * (p.lvl - 1)); healHero(S.maxHp * (0.025 + 0.004 * p.lvl) * Math.sqrt(S.petPow)); burst(P.x, P.z, 10, C.green, 3, 0.14, 1.4); sfx('dove'); }
    }
    animWings(p.rig, p.t, 1);
  } else if (p.kind === 'eagle') {
    if (p.mode === 'dive' && p.target && !p.target.dead) {
      const t = p.target, left = moveToward(p, t.x, t.z, 24, dt); p.alt = Math.max(1.1, p.alt - dt * 12);
      if (left < t.r + 0.5) {
        const dmg = (10 + S.baseDps * 1.4) * petPow(); playerHit(t, dmg); petStruck();
        for (const e of enemiesWithin(t.x, t.z, 2)) if (e !== t) playerHit(e, dmg * 0.5);
        shockwave(t.x, t.z, 0xd8a24a, 2.4); burst(t.x, t.z, 16, C.gold, 6, 0.18, 1); sfx('dive');
        p.mode = 'rise'; p.cd = 3.2 / (1 + 0.06 * (p.lvl - 1));
      }
    } else {
      if (p.mode === 'dive') p.mode = 'rise';
      p.orbit += dt * 1.2;
      moveToward(p, P.x + Math.cos(p.orbit) * 2.4, P.z + Math.sin(p.orbit) * 2.4, 12, dt);
      p.alt = lerp(p.alt, 4.2 + Math.sin(p.t) * 0.3, Math.min(1, dt * 2.5));
      if (p.alt > 3.6) p.mode = 'circle';
      if (playing && p.mode === 'circle' && p.cd <= 0) { const t = strongestNear(P.x, P.z, 14); if (t) { p.target = t; p.mode = 'dive'; sfx('cry'); } }
    }
    animWings(p.rig, p.t, p.mode === 'dive' ? 0.25 : 1, p.mode === 'dive' ? 0.6 : 1);
    if (p.rig.parts.body) p.rig.parts.body.rotation.x = p.mode === 'dive' ? 0.7 : 0;
  } else if (p.kind === 'cherub') {
    const tx = P.x - P.aimZ * 1.1 - P.aimX * 0.5, tz = P.z + P.aimX * 1.1 - P.aimZ * 0.5;
    p.x = lerp(p.x, tx, Math.min(1, dt * 6)); p.z = lerp(p.z, tz, Math.min(1, dt * 6));
    p.alt = 2.0 + Math.sin(p.t * 2.6) * 0.15;
    const t = playing ? nearestEnemy(p.x, p.z, 16) : null;
    p.yaw = t ? Math.atan2(t.x - p.x, t.z - p.z) : Math.atan2(P.aimX, P.aimZ);
    if (t && p.cd <= 0) {
      p.cd = 0.5 / (1 + 0.04 * (p.lvl - 1)); const a = Math.atan2(t.z - p.z, t.x - p.x);
      spawnPB(p.x, p.z, a, 24, (2 + S.baseDps * 0.09) * petPow(), { home: 3, life: 1.2, L: 0.55, w: 0.07, col: C.feather, pet: true }); sfx('arrow');
    }
    animWings(p.rig, p.t, 1);
  }
  p.mesh.position.set(p.x, 0, p.z); p.model.position.y = p.kind === 'hound' ? p.model.position.y : p.alt;
  p.mesh.rotation.y = p.yaw;
}
