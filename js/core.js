'use strict';
/* Brimstone Halo · core helpers and the save system.
   Every script in js/ is a classic script: top-level declarations are shared across files. */

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const wrapAng = a => Math.atan2(Math.sin(a), Math.cos(a));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function roman(n) { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) { while (n >= v) { s += r; n -= v; } } return s || '0'; }
function blurActive() { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }

const ARENA_R = 30, FLOOR_R = 31, BULLET_Y = 0.7;
const MAX_EB = 3200, MAX_PB = 900, MAX_GEM = 900, MAX_PART = 2600;
const BAG_SIZE = 30, STASH_SIZE = 50;

/* ======================= SAVE =======================
   One JSON record holds everything that lasts between descents. It is written to localStorage
   on this device and, when the page runs inside Claude with the `db` capability, mirrored to the
   viewer's private `data/users/<id>/save` document so it follows them across devices. */
const SAVE_KEY = 'brimstone-halo/save/v1';
function newHero() {
  return { xp: 0, deepest: 0, best: 0, runs: 0, gate: 1, starter: false,
    equip: { weapon: null, helm: null, chest: null, gloves: null, boots: null, amulet: null, ring: null },
    bag: [], skills: null };
}
function newSave() {
  return { v: 1, savedAt: 0, souls: 0, nextId: 1, stash: [], heroes: {},
    pets: { owned: { hound: 1 }, active: 'hound' },
    settings: { zoom: 10.5, muted: false },
    totals: { runs: 0, kills: 0, souls: 0 } };
}
let SAVE = newSave();
const Store = { cloud: null, busy: false, again: false, off: false, dirty: false, timer: 0, status: 'local' };

function readLocal() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function writeLocal(json) { try { localStorage.setItem(SAVE_KEY, json); return true; } catch (e) { return false; } }
function markDirty() { Store.dirty = true; if (!Store.timer) Store.timer = setTimeout(flushSave, 1500); }
function flushSave() {
  clearTimeout(Store.timer); Store.timer = 0;
  if (!Store.dirty) return;
  Store.dirty = false; SAVE.savedAt = Date.now();
  const json = JSON.stringify(SAVE);
  writeLocal(json); pushCloud(json);
}
function saveNow() { Store.dirty = true; flushSave(); }
async function pushCloud(json) {
  if (!Store.cloud || Store.off) return;
  if (Store.busy) { Store.again = true; return; }
  Store.busy = true;
  try { await Store.cloud.set({ v: 1, savedAt: SAVE.savedAt, blob: json }); setSync('cloud'); }
  catch (e) {
    const c = e && e.code;
    if (c === 'unavailable' || c === 'resource_exhausted') setTimeout(() => { Store.again = true; if (!Store.busy) pushCloud(JSON.stringify(SAVE)); }, 1500 + Math.random() * 1500);
    else { Store.off = true; setSync('local'); }
  }
  Store.busy = false;
  if (Store.again) { Store.again = false; pushCloud(JSON.stringify(SAVE)); }
}
async function initCloud(canAdopt, adopt) {
  const cl = window.claude;
  if (!cl || typeof cl.use !== 'function') return;
  try {
    const [db, user] = await Promise.all([cl.use('db'), cl.use('user')]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    const ref = db.doc('data/users/' + uid + '/save');
    const snap = await ref.get();
    Store.cloud = ref;
    let remote = null;
    if (snap.exists) { try { remote = sanitizeSave(JSON.parse(snap.data().blob)); } catch (e) { remote = null; } }
    if (remote && (remote.savedAt || 0) > (SAVE.savedAt || 0) && canAdopt()) adopt(remote);
    else if (SAVE.savedAt) pushCloud(JSON.stringify(SAVE));
    setSync('cloud');
  } catch (e) { /* stays on this device only */ }
}
let syncListener = null;
function setSync(s) { Store.status = s; if (syncListener) syncListener(s); }

/* save codes: a portable copy of the record */
function exportCode() {
  const bytes = new TextEncoder().encode(JSON.stringify(SAVE));
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'BH1.' + btoa(bin);
}
function importCode(code) {
  const raw = String(code || '').trim().replace(/\s+/g, '');
  if (!raw.startsWith('BH1.')) return null;
  try {
    const bin = atob(raw.slice(4)), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return sanitizeSave(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) { return null; }
}

/* Anything read back from storage or a pasted code is untrusted: rebuild it field by field.
   (Uses SLOTS, AFFIX, POWERS, CLASSES, SKILLS, PETS from data.js; only called after it loads.) */
const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
function cleanItem(it) {
  if (!it || typeof it !== 'object' || !SLOTS.includes(it.slot)) return null;
  const mods = Array.isArray(it.mods) ? it.mods.slice(0, 8).map(m => m && (AFFIX[m.k] || m.k === 'extra') ? { k: m.k, v: num(m.v, 1, -9999, 9999), imp: !!m.imp } : null).filter(Boolean) : [];
  return {
    id: num(it.id, 0, 0, 1e9) | 0, slot: it.slot,
    rarity: ['common', 'magic', 'rare', 'legend'].includes(it.rarity) ? it.rarity : 'common',
    cls: CLASSES[it.cls] ? it.cls : 'seraph', base: str(it.base, 30) || 'Relic', name: str(it.name, 60) || 'Relic',
    ilvl: num(it.ilvl, 1, 1, 999) | 0, mods, power: POWERS[it.power] ? it.power : null, isNew: !!it.isNew
  };
}
function cleanSkills(cls, s) {
  const ids = SKILLS[cls].map(k => k.id), def = SKILLS[cls].filter(k => !k.cost).map(k => k.id);
  const owned = Array.from(new Set([...def, ...((s && Array.isArray(s.owned)) ? s.owned.filter(x => ids.includes(x)) : [])]));
  let load = (s && Array.isArray(s.loadout)) ? s.loadout.filter(x => owned.includes(x)).slice(0, 2) : [];
  for (const id of owned) { if (load.length >= 2) break; if (!load.includes(id)) load.push(id); }
  return { owned, loadout: load };
}
function sanitizeSave(o) {
  if (!o || typeof o !== 'object') return null;
  const s = newSave();
  s.savedAt = num(o.savedAt, 0, 0, 1e15);
  s.souls = Math.floor(num(o.souls, 0, 0, 1e12));
  s.nextId = Math.floor(num(o.nextId, 1, 1, 1e9));
  s.stash = (Array.isArray(o.stash) ? o.stash : []).map(cleanItem).filter(Boolean).slice(0, STASH_SIZE);
  for (const cls of Object.keys(CLASSES)) {
    const h = o.heroes && o.heroes[cls], n = newHero();
    if (h && typeof h === 'object') {
      n.xp = num(h.xp, 0, 0, 1e12); n.deepest = num(h.deepest, 0, 0, 9999) | 0; n.best = num(h.best, 0, 0, 1e12);
      n.runs = num(h.runs, 0, 0, 1e9) | 0; n.gate = num(h.gate, 1, 1, 9999) | 0; n.starter = !!h.starter;
      for (const slot of SLOTS) { const it = h.equip && cleanItem(h.equip[slot]); n.equip[slot] = it && it.slot === slot && (slot !== 'weapon' || it.cls === cls) ? it : null; }
      n.bag = (Array.isArray(h.bag) ? h.bag : []).map(cleanItem).filter(Boolean).slice(0, BAG_SIZE);
    }
    n.skills = cleanSkills(cls, h && h.skills);
    s.heroes[cls] = n;
  }
  const po = o.pets && o.pets.owned;
  s.pets.owned = {};
  for (const k of Object.keys(PETS)) { const l = po && po[k]; if (l) s.pets.owned[k] = num(l, 1, 1, PET_MAX) | 0; }
  if (!s.pets.owned.hound) s.pets.owned.hound = 1;
  s.pets.active = o.pets && s.pets.owned[o.pets.active] ? o.pets.active : (o.pets && o.pets.active === null ? null : 'hound');
  if (o.settings) { s.settings.zoom = num(o.settings.zoom, 10.5, 7, 15); s.settings.muted = !!o.settings.muted; }
  if (o.totals) for (const k of ['runs', 'kills', 'souls']) s.totals[k] = num(o.totals[k], 0, 0, 1e13);
  // keep item ids unique even if a pasted code reused some
  let maxId = 0; const seen = new Set();
  const fix = it => { if (!it) return; if (!it.id || seen.has(it.id)) it.id = 0; else seen.add(it.id); maxId = Math.max(maxId, it.id); };
  const all = [...s.stash]; for (const cls in s.heroes) { all.push(...s.heroes[cls].bag); for (const k in s.heroes[cls].equip) if (s.heroes[cls].equip[k]) all.push(s.heroes[cls].equip[k]); }
  all.forEach(fix); s.nextId = Math.max(s.nextId, maxId + 1); for (const it of all) if (!it.id) it.id = s.nextId++;
  return s;
}
function hero(cls) { if (!SAVE.heroes[cls]) { const h = newHero(); h.skills = cleanSkills(cls, null); SAVE.heroes[cls] = h; } return SAVE.heroes[cls]; }
