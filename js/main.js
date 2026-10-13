'use strict';
/* Brimstone Halo · frame loop: simulation step, visual sync, camera, boot */

function update(dt) {
  stats.time += dt;
  updatePlayer(dt);
  for (const e of enemies) if (!e.dead) updateEnemy(e, dt);
  for (let i = 0; i < enemies.length; i++) { const a = enemies[i]; if (a.type === 'boss') continue; for (let j = i + 1; j < enemies.length; j++) { const b = enemies[j]; if (b.type === 'boss') continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r; if (d < m && d > 0.001) { const p = (m - d) * 0.5; a.x -= dx / d * p; a.z -= dz / d * p; b.x += dx / d * p; b.z += dz / d * p; } } }
  updateEnemyBullets(dt);
  updatePlayerBullets(dt);
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) removeEnemy(i);
  updateGems(dt); updateLoot(dt); updatePet(dt); updateWaves(dt);
  if (tipT > 0) { tipT -= dt; if (tipT <= 0) hideTip(); }
}
let demoT = 0;
function updateDemo(dt) {
  demoT -= dt;
  if (demoT <= 0) { demoT = 0.05; for (const e of enemies) { e.a += 0.25; spawnEB(e.x, e.z, e.a, 4, ['imp', 'caster', 'spinner', 'brute'].indexOf(e.type) % 3, 0.3); } }
  for (const e of enemies) { e.t += dt; e.mesh.rotation.y += dt * 0.5; animEnemy(e, dt, 0.4, 0); }
  const lim2 = (ARENA_R + 4) ** 2;
  for (let i = eb.length - 1; i >= 0; i--) { const b = eb[i]; b.age += dt; b.x += b.vx * dt; b.z += b.vz * dt; if (b.x * b.x + b.z * b.z > lim2 || pillars.some(p => (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < p.r * p.r)) removeEB(i); }
}

/* ======================= VISUAL SYNC ======================= */
function syncInstances() {
  const h = ebHalo.instanceMatrix.array, c = ebCore.instanceMatrix.array, col = ebHalo.instanceColor.array, pulse = 1 + Math.sin(time * 16) * 0.07;
  const still = GLOBAL.stillT > 0;
  for (let i = 0; i < eb.length; i++) { const b = eb[i], fade = Math.min(1, b.age * 8); setTS(h, i, b.x, BULLET_Y, b.z, b.r * 2.4 * pulse * fade); setTS(c, i, b.x, BULLET_Y, b.z, b.r * 0.5 * fade); setCol(col, i, still ? C.eye : BCOL[b.c], still ? 1.6 : 2.6); }
  ebHalo.count = ebCore.count = eb.length;
  ebHalo.instanceMatrix.needsUpdate = ebCore.instanceMatrix.needsUpdate = ebHalo.instanceColor.needsUpdate = true;
  const pm = pbMesh.instanceMatrix.array, pc = pbMesh.instanceColor.array, asc = P.ascT > 0;
  for (let i = 0; i < pb.length; i++) {
    const b = pb[i], o = i * 16, l = Math.hypot(b.vx, b.vz) || 1, dx = b.vx / l, dz = b.vz / l, L = b.L, w = b.w;
    pm[o] = dx * L; pm[o + 1] = 0; pm[o + 2] = dz * L; pm[o + 3] = 0; pm[o + 4] = 0; pm[o + 5] = Math.min(w, 0.2); pm[o + 6] = 0; pm[o + 7] = 0;
    pm[o + 8] = -dz * w; pm[o + 9] = 0; pm[o + 10] = dx * w; pm[o + 11] = 0; pm[o + 12] = b.x; pm[o + 13] = BULLET_Y + 0.1; pm[o + 14] = b.z; pm[o + 15] = 1;
    setCol(pc, i, asc && b.col === C.gold ? C.white : b.col, 3.2);
  }
  pbMesh.count = pb.length; pbMesh.instanceMatrix.needsUpdate = pbMesh.instanceColor.needsUpdate = true;
  const gm = gemMesh.instanceMatrix.array, gc = gemMesh.instanceColor.array;
  for (let i = 0; i < gems.length; i++) { const g = gems[i], s = g.kind === 1 ? 0.3 : 0.13 + Math.min(0.12, g.val * 0.012); setTS(gm, i, g.x, 0.45 + Math.sin(g.t * 4) * 0.12, g.z, s); setCol(gc, i, g.kind === 1 ? C.heal : C.soul, 2.4); }
  gemMesh.count = gems.length; gemMesh.instanceMatrix.needsUpdate = gemMesh.instanceColor.needsUpdate = true;
  const qm = partMesh.instanceMatrix.array, qc = partMesh.instanceColor.array;
  for (let i = 0; i < parts.length; i++) { const p = parts[i], k = p.life / p.max; setTS(qm, i, p.x, p.y, p.z, p.size * (0.6 + k) * 1.3); setCol(qc, i, p.col, (0.3 + k) * 2.6); }
  partMesh.count = parts.length; partMesh.instanceMatrix.needsUpdate = partMesh.instanceColor.needsUpdate = true;
}
function updateHealthBars() {
  let n = 0;
  for (const e of enemies) {
    if (n >= MAX_HB || e.dead || e.spawnT > 0 || e.type === 'boss' || e.hp >= e.maxHp) continue;
    const f = clamp(e.hp / e.maxHp, 0, 1), w = 0.6 + e.r * 0.9, y = e.T.hb;
    _m4.compose(_v.set(e.x, y, e.z), BB_Q, _sc.set(w + 0.08, 0.17, 1)); hbMesh.setMatrixAt(n * 2, _m4); hbMesh.setColorAt(n * 2, HB_BG);
    _v.set(e.x, y, e.z).addScaledVector(_rgt, -(1 - f) * w / 2);
    _m4.compose(_v, BB_Q, _sc.set(Math.max(0.001, w * f), 0.1, 1)); hbMesh.setMatrixAt(n * 2 + 1, _m4); hbMesh.setColorAt(n * 2 + 1, e.stun > 0 ? HB_STUN : HB_FG);
    n++;
  }
  hbMesh.count = n * 2; hbMesh.instanceMatrix.needsUpdate = true; if (hbMesh.instanceColor) hbMesh.instanceColor.needsUpdate = true;
}
let ascLerp = 0;
const camTarget = new THREE.Vector3();
const hurtEl = $('hurt'), ascGlowEl = $('ascGlow'), invPanel = document.querySelector('#invScr .inv');
let snapNext = false;
function camSnap() { snapNext = true; }
function animHero(dt) {
  const H = heroModel(P.cls), rig = H.rig, asc = P.ascT > 0, fx = P.fx, play = state !== 'title';
  H.root.visible = play && !(P.inv > 0 && Math.floor(time * 20) % 2 && state === 'play');
  P.walkPh += P.moveAmt * dt * 9;
  animWings(rig, time, asc ? 1.7 : 1 + P.moveAmt * 0.4, asc ? 2.4 : 1 + P.moveAmt * 0.6);
  animLegs(rig, P.walkPh, 0.5 * P.moveAmt);
  animSpin(rig, dt, fx.wheelT > 0 ? 3 : 1);
  const pr = rig.parts;
  if (pr.cape) pr.cape.rotation.x = 0.12 + P.moveAmt * 0.38 + Math.sin(time * 2.1) * 0.04;
  if (pr.head) pr.head.rotation.x = Math.sin(time * 1.7) * 0.04;
  if (P.cls === 'archangel') {
    if (fx.whirlT > 0) { pr.armR.rotation.set(-1.45, 0, 0); pr.armL.rotation.set(-0.6, 0, 0); }
    else if (P.swingT > 0) { const k = 1 - P.swingT / 0.14, half = S.arc * DEG / 2; pr.armR.rotation.x = -1.4; pr.armR.rotation.y = P.swingSide * (half - 2 * half * k); }
    else { pr.armR.rotation.x += (-0.45 + Math.sin(time * 2) * 0.05 - pr.armR.rotation.x) * Math.min(1, dt * 10); pr.armR.rotation.y += (0 - pr.armR.rotation.y) * Math.min(1, dt * 10); pr.armL.rotation.x += (-0.25 - pr.armL.rotation.x) * Math.min(1, dt * 8); }
  } else if (P.cls === 'seraph') {
    const firing = state === 'play' && P.fireT > -0.1;
    pr.armR.rotation.x += ((firing ? -0.5 : -0.1) + Math.sin(time * 1.5) * 0.05 - pr.armR.rotation.x) * Math.min(1, dt * 8);
    pr.armL.rotation.x += ((firing ? -0.9 : -0.2) - pr.armL.rotation.x) * Math.min(1, dt * 8);
  }
  const bob = P.cls === 'ophan' ? 0.12 + Math.sin(time * 2.2) * 0.1 : Math.sin(time * 3) * 0.03;
  pGroup.position.set(P.x, P.y + bob + (P.dashT > 0 ? 0.2 : 0), P.z);
  if (fx.whirlT > 0) pGroup.rotation.y += dt * 22;
  else if (state === 'hub') pGroup.rotation.y = FACE_CAM + Math.sin(time * 0.5) * 0.35;
  else pGroup.rotation.y = Math.atan2(P.aimX, P.aimZ);
}
function updateVisuals(dt) {
  for (let i = 0; i < EMB; i++) { embPos[i * 3 + 1] += embSpd[i] * dt; embPos[i * 3] += Math.sin(time + i) * dt * 0.3; if (embPos[i * 3 + 1] > 10) seedEmber(i, false); }
  embGeo.attributes.position.needsUpdate = true;
  floorMat.emissiveIntensity = 0.75 + Math.sin(time * 1.3) * 0.15 + (P.ascT > 0 ? 0.5 : 0);
  for (const b of braziers) { const f = 1 + Math.sin(time * 11 + b.ph) * 0.12 + Math.sin(time * 23 + b.ph * 2) * 0.08; b.fl.scale.set(1, f, 1); b.L.intensity = 3 * f; }
  const asc = P.ascT > 0, playing = state === 'play' || state === 'paused' || state === 'levelup' || state === 'inventory', fx = P.fx;
  animHero(dt);
  // markers that only make sense in a descent
  heart.visible = focusRing.visible = aimArrow.visible = pShadow.visible = playing || state === 'dead';
  pShadow.visible = state !== 'title';
  heart.position.set(P.x, BULLET_Y + P.y, P.z); heart.scale.setScalar(0.2 * (1.2 + Math.sin(time * 9) * 0.15));
  const focus = down('ShiftLeft', 'ShiftRight');
  focusRing.position.set(P.x, BULLET_Y, P.z); focusRing.scale.setScalar(S.grazeR);
  focusRing.material.opacity += ((focus ? 0.7 : 0.12) - focusRing.material.opacity) * Math.min(1, dt * 10);
  aimArrow.position.set(P.x + P.aimX * 1.3, 0.08, P.z + P.aimZ * 1.3); aimArrow.rotation.y = Math.atan2(-P.aimZ, P.aimX);
  pShadow.position.set(P.x, 0.03, P.z); pShadow.scale.setScalar(1.9 / (1 + P.y * 0.3));
  reticle.visible = !input.touch && state === 'play';
  if (P.cls === 'archangel') { sector.position.set(P.x, BULLET_Y, P.z); sector.rotation.y = -P.swingA; sectorMat.opacity = Math.max(0, P.swingT / 0.14) * 0.55; } else sectorMat.opacity = 0;
  whirlDisc.visible = fx.whirlT > 0; if (fx.whirlT > 0) { whirlDisc.position.set(P.x, BULLET_Y, P.z); whirlDisc.scale.setScalar((S.reach + 0.6) * S.skillArea); whirlDisc.rotation.y += dt * 14; whirlDisc.material.opacity = 0.25 + Math.sin(time * 30) * 0.08; }
  aegisShell.visible = fx.aegisT > 0; if (fx.aegisT > 0) { aegisShell.position.set(P.x, 0.9, P.z); aegisShell.scale.setScalar(2.8 * S.skillArea); aegisShell.material.opacity = 0.07 + Math.sin(time * 14) * 0.03 + (fx.aegisT < 0.5 ? -0.04 : 0); }
  wardShell.visible = fx.wardT > 0; if (fx.wardT > 0) { wardShell.position.set(P.x, 1.1 + P.y, P.z); wardShell.scale.setScalar(1.35); wardShell.material.opacity = 0.08 + Math.sin(time * 8) * 0.03; }
  const big = fx.wheelT > 0;
  for (let i = 0; i < orbMeshes.length; i++) { const m = orbMeshes[i]; m.visible = playing && i < S.orbs; if (!m.visible) continue; const a = P.orbA + i * TAU / S.orbs;
    m.position.set(P.x + Math.cos(a) * P.orbR, 0.9 + Math.sin(time * 4 + i) * 0.15, P.z + Math.sin(a) * P.orbR); m.rotation.set(0, -a, 0); m.children[0].rotation.z += dt * (big ? 14 : 6); m.scale.setScalar(big ? 1.5 : 1); }
  if (fx.novaT >= 0) { const k = fx.novaT / 0.5; novaRing.position.set(P.x, 0.3, P.z); novaRing.scale.setScalar(Math.max(0.01, fx.novaR * Math.sqrt(k))); novaRing.material.opacity = 1 - k; novaRing.material.color.set(NOVA_COLS[fx.novaCol]).multiplyScalar(2); } else novaRing.material.opacity = 0;
  ascBeam.position.set(P.x, 11, P.z); ascBeam.material.opacity += ((asc ? 0.22 : 0) - ascBeam.material.opacity) * Math.min(1, dt * 5);
  ascLerp += ((asc ? 1 : 0) - ascLerp) * Math.min(1, dt * 3);
  hemi.color.lerpColors(HEMI_SKY, HEMI_GOLD, ascLerp); torch.color.lerpColors(TORCH_C, TORCH_GOLD, ascLerp); torch.distance = 17 + ascLerp * 10;
  torch.position.set(P.x, 3.2, P.z);
  heroLight.position.set(P.x + 1.6, 3.4 + P.y, P.z + 2.4); heroLight.intensity = state === 'hub' ? 3.2 : state === 'title' ? 0 : 1.4; heroLight.distance = state === 'hub' ? 10 : 7;
  for (const l of loot) { l.box.rotation.y += dt * 1.5; l.box.position.y = 0.55 + Math.sin(l.t * 3) * 0.1; }
  // camera: follow in a descent, frame the hero on the left in the sanctuary, drift on the title
  if (state === 'hub') {   // frame the hero in the space the sanctuary panel leaves free on the left
    const free = innerWidth - invPanel.getBoundingClientRect().width - 40;
    VIEW.want = 4.6; VIEW.wantLift = 1.2; VIEW.wantShift = free > 240 ? 1 - free / innerWidth : 0;
  }
  else if (state === 'title') { VIEW.want = 10.5; VIEW.wantLift = 0; VIEW.wantShift = 0; }
  else { VIEW.want = SAVE.settings.zoom; VIEW.wantLift = 0; VIEW.wantShift = 0; }
  const k = snapNext ? 1 : Math.min(1, dt * 4), follow = snapNext ? 1 : Math.min(1, dt * 8);
  if (Math.abs(VIEW.want - VIEW.half) > 0.002) { VIEW.half += (VIEW.want - VIEW.half) * k; applyView(); }
  VIEW.lift += (VIEW.wantLift - VIEW.lift) * k; VIEW.shift += (VIEW.wantShift - VIEW.shift) * k;
  if (state === 'title') { camTarget.x += (Math.cos(time * 0.1) * 5 - camTarget.x) * dt; camTarget.z += (Math.sin(time * 0.1) * 5 - camTarget.z) * dt; }
  else {
    const halfW = VIEW.half * innerWidth / innerHeight, sx = P.x + SCR_R.x * halfW * VIEW.shift, sz = P.z + SCR_R.z * halfW * VIEW.shift;
    camTarget.x += (sx - camTarget.x) * follow; camTarget.z += (sz - camTarget.z) * follow;
  }
  snapNext = false;
  shakeAmt = Math.max(0, shakeAmt - dt * 4);
  const sx = (Math.random() - 0.5) * shakeAmt * 0.5, sz = (Math.random() - 0.5) * shakeAmt * 0.5;
  cam.position.set(camTarget.x + camOff.x + sx, camOff.y + VIEW.lift, camTarget.z + camOff.z + sz); cam.lookAt(camTarget.x + sx, VIEW.lift, camTarget.z + sz);
  cam.updateMatrixWorld();
  // screen-space labels after the camera moves
  const showLabels = playing;
  labelsEl.hidden = !showLabels;
  if (showLabels) for (const l of loot) { const [x, y] = toScreen(l.x, 1.35, l.z); l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`; }
  hurtFlash = Math.max(0, hurtFlash - dt * 2.5);
  if (gradePass) {
    const u = gradePass.uniforms; u.uTime.value = time; u.uHurt.value = hurtFlash; u.uAsc.value = ascLerp;
    u.uStill.value += ((GLOBAL.stillT > 0 ? 1 : 0) - u.uStill.value) * Math.min(1, dt * 6);
    u.uCA.value = 0.0012 + hurtFlash * 0.005 + (P.dashT > 0 ? 0.004 : 0) + shakeAmt * 0.0015;
  } else { hurtEl.style.opacity = hurtFlash.toFixed(3); ascGlowEl.style.opacity = (ascLerp * 0.9).toFixed(3); }
  sun.position.copy(camTarget).add(SUN_OFF); sun.target.position.copy(camTarget);
  sun.intensity = 0.42 + ascLerp * 1.4; sun.color.lerpColors(SUN_COOL, SUN_GOLD, ascLerp);
  for (const s of shafts) { s.m.material.uniforms.uT.value = time; s.m.material.uniforms.uI.value = s.k * (0.75 + 0.25 * Math.sin(time * 0.4 + s.ph)) * (1 + ascLerp * 2.5); }
  for (const m of mists) m.uniforms.uT.value = time;
  for (let i = 0; i < MOTES; i++) { motePos[i * 3 + 1] += moteV[i] * dt; motePos[i * 3] += Math.sin(time * 0.5 + i) * dt * 0.2; if (motePos[i * 3 + 1] > 9) motePos[i * 3 + 1] = 0.2; }
  moteGeo.attributes.position.needsUpdate = true;
  updateImpacts(dt); updateHealthBars(); updateDmgNums(dt, playing);
}

/* ======================= LOOP ======================= */
let prev = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - prev) / 1000, 1 / 30); prev = now;
  if (hitStop > 0) { hitStop -= dt; dt *= 0.06; }
  time += dt;
  if (state === 'play') update(dt);
  else if (state === 'title') updateDemo(dt);
  else if (state === 'hub') updatePet(dt);
  if (state === 'play' || state === 'dead' || state === 'title' || state === 'hub') updateParts(dt);
  updateVisuals(dt); syncInstances(); updateHud();
  if (composer) composer.render(); else renderer.render(scene, cam);
}

/* ======================= BOOT ======================= */
(function boot() {
  const local = readLocal();
  SAVE = (local && sanitizeSave(local)) || sanitizeSave(newSave());
  VIEW.want = VIEW.half = SAVE.settings.zoom; muted = SAVE.settings.muted;
  if (gradePass) document.body.classList.add('graded');
  // enemy fire draws over everything, so wings and bodies never hide a bullet
  ebHalo.material.depthTest = false; ebCore.material.depthTest = false; ebHalo.renderOrder = 7; ebCore.renderOrder = 8;
  resize(); enterTitle(); requestAnimationFrame(frame);
  initCloud(() => state === 'title', s => { adoptSave(s); writeLocal(JSON.stringify(SAVE)); });
})();
