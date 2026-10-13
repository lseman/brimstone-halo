'use strict';
/* Brimstone Halo · interface: HUD, relic choices, the reliquary and sanctuary, title, run summary, save code, input */

/* ======================= HUD ======================= */
const hud = { root: $('hud'), hpFill: $('hpFill'), hpTxt: $('hpTxt'), graceFill: $('graceFill'), graceTxt: $('graceTxt'), graceGlobe: $('graceGlobe'), xpFill: $('xpFill'), xpTxt: $('xpTxt'),
  waveN: $('waveN'), waveSub: $('waveSub'), score: $('score'), lvl: $('lvlTxt'), bossBar: $('bossBar'), bossFill: $('bossFill'), bossName: $('bossName'), bossPhase: $('bossPhase'),
  dash: $('skDash'), q: $('skQ'), r: $('skR'), asc: $('skAsc'), bag: $('skBag') };
const lastTxt = {};
function setText(el, key, v) { if (lastTxt[key] !== v) { lastTxt[key] = v; el.textContent = v; } }
function showHud(on) { hud.root.hidden = !on; }
function refreshSkillIcons() {
  P.slots.forEach((s, i) => { const d = skillDef(P.cls, s.id); $(i ? 'skRIcon' : 'skQIcon').innerHTML = ICON[s.id]; (i ? hud.r : hud.q).setAttribute('aria-label', d.name); });
}
function updateHud() {
  if (hud.root.hidden) return;
  hud.hpFill.style.height = (P.hp / S.maxHp * 100).toFixed(1) + '%';
  setText(hud.hpTxt, 'hp', Math.ceil(P.hp) + '');
  hud.graceFill.style.height = (P.ascT > 0 ? P.ascT / S.ascDur * 100 : P.grace).toFixed(1) + '%';
  setText(hud.graceTxt, 'gr', P.ascT > 0 ? P.ascT.toFixed(1) + 's' : Math.floor(P.grace) + '');
  const ready = P.grace >= 100 && P.ascT <= 0;
  hud.graceGlobe.classList.toggle('ready', ready); hud.asc.classList.toggle('ready', ready);
  hud.xpFill.style.width = (P.xp / P.xpNext * 100).toFixed(1) + '%';
  setText(hud.xpTxt, 'xp', `${P.xp} / ${P.xpNext}`);
  setText(hud.waveN, 'wn', roman(Math.max(1, W.n)));
  setText(hud.waveSub, 'ws', W.active ? `${W.queue.length + enemies.length} remain` : 'between circles');
  setText(hud.score, 'sc', fmt(stats.score));
  setText(hud.lvl, 'lv', `${CLASSES[P.cls].name} · level ${P.level} · rank ${rankOf(P.h.xp).rank}`);
  hud.dash.style.setProperty('--p', P.charges > 0 ? 0 : (P.dashCd / S.dashCdE).toFixed(3));
  hud.q.style.setProperty('--p', (P.slots[0].cd / skillCdOf(P.slots[0].id)).toFixed(3));
  hud.r.style.setProperty('--p', (P.slots[1].cd / skillCdOf(P.slots[1].id)).toFixed(3));
  hud.asc.style.setProperty('--p', P.ascT > 0 ? 0 : (1 - P.grace / 100).toFixed(3));
  hud.bag.classList.toggle('new', P.bagNew);
  const boss = W.boss && !W.boss.dead ? W.boss : null;
  if (!!boss !== !hud.bossBar.hidden) hud.bossBar.hidden = !boss;
  if (boss) {
    hud.bossFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100).toFixed(1) + '%';
    const [nm, ep] = bossName(); setText(hud.bossName, 'bn', `${nm}, ${ep}`);
    setText(hud.bossPhase, 'bp', `${roman(boss.phase)} · ${PHASES[boss.phase - 1]}`);
  }
}
const banEl = $('banner');
function showBanner(t, s) { $('banTitle').textContent = t; $('banSub').textContent = s || ''; banEl.classList.remove('show'); void banEl.offsetWidth; banEl.classList.add('show'); }
let tipT = 0;
function showTip(t) { const el = $('tip'); el.textContent = t; el.hidden = false; tipT = 4; }
function hideTip() { $('tip').hidden = true; tipT = 0; }
const toastsEl = $('toasts');
function toast(html, rarity) {
  const el = document.createElement('div'); el.className = 'toast r-' + (rarity || 'rare'); el.innerHTML = html;
  toastsEl.prepend(el); while (toastsEl.children.length > 4) toastsEl.lastChild.remove();
  setTimeout(() => el.remove(), 2900);
}

/* ======================= LEVEL-UP RELICS ======================= */
let offered = [];
function pickUpgrades() {
  const pool = UPG.filter(u => (!u.cls || u.cls === P.cls) && (P.ranks[u.id] || 0) < u.max), out = [];
  while (out.length < 3 && pool.length) {
    const tot = pool.reduce((s, u) => s + u.w, 0); let r = Math.random() * tot, idx = 0;
    for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
    out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return out;
}
function openLevelUp() {
  if (state !== 'play') return;
  state = 'levelup'; input.firing = false;
  offered = pickUpgrades();
  if (!offered.length) { P.pending = 0; state = 'play'; return; }
  $('levelH').textContent = `Level ${P.level - P.pending + 1}`;
  const wrap = $('cards'); wrap.innerHTML = '';
  offered.forEach((u, i) => {
    const r = P.ranks[u.id] || 0;
    const b = document.createElement('button'); b.className = 'card'; b.dataset.tier = u.tier; b.id = 'card-' + i;
    b.innerHTML = `<span class="tier">${TIER_LABEL[u.tier]}<kbd class="deskonly">${i + 1}</kbd></span><h3></h3><p></p><span class="src"></span><span class="rank">Rank ${roman(r + 1)} of ${roman(u.max)}</span>`;
    b.querySelector('h3').textContent = u.name; b.querySelector('p').textContent = u.desc; b.querySelector('.src').textContent = u.src;
    b.addEventListener('click', () => choose(i)); wrap.appendChild(b);
  });
  $('levelScr').hidden = false; sfx('level');
}
function choose(i) {
  const u = offered[i]; if (!u || state !== 'levelup') return;
  P.ranks[u.id] = (P.ranks[u.id] || 0) + 1; P.pending--; recalc();
  if (u.id === 'vigor') P.hp = S.maxHp;
  $('levelScr').hidden = true; state = 'play'; blurActive();
  burst(P.x, P.z, 30, C.gold, 6, 0.18, 1);
  if (P.pending > 0) openLevelUp();
}

/* ======================= RELIQUARY / SANCTUARY ======================= */
let sel = null, hover = null, invTab = 'gear', hubGate = 1;
const invScr = $('invScr'), dollEl = $('doll'), bagEl = $('bag'), stashEl = $('stash'), detailEl = $('detail');
const inHub = () => state === 'hub';
function openInv() {
  if (state !== 'play') return;
  state = 'inventory'; input.firing = false; keys.clear(); sel = null; hover = null;
  invScr.classList.remove('hub'); renderReliquary(); invScr.hidden = false; P.bagNew = false;
}
function closeInv() {
  if (state !== 'inventory') return;
  hideTooltip(); hover = null;
  for (const it of P.bag) it.isNew = false;
  invScr.hidden = true; state = 'play'; blurActive(); refreshSkillIcons();
  if (P.pending > 0) openLevelUp();
}
function renderReliquary() {
  const hub = inHub(), rk = rankOf(P.h.xp);
  $('invEyebrow').textContent = hub ? 'Sanctuary' : 'Reliquary';
  $('invTitle').textContent = CLASSES[P.cls].name;
  $('invRank').innerHTML = `Rank ${rk.rank} <span class="rankbar" title="${fmt(rk.into)} of ${fmt(rk.need)} to the next rank"><i style="width:${(rk.into / rk.need * 100).toFixed(1)}%"></i></span>`;
  $('invSouls').textContent = fmt(SAVE.souls);
  $('hubLaunch').hidden = !hub; $('invClose').hidden = hub; $('stashWrap').hidden = !hub;
  if (hub) renderGates();
  setTab(invTab);
}
function renderGates() {
  const gates = gatesFor(P.h); if (!gates.includes(hubGate)) hubGate = gates.includes(P.h.gate) ? P.h.gate : 1;
  const wrap = $('gates'); wrap.innerHTML = '<span class="lbl">Begin at circle</span>';
  for (const g of gates) {
    const b = document.createElement('button'); b.className = 'gate'; b.textContent = roman(g); b.setAttribute('aria-pressed', g === hubGate);
    b.title = g === 1 ? 'The first circle' : `Start deeper, with ${Math.floor((g - 1) / 5) * 3} relics granted at the gate`;
    b.addEventListener('click', () => { hubGate = g; renderGates(); }); wrap.appendChild(b);
  }
}
function setTab(t) {
  invTab = t;
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', b.dataset.tab === t);
  $('tabGear').hidden = t !== 'gear'; $('tabSkills').hidden = t !== 'skills'; $('tabPet').hidden = t !== 'pet';
  hideTooltip(); hover = null;
  if (t === 'gear') renderGear(); else if (t === 'skills') renderSkills(); else renderPets();
}
for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => setTab(b.dataset.tab));

/* ----- gear ----- */
function listOf(where) { return where === 'bag' ? P.bag : where === 'stash' ? SAVE.stash : null; }
function itemAt(ref) { if (!ref) return null; return ref.where === 'equip' ? P.equip[ref.slot] : (listOf(ref.where) || [])[ref.idx]; }
const iconSvg = (it, slot) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${SLOT_ICON[(it ? it.slot : slot) === 'weapon' ? (it ? it.cls : P.cls) : (it ? it.slot : slot)]}</svg>`;
function tile(it, slot) {
  const b = document.createElement('button');
  b.className = 'tile ' + (it ? 'filled r-' + it.rarity : 'empty') + (it && it.isNew ? ' new' : '') + (it && !canEquip(it) ? ' foreign' : '');
  b.innerHTML = it ? iconSvg(it) : (slot ? iconSvg(null, slot).replace('stroke="currentColor"', 'stroke="#3d322b"') : '');
  if (it) b.setAttribute('aria-label', `${TIER_LABEL[it.rarity]} ${it.name}`); else b.tabIndex = -1;
  return b;
}
const sameRef = (a, b) => a && b && a.where === b.where && a.idx === b.idx && a.slot === b.slot;
function renderGear() {
  dollEl.innerHTML = '';
  for (const slot of SLOTS) {
    const it = P.equip[slot], b = tile(it, it ? null : slot);
    b.style.gridArea = slot; b.dataset.where = 'equip'; b.dataset.slot = slot;
    b.insertAdjacentHTML('beforeend', `<span class="slbl" ${it ? 'style="color:var(--rc)"' : ''}>${SLOT_LABEL[slot]}</span>`);
    if (sameRef(sel, { where: 'equip', slot })) b.classList.add('sel');
    dollEl.appendChild(b);
  }
  const fill = (host, list, size, where) => {
    host.innerHTML = '';
    for (let i = 0; i < size; i++) { const b = tile(list[i]); b.dataset.where = where; b.dataset.idx = i; if (sameRef(sel, { where, idx: i })) b.classList.add('sel'); host.appendChild(b); }
  };
  fill(bagEl, P.bag, BAG_SIZE, 'bag'); $('bagCount').textContent = `${P.bag.length} / ${BAG_SIZE}`;
  if (inHub()) { fill(stashEl, SAVE.stash, STASH_SIZE, 'stash'); $('stashCount').textContent = `${SAVE.stash.length} / ${STASH_SIZE}`; }
  $('invSouls').textContent = fmt(SAVE.souls);
  renderDetail();
}
// ---- stat comparison (Diablo-style): simulate the swap and diff every derived stat ----
function estDps(s) {
  const critMul = 1 + Math.min(1, s.crit) * (s.critDmg - 1);
  let main = s.dmg * s.atkRate * critMul;
  if (P.cls === 'archangel') main *= 1.6 + s.arc / 240 + s.waves * 0.6;
  else main *= Math.max(1, s.shots) * (1 + s.pierce * 0.3);
  return main + s.orbs * s.dmg * s.orbDmg * critMul * (1 / 0.3) * 0.25;
}
const pctFmt = v => Math.round(v) + '%';
function metrics() {
  const m = [
    { label: 'Damage per second', f: estDps, fmt: v => fmt(v), main: true },
    { label: 'Damage per hit', f: s => s.dmg, fmt: v => fmt(v) },
    { label: 'Attacks per second', f: s => s.atkRate, fmt: v => v.toFixed(2) }
  ];
  if (P.cls === 'archangel') m.push({ label: 'Cleave arc', f: s => s.arc, fmt: v => v + '°' });
  else m.push({ label: P.cls === 'ophan' ? 'Eyes per volley' : 'Bolts per volley', f: s => s.shots, fmt: v => v });
  m.push(
    { label: 'Orbiting wheels', f: s => s.orbs, fmt: v => v },
    { label: 'Maximum life', f: s => s.maxHp, fmt: v => fmt(v), main: true },
    { label: 'Armor', f: s => s.armor, fmt: v => fmt(v) },
    { label: 'Damage taken', f: s => s.dr * 100, fmt: pctFmt, lower: true },
    { label: 'Critical chance', f: s => s.crit * 100, fmt: pctFmt },
    { label: 'Critical damage', f: s => s.critDmg * 100, fmt: pctFmt },
    { label: 'Choir skill power', f: s => s.skillPow * 100, fmt: pctFmt },
    { label: 'Companion damage', f: s => s.petPow * 100, fmt: pctFmt },
    { label: 'Movement speed', f: s => s.speed, fmt: v => v.toFixed(2) },
    { label: 'Cooldown reduction', f: s => s.cdr * 100, fmt: pctFmt },
    { label: 'Dash charges', f: s => s.charges, fmt: v => v },
    { label: 'Grace gain', f: s => s.graceMul * 100, fmt: pctFmt },
    { label: 'Graze radius', f: s => s.grazeR, fmt: v => v.toFixed(2) },
    { label: 'Pickup radius', f: s => s.magnet, fmt: v => v.toFixed(1) },
    { label: 'Life per kill', f: s => s.lifeOnKill, fmt: v => fmt(v) }
  );
  return m;
}
function previewEquip(ref) {
  const it = itemAt(ref); if (!it || !canEquip(it)) return null;
  const eq = Object.assign({}, P.equip); eq[it.slot] = ref.where === 'equip' ? null : it; return eq;
}
function statDiff(ref) {
  const eq = previewEquip(ref); if (!eq) return null;
  const now = S, next = computeStats(eq), rows = [];
  for (const m of metrics()) {
    const a = m.f(now), b = m.f(next), d = b - a;
    if (Math.abs(d) < 1e-6 || m.fmt(a) === m.fmt(b)) continue;
    const rel = Math.abs(a) > 1e-6 && !String(m.fmt(a)).endsWith('%') ? ` (${d > 0 ? '+' : '−'}${Math.abs(d / a * 100).toFixed(0)}%)` : '';
    rows.push({ m, d, good: m.lower ? d < 0 : d > 0, rel });
  }
  const gained = [], lost = [];
  for (const k in next.flags) if (!now.flags[k]) gained.push(k);
  for (const k in now.flags) if (!next.flags[k]) lost.push(k);
  return { rows, gained, lost, next };
}
function diffHtml(ref, title) {
  const it = itemAt(ref);
  if (it && !canEquip(it)) return `<div class="tt-diff"><div class="it-warn">Only ${CLASSES[it.cls].name === 'Archangel' ? 'an' : 'a'} ${CLASSES[it.cls].name} can wield this. Keep it in the stash for them.</div></div>`;
  const df = statDiff(ref); if (!df) return '';
  let h = `<div class="tt-diff"><div class="tt-h">${title}</div>`;
  if (!df.rows.length && !df.gained.length && !df.lost.length) h += '<div class="tt-same">No change to your stats</div>';
  for (const r of df.rows) h += `<div class="tt-row ${r.good ? 'up' : 'down'}${r.m.main ? ' main' : ''}"><span class="arw">${r.good ? '▲' : '▼'}</span><span class="v">${r.d > 0 ? '+' : '−'}${r.m.fmt(Math.abs(r.d))}${r.rel}</span><span class="n">${r.m.label}</span></div>`;
  for (const k of df.gained) h += `<div class="tt-row up"><span class="arw">▲</span><span class="v"></span><span class="n">Gains ${POWERS[k].name}</span></div>`;
  for (const k of df.lost) h += `<div class="tt-row down"><span class="arw">▼</span><span class="v"></span><span class="n">Loses ${POWERS[k].name}</span></div>`;
  return h + '</div>';
}
const salvageSouls = it => Math.round({ common: 15, magic: 40, rare: 110, legend: 300 }[it.rarity] * (1 + it.ilvl * 0.15));
function itemCard(it, eyebrow) {
  return `<div class="tt-card r-${it.rarity}">${eyebrow ? `<div class="tt-eb">${eyebrow}</div>` : ''}<div class="it-name">${esc(it.name)}</div>
    <div class="it-sub">${TIER_LABEL[it.rarity]} ${SLOT_LABEL[it.slot].toLowerCase()} · ${esc(it.base)}${it.slot === 'weapon' ? ' · ' + CLASSES[it.cls].name : ''}</div>
    <ul class="it-mods">${it.mods.map(m => `<li class="${m.imp ? 'imp' : ''}">${modText(m, it.cls)}</li>`).join('')}</ul>
    ${it.power ? `<p class="it-power">${POWERS[it.power].text}<i>${POWERS[it.power].src}</i></p>` : ''}
    <div class="tt-ilvl">Item level ${it.ilvl} · salvages for ${fmt(salvageSouls(it))} souls</div></div>`;
}
const ttEl = $('tt');
function showTooltip(ref, x, y) {
  const it = itemAt(ref); if (!it) { hideTooltip(); return; }
  const loose = ref.where !== 'equip', eq = loose ? P.equip[it.slot] : null;
  let main = itemCard(it, ref.where === 'equip' ? 'Worn' : ref.where === 'stash' ? 'In the stash' : '');
  main += diffHtml(ref, loose ? (eq ? 'If you swap it in' : 'If you equip it') : 'If you take it off');
  main += `<div class="tt-keys">${loose ? 'Double-click to equip · <kbd>T</kbd> move · <kbd>X</kbd> salvage' : 'Double-click to take off'}</div>`;
  ttEl.innerHTML = `<div class="tt-col">${main}</div>${eq && canEquip(it) ? `<div class="tt-col tt-worn">${itemCard(eq, 'Currently worn')}</div>` : ''}`;
  ttEl.hidden = false; placeTooltip(x, y);
}
function placeTooltip(x, y) {
  if (ttEl.hidden) return;
  const r = ttEl.getBoundingClientRect(), pad = 12, vw = innerWidth, vh = innerHeight;
  let left = x + 22, top = y - 20;
  if (left + r.width > vw - pad) left = x - 22 - r.width;
  if (left < pad) left = Math.max(pad, (vw - r.width) / 2);
  if (top + r.height > vh - pad) top = vh - pad - r.height;
  if (top < pad) top = pad;
  ttEl.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
}
function hideTooltip() { ttEl.hidden = true; }
function renderDetail() {
  const selIt = itemAt(sel);
  let html = '';
  if (selIt) {
    const w = sel.where;
    html += `<div class="sel-card">${itemCard(selIt, w === 'equip' ? 'Selected · worn' : w === 'stash' ? 'Selected · in the stash' : 'Selected · in your bag')}`;
    if (!canEquip(selIt)) html += `<p class="it-warn">Only the ${CLASSES[selIt.cls].name} can wield this.</p>`;
    html += '<div class="acts">';
    if (w === 'equip') html += `<button class="act" data-act="unequip" ${P.bag.length >= BAG_SIZE && !(inHub() && SAVE.stash.length < STASH_SIZE) ? 'disabled' : ''}>Take off</button>`;
    else {
      html += `<button class="act" data-act="equip" ${canEquip(selIt) ? '' : 'disabled'}>Equip</button>`;
      if (inHub()) html += `<button class="act alt" data-act="move">${w === 'bag' ? 'To stash' : 'To bag'}</button>`;
      html += `<button class="act soul" data-act="salvage">Salvage · +${fmt(salvageSouls(selIt))} souls</button>`;
    }
    html += '</div></div>';
  }
  html += renderSheet(hover || sel);
  detailEl.innerHTML = html;
}
function renderSheet(ref) {
  const c = CLASSES[P.cls], it = itemAt(ref), df = it ? statDiff(ref) : null, next = df ? df.next : null;
  const rows = metrics().map(m => {
    const a = m.f(S); let cell = `<dd>${m.fmt(a)}</dd>`, cls = '';
    if (next) { const b = m.f(next); if (m.fmt(a) !== m.fmt(b)) { cls = (m.lower ? b < a : b > a) ? 'up' : 'down'; cell = `<dd class="${cls}"><s>${m.fmt(a)}</s> ${m.fmt(b)}</dd>`; } }
    return `<dt class="${cls}${m.main ? ' main' : ''}">${m.label}</dt>${cell}`;
  }).join('');
  const powers = Object.keys(S.flags).map(k => `<p class="it-power">${POWERS[k].name}: ${POWERS[k].text}</p>`).join('');
  const head = it && next ? `<div class="it-sub">Previewing ${ref.where === 'equip' ? 'removing' : 'equipping'} <b class="r-${it.rarity}" style="color:var(--rc)">${esc(it.name)}</b></div>` : `<div class="it-sub">${c.sphere} · ${c.role} · rank ${rankOf(P.h.xp).rank}</div>`;
  return `<div class="sheet"><h4>${c.name}</h4>${head}<dl>${rows}</dl><div class="powers">${powers}</div>
    <p class="hint">${input.touch ? 'Tap an item to compare it with what you wear.' : 'Hover an item to preview how it changes you. Damage per second is an estimate against a pack of the Fallen.'}</p></div>`;
}
function afterGearChange() { recalc(); markDirty(); hover = null; hideTooltip(); renderGear(); }
function equipFrom(ref) {
  const list = listOf(ref.where), it = list && list[ref.idx]; if (!it) return;
  if (!canEquip(it)) { toast(`Only the <b>${CLASSES[it.cls].name}</b> can wield that`, 'common'); return; }
  const old = P.equip[it.slot]; P.equip[it.slot] = it; it.isNew = false; list.splice(ref.idx, 1);
  if (old) list.splice(ref.idx, 0, old);
  sel = { where: 'equip', slot: it.slot }; sfx('equip'); afterGearChange();
}
function unequip(slot) {
  const it = P.equip[slot]; if (!it) return;
  const to = P.bag.length < BAG_SIZE ? P.bag : (inHub() && SAVE.stash.length < STASH_SIZE ? SAVE.stash : null);
  if (!to) { toast('Your bag is full', 'common'); return; }
  P.equip[slot] = null; to.push(it); sel = { where: to === P.bag ? 'bag' : 'stash', idx: to.length - 1 }; sfx('equip'); afterGearChange();
}
function moveItem(ref) {
  if (!inHub() || ref.where === 'equip') return;
  const from = listOf(ref.where), to = ref.where === 'bag' ? SAVE.stash : P.bag, cap = ref.where === 'bag' ? STASH_SIZE : BAG_SIZE;
  if (to.length >= cap) { toast(ref.where === 'bag' ? 'The stash is full' : 'Your bag is full', 'common'); return; }
  const it = from.splice(ref.idx, 1)[0]; it.isNew = false; to.push(it);
  sel = { where: ref.where === 'bag' ? 'stash' : 'bag', idx: to.length - 1 }; sfx('equip'); afterGearChange();
}
function salvage(ref) {
  const list = listOf(ref.where), it = list && list[ref.idx]; if (!it) return;
  const v = salvageSouls(it); list.splice(ref.idx, 1);
  if (state === 'inventory') earn(v); else { SAVE.souls += v; SAVE.totals.souls += v; }
  toast(`Salvaged <b>${esc(it.name)}</b> · +${fmt(v)} souls`, 'common'); sel = null; sfx('salvage'); afterGearChange();
}
const refOf = el => el.dataset.where === 'equip' ? { where: 'equip', slot: el.dataset.slot } : { where: el.dataset.where, idx: +el.dataset.idx };
for (const host of [dollEl, bagEl, stashEl]) {
  host.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const t = e.target.closest('.tile.filled');
    if (!t) { if (hover) { hover = null; hideTooltip(); renderDetail(); } return; }
    const r = refOf(t);
    if (!sameRef(hover, r)) { hover = r; showTooltip(r, e.clientX, e.clientY); renderDetail(); }
    else placeTooltip(e.clientX, e.clientY);
  });
  host.addEventListener('pointerleave', () => { if (hover) { hover = null; hideTooltip(); renderDetail(); } });
  host.addEventListener('click', e => { const t = e.target.closest('.tile.filled'); if (!t) return; sel = refOf(t);
    for (const x of document.querySelectorAll('#invScr .tile.sel')) x.classList.remove('sel'); t.classList.add('sel'); renderDetail(); });
  host.addEventListener('dblclick', e => { const t = e.target.closest('.tile.filled'); if (!t) return; const r = refOf(t); if (r.where === 'equip') unequip(r.slot); else equipFrom(r); });
  host.addEventListener('focusin', e => { const t = e.target.closest('.tile.filled'); if (!t || e.target.matches(':hover')) return; const rc = t.getBoundingClientRect(); hover = refOf(t); showTooltip(hover, rc.right - 10, rc.top + 10); renderDetail(); });
  host.addEventListener('focusout', () => { if (hover && !host.matches(':hover')) { hover = null; hideTooltip(); renderDetail(); } });
}
detailEl.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || !sel) return;
  const a = b.dataset.act;
  if (a === 'equip') equipFrom(sel); else if (a === 'unequip') unequip(sel.slot); else if (a === 'move') moveItem(sel); else if (a === 'salvage') salvage(sel);
});
$('invClose').addEventListener('click', closeInv);

/* ----- choir skills ----- */
function spend(cost) { if (SAVE.souls < cost) return false; SAVE.souls -= cost; saveNow(); sfx('buy'); return true; }
function setLoadout(slot, id) {
  const L = P.h.skills.loadout, other = 1 - slot;
  if (L[other] === id) L[other] = L[slot];
  L[slot] = id; saveNow();
  P.slots = L.map((sid, i) => ({ id: sid, cd: inHub() ? 0 : (P.slots[i] && P.slots[i].id === sid ? P.slots[i].cd : skillCdOf(sid)) }));
  refreshSkillIcons(); renderSkills();
}
function renderSkills() {
  const host = $('tabSkills'), L = P.h.skills.loadout, owned = P.h.skills.owned;
  host.innerHTML = `<p class="hint" style="margin:0 0 12px">You carry two choir skills. <span class="deskonly" style="display:inline"><kbd>Q</kbd> or right click casts the first, <kbd>R</kbd> the second.</span> Skills strike harder as your damage grows, and with relics of choir skill power.</p><div class="grid2"></div>`;
  const grid = host.querySelector('.grid2');
  for (const d of SKILLS[P.cls]) {
    const own = owned.includes(d.id), slot = L.indexOf(d.id), card = document.createElement('div');
    card.className = 'pcard' + (slot >= 0 ? ' on' : '') + (own ? '' : ' locked');
    card.innerHTML = `<div class="badges">${slot >= 0 ? `<span class="badge">${slot ? 'R' : 'Q'}</span>` : ''}</div>
      <div class="head"><div class="ic">${ICON[d.id]}</div><div><h3>${d.name}</h3><div class="src">${d.src}</div></div></div>
      <p>${d.desc}</p><div class="meta"><span>Returns in ${skillCdOf(d.id).toFixed(1)}s</span></div><div class="acts"></div>`;
    const acts = card.querySelector('.acts');
    if (own) for (const s of [0, 1]) { const b = document.createElement('button'); b.className = 'act' + (L[s] === d.id ? ' alt' : ''); b.textContent = L[s] === d.id ? `Carried as ${s ? 'R' : 'Q'}` : `Carry as ${s ? 'R' : 'Q'}`; b.disabled = L[s] === d.id; b.addEventListener('click', () => setLoadout(s, d.id)); acts.appendChild(b); }
    else { const b = document.createElement('button'); b.className = 'act soul'; b.textContent = `Learn · ${fmt(d.cost)} souls`; b.disabled = SAVE.souls < d.cost;
      b.addEventListener('click', () => { if (spend(d.cost)) { owned.push(d.id); toast(`Learned <b>${d.name}</b>`, 'legend'); renderReliquary(); } }); acts.appendChild(b); }
    grid.appendChild(card);
  }
}

/* ----- companions ----- */
function petLine(kind, lvl) {
  const b = S.baseDps, k = petPower(lvl) * S.petPow;
  if (kind === 'hound') return `Bite ${fmt((6 + b * 0.22) * k)} · about ${fmt((6 + b * 0.22) * k / 0.55)} per second`;
  if (kind === 'dove') return `Heals ${fmt(S.maxHp * (0.025 + 0.004 * lvl) * Math.sqrt(S.petPow))} every ${(6 / (1 + 0.05 * (lvl - 1))).toFixed(1)}s`;
  if (kind === 'eagle') return `Dive ${fmt((10 + b * 1.4) * k)} every ${(3.2 / (1 + 0.06 * (lvl - 1))).toFixed(1)}s`;
  return `Arrow ${fmt((2 + b * 0.09) * k)} · ${(2 * (1 + 0.04 * (lvl - 1))).toFixed(1)} per second`;
}
function renderPets() {
  const host = $('tabPet');
  host.innerHTML = `<p class="hint" style="margin:0 0 12px">One companion walks with you on every descent, whichever choir you choose. They keep their level forever.</p><div class="grid2"></div>`;
  const grid = host.querySelector('.grid2');
  for (const kind of PET_ORDER) {
    const d = PETS[kind], lvl = SAVE.pets.owned[kind] || 0, active = SAVE.pets.active === kind, card = document.createElement('div');
    card.className = 'pcard' + (active ? ' on' : '') + (lvl ? '' : ' locked');
    const pips = Array.from({ length: PET_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    card.innerHTML = `<div class="badges">${active ? '<span class="badge">With you</span>' : ''}</div>
      <div class="head"><div class="ic">${d.icon}</div><div><h3>${d.name}</h3><div class="src">${d.src}</div></div></div>
      <p>${d.role}</p><div class="meta"><span>${lvl ? `Level ${lvl}` : 'Not yet with you'}</span><span class="pips" aria-hidden="true">${pips}</span></div>
      <div class="meta"><span>${petLine(kind, Math.max(1, lvl))}</span></div><div class="acts"></div>`;
    const acts = card.querySelector('.acts');
    const btn = (txt, cls, dis, fn) => { const b = document.createElement('button'); b.className = 'act' + (cls ? ' ' + cls : ''); b.textContent = txt; b.disabled = !!dis; b.addEventListener('click', fn); acts.appendChild(b); };
    if (!lvl) btn(`Bring along · ${fmt(d.cost)} souls`, 'soul', SAVE.souls < d.cost, () => { if (spend(d.cost)) { SAVE.pets.owned[kind] = 1; SAVE.pets.active = kind; saveNow(); spawnPet(); toast(`<b>${d.name}</b> joins you`, 'legend'); renderReliquary(); } });
    else {
      btn(active ? 'Walking with you' : 'Walk with me', active ? 'alt' : '', active, () => { SAVE.pets.active = kind; saveNow(); spawnPet(); renderPets(); });
      if (lvl < PET_MAX) { const c = petUpgradeCost(lvl); btn(`Strengthen · ${fmt(c)} souls`, 'soul', SAVE.souls < c, () => { if (spend(c)) { SAVE.pets.owned[kind] = lvl + 1; saveNow(); if (pet && pet.kind === kind) pet.lvl = lvl + 1; renderReliquary(); } }); }
    }
    grid.appendChild(card);
  }
}

/* ======================= SCREENS ======================= */
function hideOverlays() { for (const id of ['titleScr', 'deadScr', 'levelScr', 'pauseScr', 'invScr', 'recordScr']) $(id).hidden = true; hideTooltip(); }
function enterTitle() {
  state = 'title'; hideOverlays(); showHud(false); resetWorld();
  if (pet) { scene.remove(pet.mesh); pet = null; }
  W = freshWave(); W.n = 3; setHero(lastCls); heroModel(lastCls).root.visible = false;
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; const e = spawnEnemy(['caster', 'spinner', 'imp', 'brute'][i], Math.cos(a) * 9, Math.sin(a) * 9); e.spawnT = 0; e.mesh.scale.setScalar(1); }
  buildTitle(); $('titleScr').hidden = false;
}
function enterHub(cls) {
  initAudio(); hideOverlays(); showHud(false); resetWorld(); W = freshWave();
  setHero(cls); P.x = 0; P.z = 0; P.aimX = Math.sin(FACE_CAM); P.aimZ = Math.cos(FACE_CAM);
  state = 'hub'; spawnPet(); sel = null; hover = null; hubGate = P.h.gate;
  invScr.classList.add('hub'); renderReliquary(); invScr.hidden = false; camSnap();
}
function buildTitle() {
  const wrap = $('classes'); wrap.innerHTML = '';
  CLASS_KEYS.forEach((k, i) => {
    const c = CLASSES[k], h = hero(k), rk = rankOf(h.xp).rank;
    const b = document.createElement('button'); b.className = 'cls'; b.style.setProperty('--c', c.color);
    b.innerHTML = `<span class="role"><span>${c.sphere}</span><span>${c.role} <kbd class="deskonly" style="display:inline">${i + 1}</kbd></span></span><h3>${c.name}</h3><p>${c.blurb}</p>
      <ul>${c.perks.map(p => `<li><b>${p[0]}</b> · ${p[1]}</li>`).join('')}</ul>
      <div class="prog"><span>Rank ${rk}</span><span>${h.deepest ? `Deepest circle ${roman(h.deepest)}` : 'Not yet descended'}</span>${h.best ? `<span>Best ${fmt(h.best)} souls</span>` : ''}</div>
      <span class="go">Enter the sanctuary</span>`;
    b.addEventListener('click', () => enterHub(k)); wrap.appendChild(b);
  });
  $('soulBank').textContent = SAVE.souls ? `${fmt(SAVE.souls)} souls held` : '';
  renderSync();
}
function renderSync() {
  const cloud = Store.status === 'cloud';
  $('syncDot').className = 'dot' + (cloud ? ' cloud' : '');
  $('syncTxt').textContent = cloud ? 'Progress is saved to your Claude account' : 'Progress is saved in this browser';
}
syncListener = () => { renderSync(); };
function showRunSummary(died) {
  showHud(false); hideTip();
  $('deadEyebrow').textContent = died ? 'Your light goes out' : 'You rise from the pit';
  $('deadH').textContent = died ? `${CLASSES[P.cls].name} fallen in Circle ${roman(Math.max(1, W.n))}` : `Returned from Circle ${roman(Math.max(1, W.n))}`;
  $('stSouls').textContent = fmt(stats.score); $('stCircle').textContent = roman(Math.max(1, stats.deepest)); $('stKills').textContent = stats.kills;
  $('stGraze').textContent = stats.grazes; $('stLoot').textContent = stats.loot;
  const t = Math.floor(stats.time); $('stTime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('deadNote').textContent = `Every relic in your bag and every soul is kept · ${fmt(SAVE.souls)} souls held`;
  setTimeout(() => { if (state === 'dead') { $('deadScr').hidden = false; $('againBtn').focus({ preventScroll: true }); } }, died ? 1100 : 0);
}
function setPause(on) {
  if (on && state === 'play') { state = 'paused'; $('pauseScr').hidden = false; keys.clear(); input.firing = false; saveNow(); }
  else if (!on && state === 'paused') { state = 'play'; $('pauseScr').hidden = true; blurActive(); }
}
function leaveRun() { if (state !== 'paused') return; $('pauseScr').hidden = true; state = 'dead'; finishRun(false); }
$('againBtn').addEventListener('click', () => startRun(lastCls, P.h.gate));
$('hubBtn').addEventListener('click', () => enterHub(lastCls));
$('resumeBtn').addEventListener('click', () => setPause(false));
$('leaveBtn').addEventListener('click', leaveRun);
$('hubGo').addEventListener('click', () => { hideOverlays(); startRun(P.cls, hubGate); });
$('hubBack').addEventListener('click', enterTitle);

/* ----- save code ----- */
let eraseArmed = 0;
function openRecord() {
  $('recordWhere').textContent = Store.status === 'cloud' ? 'Your progress saves itself to your Claude account and to this browser.' : 'Your progress saves itself in this browser. Clearing site data would remove it, so keep a code somewhere safe.';
  saveNow(); $('recordCode').value = exportCode(); $('recordMsg').textContent = ''; eraseArmed = 0; $('eraseBtn').textContent = 'Erase all progress';
  $('recordScr').hidden = false;
}
$('recordBtn').addEventListener('click', openRecord);
$('recordClose').addEventListener('click', () => { $('recordScr').hidden = true; buildTitle(); });
$('copyCode').addEventListener('click', () => {
  const ta = $('recordCode'); ta.value = exportCode();
  const done = () => { $('recordMsg').textContent = 'Copied'; }, fallback = () => { ta.focus(); ta.select(); $('recordMsg').textContent = 'Selected · press Ctrl+C or ⌘C to copy'; };
  try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (e) { fallback(); }
});
$('loadCode').addEventListener('click', () => {
  const s = importCode($('recordCode').value);
  if (!s) { $('recordMsg').textContent = 'That code could not be read. It should start with BH1.'; return; }
  adoptSave(s); saveNow(); $('recordMsg').textContent = `Loaded · ${fmt(SAVE.souls)} souls held`; buildTitle();
});
$('eraseBtn').addEventListener('click', () => {
  if (Date.now() - eraseArmed > 5000) { eraseArmed = Date.now(); $('eraseBtn').textContent = 'Click again to erase everything'; return; }
  adoptSave(sanitizeSave(newSave())); saveNow(); eraseArmed = 0; $('eraseBtn').textContent = 'Erase all progress';
  $('recordCode').value = exportCode(); $('recordMsg').textContent = 'All progress erased'; buildTitle();
});
function adoptSave(s) { SAVE = s; VIEW.want = SAVE.settings.zoom; muted = SAVE.settings.muted; if (state === 'title') { setHero(lastCls); heroModel(lastCls).root.visible = false; buildTitle(); } }

/* ======================= INPUT =======================
   Keys are tracked by physical code (layout-independent). The mouse is tracked on the window,
   so aim never freezes over HUD or overlays, and any lost button-up is healed by `buttons`. */
const keys = new Set();
const input = { cx: innerWidth / 2, cy: innerHeight / 2 - 80, firing: false, autofire: true, touch: false, stickId: null, ox: 0, oy: 0, sx: 0, sy: 0 };
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyQ', 'KeyE', 'KeyR']);
addEventListener('keydown', e => {
  const c = e.code, typing = e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT');
  if (typing) return;
  if ((state === 'play' && GAME_KEYS.has(c)) || ((state === 'inventory' || state === 'hub') && c === 'Tab')) e.preventDefault();
  const first = !keys.has(c); keys.add(c);
  if (!first && e.repeat) return;
  if (state === 'play') {
    if (c === 'Space') dash(); else if (c === 'KeyQ') useSkill(0); else if (c === 'KeyR') useSkill(1); else if (c === 'KeyE') ascend();
    else if (c === 'KeyI' || c === 'Tab' || c === 'KeyB') openInv();
    else if (c === 'KeyF') { input.autofire = !input.autofire; showTip(input.autofire ? 'Auto-attack on' : 'Auto-attack off · hold left mouse to attack'); }
    else if (c === 'KeyP' || c === 'Escape') setPause(true);
  } else if (state === 'paused' && (c === 'KeyP' || c === 'Escape')) setPause(false);
  else if (state === 'inventory' || state === 'hub') {
    if (state === 'inventory' && (c === 'KeyI' || c === 'Tab' || c === 'Escape' || c === 'KeyB')) closeInv();
    else if (state === 'hub' && c === 'Escape') enterTitle();
    else if (sel && invTab === 'gear') {
      if (c === 'KeyE') { if (sel.where === 'equip') unequip(sel.slot); else equipFrom(sel); }
      else if (c === 'KeyT') moveItem(sel);
      else if ((c === 'KeyX' || c === 'Delete') && sel.where !== 'equip') salvage(sel);
    }
  }
  else if (state === 'levelup' && /^Digit[123]$/.test(c)) choose(+c.slice(5) - 1);
  else if (state === 'title' && /^Digit[123]$/.test(c) && $('recordScr').hidden) enterHub(CLASS_KEYS[+c.slice(5) - 1]);
  else if (state === 'dead' && c === 'Enter' && !$('deadScr').hidden) startRun(lastCls, P.h.gate);
  if (c === 'KeyM') { muted = !muted; SAVE.settings.muted = muted; markDirty(); if (state === 'play') showTip(muted ? 'Choir silenced' : 'Choir restored'); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); input.firing = false; setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); input.firing = false; setPause(true); flushSave(); } });
addEventListener('pagehide', () => flushSave());
addEventListener('contextmenu', e => { if (state === 'play' || e.target === canvas) e.preventDefault(); });
canvas.addEventListener('wheel', e => { if (state !== 'play') return; e.preventDefault(); VIEW.want = clamp(VIEW.want + Math.sign(e.deltaY) * 0.8, 7, 15); SAVE.settings.zoom = VIEW.want; markDirty(); }, { passive: false });
const stickEl = $('stick'), knobEl = $('knob');
function setMouseMode() { if (input.touch) { input.touch = false; document.body.classList.remove('touch'); } }
function setTouchMode() { if (!input.touch) { input.touch = true; document.body.classList.add('touch'); } }
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') {
    if (e.pointerId === input.stickId) {
      let dx = e.clientX - input.ox, dy = e.clientY - input.oy; const l = Math.hypot(dx, dy), R = 50;
      if (l > R) { dx *= R / l; dy *= R / l; }
      input.sx = dx / R; input.sy = dy / R; knobEl.style.transform = `translate(${dx}px,${dy}px)`;
    }
    return;
  }
  setMouseMode();
  input.cx = e.clientX; input.cy = e.clientY;
  if (input.firing && !(e.buttons & 1)) input.firing = false;
}, { passive: true });
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') {
    setTouchMode();
    if (input.stickId === null) {
      input.stickId = e.pointerId; input.ox = e.clientX; input.oy = e.clientY; input.sx = input.sy = 0;
      stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knobEl.style.transform = ''; stickEl.hidden = false;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    return;
  }
  setMouseMode(); blurActive();
  input.cx = e.clientX; input.cy = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  if (e.button === 0) input.firing = true; else if (e.button === 2) useSkill(0);
});
function endPointer(e) {
  if (e.pointerId === input.stickId) { input.stickId = null; input.sx = input.sy = 0; stickEl.hidden = true; }
  if (e.pointerType !== 'touch' && (e.button === 0 || e.type === 'pointercancel')) input.firing = false;
}
addEventListener('pointerup', endPointer); addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', e => { if (e.pointerType !== 'touch') input.firing = false; });
document.documentElement.addEventListener('mouseleave', () => { input.firing = false; });
if (matchMedia('(hover: none) and (pointer: coarse)').matches) setTouchMode();
const bindBtn = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
bindBtn('skDash', dash); bindBtn('skQ', () => useSkill(0)); bindBtn('skR', () => useSkill(1)); bindBtn('skAsc', ascend); bindBtn('skBag', openInv);
