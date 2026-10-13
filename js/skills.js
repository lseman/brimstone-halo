'use strict';
/* Brimstone Halo · choir skills. Each choir knows four, carries two (Q and R).
   Damage scales with the hero's base damage per second, so gear and relics carry over to skills. */

const strikes = [];   // Flame Strikes waiting to fall
const NOVA_COLS = [0xffe39a, 0xfff6d0];
function enemiesWithin(x, z, R) { return enemies.filter(e => !e.dead && e.spawnT <= 0 && Math.hypot(e.x - x, e.z - z) < R + e.r); }
function clearBullets(x, z, R, col, gemChance) {
  let n = 0;
  for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; if (Math.hypot(b.x - x, b.z - z) < R) { spawnPart(b.x, BULLET_Y, b.z, 0, 3, 0, 0.5, 0.16, col || C.gold, 0); if (gemChance && Math.random() < gemChance) dropGem(b.x, b.z, 1, 0); removeEB(i); n++; } }
  return n;
}
function knock(e, fromX, fromZ, k) { if (e.type === 'boss') return; const d = Math.hypot(e.x - fromX, e.z - fromZ) || 1; e.x += (e.x - fromX) / d * k; e.z += (e.z - fromZ) / d * k; }
function aimPoint(maxD) {
  let dx = P.aimPt.x - P.x, dz = P.aimPt.z - P.z; const d = Math.hypot(dx, dz);
  if (d > maxD) { dx *= maxD / d; dz *= maxD / d; }
  const o = { x: P.x + dx, z: P.z + dz }; confine(o, 0.6); return o;
}

function useSkill(slot, free) {
  if (state !== 'play' || !P.slots[slot] || P.fx.leap) return;
  const s = P.slots[slot];
  if (!free && s.cd > 0) return;
  if (!free) s.cd = skillCdOf(s.id);
  const pow = S.skillPow, area = S.skillArea, base = S.baseDps, fx = P.fx;
  switch (s.id) {
    case 'trisagion': {
      const R = 6.5 * area; fx.novaT = 0; fx.novaR = R; fx.novaCol = 0; sfx('nova'); shake(0.6);
      clearBullets(P.x, P.z, R, C.gold, 0.2);
      for (const e of enemiesWithin(P.x, P.z, R)) { playerHit(e, (20 + base * 1.1) * pow); knock(e, P.x, P.z, 2.5); }
      break; }
    case 'flamestrike': {
      const p = aimPoint(14), f = strikeFx.find(x => !x.busy); if (!f) break;
      f.busy = true; strikes.push({ x: p.x, z: p.z, R: 3.4 * area, t: 0, dmg: (30 + base * 1.8) * pow, fx: f, boom: false });
      sfx('strike'); break; }
    case 'gale': {
      for (let i = 0; i < 30; i++) { const a = i * TAU / 30 + rand(-0.05, 0.05); spawnPB(P.x + Math.cos(a) * 0.6, P.z + Math.sin(a) * 0.6, a, 19, (4 + base * 0.12) * pow, { home: 3, pierce: 1, life: 1.7, L: 0.45, w: 0.15, col: C.feather }); }
      burst(P.x, P.z, 30, C.feather, 7, 0.16, 1.4); sfx('gale'); break; }
    case 'word': {
      const R = 10 * area; fx.novaT = 0; fx.novaR = R; fx.novaCol = 1; shake(1.2); sfx('word');
      shockwave(P.x, P.z, 0xffe39a, R); clearBullets(P.x, P.z, R * 0.55, C.gold, 0.1);
      for (const e of enemiesWithin(P.x, P.z, R)) { playerHit(e, (25 + base * 1.2) * pow); e.stun = Math.max(e.stun, e.type === 'boss' ? 0.8 : 2.5); }
      break; }
    case 'aegis': {
      fx.aegisT = free ? 1 : 2.2; sfx('aegis'); shake(0.4);
      for (const e of enemiesWithin(P.x, P.z, 2.8 * area)) knock(e, P.x, P.z, 2);
      break; }
    case 'whirl': fx.whirlT = free ? 1 : 2; fx.whirlTick = 0; sfx('whirl'); break;
    case 'leap': {
      const p = aimPoint(10);
      fx.leap = { t: 0, dur: 0.55, x0: P.x, z0: P.z, x1: p.x, z1: p.z }; P.dashT = 0; sfx('leap');
      const dx = p.x - P.x, dz = p.z - P.z, l = Math.hypot(dx, dz); if (l > 0.1) { P.aimX = dx / l; P.aimZ = dz / l; }
      break; }
    case 'heal': {
      healHero(S.maxHp * 0.4); fx.wardT = 4; burst(P.x, P.z, 34, C.green, 5, 0.18, 1.2); sfx('heal2'); break; }
    case 'wheel': fx.wheelT = free ? 1.2 : 3; sfx('wheel'); break;
    case 'stillness': GLOBAL.stillT = free ? 2 : 4; shockwave(P.x, P.z, 0xb8e8ff, 16); sfx('still'); break;
    case 'stream': fx.streamT = free ? 0.8 : 1.6; fx.streamTick = 0; sfx('stream'); break;
    case 'eyes': {
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24; spawnPB(P.x + Math.cos(a) * 0.9, P.z + Math.sin(a) * 0.9, a, 15, (4 + base * 0.14) * pow, { home: 3.5, pierce: 0, life: 2, L: 0.3, w: 0.26, col: C.eye }); }
      shockwave(P.x, P.z, 0x9fe8ff, 4); sfx('eyes'); break; }
  }
}

function updateSkillFx(dt) {
  const fx = P.fx, pow = S.skillPow, area = S.skillArea;
  if (fx.novaT >= 0) { fx.novaT += dt; if (fx.novaT > 0.5) fx.novaT = -1; }
  if (fx.aegisT > 0) {
    fx.aegisT -= dt; const R = 2.8 * area;
    for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; const dx = b.x - P.x, dz = b.z - P.z; if (dx * dx + dz * dz < R * R) {
      const t = nearestEnemy(b.x, b.z, 20); const a = t ? Math.atan2(t.z - b.z, t.x - b.x) : Math.atan2(-b.vz, -b.vx);
      spawnPB(b.x, b.z, a, 22, S.dmg * 0.5 * pow, { pierce: 1, life: 1, home: 2, col: C.flame }); removeEB(i); } }
  }
  if (fx.whirlT > 0) {
    fx.whirlT -= dt; fx.whirlTick -= dt; const R = (S.reach + 0.6) * area;
    for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; if (Math.hypot(b.x - P.x, b.z - P.z) < R) { spawnPart(b.x, BULLET_Y, b.z, rand(-3, 3), rand(2, 5), rand(-3, 3), 0.3, 0.14, C.flame, -8); addGrace(0.5); removeEB(i); } }
    if (fx.whirlTick <= 0) { fx.whirlTick = 0.12; sfx('swing'); for (const e of enemiesWithin(P.x, P.z, R)) { playerHit(e, S.dmg * 0.55 * pow); knock(e, P.x, P.z, 0.25); } }
  }
  if (fx.leap) {
    const L = fx.leap; L.t += dt; const k = Math.min(1, L.t / L.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    P.x = lerp(L.x0, L.x1, e); P.z = lerp(L.z0, L.z1, e); P.y = Math.sin(k * Math.PI) * 3.2;
    if (Math.random() < 0.6) spawnPart(P.x, P.y + 1, P.z, 0, 0, 0, 0.4, 0.25, C.gold, 0);
    if (k >= 1) {
      fx.leap = null; P.y = 0; const R = 4.5 * area;
      shockwave(P.x, P.z, 0xffb060, R); scorch(P.x, P.z, 3.2); shake(1.4); hitStop = Math.max(hitStop, 0.08); sfx('land');
      burst(P.x, P.z, 40, C.flame, 9, 0.22, 0.4); clearBullets(P.x, P.z, R, C.flame, 0.15);
      for (const en of enemiesWithin(P.x, P.z, R)) { playerHit(en, (30 + S.baseDps * 2.2) * pow); knock(en, P.x, P.z, 2.5); }
      P.inv = Math.max(P.inv, 0.35);
    }
  }
  if (fx.wardT > 0) fx.wardT -= dt;
  if (fx.wheelT > 0) fx.wheelT -= dt;
  if (fx.streamT > 0) {
    fx.streamT -= dt; fx.streamTick -= dt;
    if (fx.streamTick <= 0) {
      fx.streamTick = 0.05; const a0 = Math.atan2(P.aimZ, P.aimX);
      for (let i = 0; i < 2; i++) { const a = a0 + rand(-0.22, 0.22); spawnPB(P.x + Math.cos(a) * 0.8, P.z + Math.sin(a) * 0.8, a, rand(13, 17), (2 + S.baseDps * 0.07) * pow, { pierce: 99, life: 0.7, L: 0.5, w: 0.38, col: C.flame, erase: true }); }
    }
  }
  if (GLOBAL.stillT > 0) GLOBAL.stillT -= dt;
  for (let i = strikes.length - 1; i >= 0; i--) {
    const s = strikes[i], f = s.fx; s.t += dt;
    if (!s.boom) {
      f.tele.visible = true; f.tele.position.set(s.x, 0.1, s.z); f.tele.scale.setScalar(s.R * (0.7 + 0.3 * Math.min(1, s.t / 0.45))); f.tele.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(s.t * 20));
      if (s.t >= 0.45) {
        s.boom = true; s.t = 0; f.tele.visible = false;
        shockwave(s.x, s.z, 0xff8a30, s.R * 1.3); scorch(s.x, s.z, s.R * 1.2); shake(0.8); sfx('boom2');
        burst(s.x, s.z, 36, C.flame, 8, 0.24, 0.5); clearBullets(s.x, s.z, s.R, C.flame, 0.1);
        for (const e of enemiesWithin(s.x, s.z, s.R)) playerHit(e, s.dmg);
      }
    } else {
      const k = s.t / 0.55; f.col.visible = k < 1;
      f.col.position.set(s.x, 6, s.z); f.col.scale.set(s.R * (0.55 + 0.45 * k), 12, s.R * (0.55 + 0.45 * k)); f.col.material.opacity = (1 - k) * 0.9;
      if (k >= 1) { f.busy = false; f.col.visible = false; strikes.splice(i, 1); }
    }
  }
}
