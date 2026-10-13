'use strict';
/* Brimstone Halo · lore and tuning data.
   Choirs from Pseudo-Dionysius' Celestial Hierarchy, foes from 1 Enoch (the Watchers and the Nephilim),
   relics, powers and companions from scripture, abilities after the D&D celestials (Deva, Planetar, Solar). */

const BASE_STATS = { maxHp: 100, speed: 8.5, atkRate: 5, dmg: 10, shots: 0, pierce: 0, bulletSpeed: 26, homing: 0,
  dashCd: 1.2, graceMul: 1, grazeR: 1.15, magnet: 3.2, orbs: 0, orbDmg: 1.2,
  armor: 0, crit: 0.05, critDmg: 1.5, lifeOnKill: 0, arc: 0, reach: 0, waves: 0, ascDur: 6, slay: 0,
  skillCdMul: 1, skillPow: 1, skillArea: 1, petPow: 1 };

const CLASSES = {
  seraph: { name: 'Seraph', sphere: 'First Sphere', role: 'Ranged', color: '#ffd27a',
    blurb: 'The burning ones who cry Holy, Holy, Holy. Six wings, a living coal, and bolts of light from afar.',
    perks: [['Bolts', 'fast volleys at range'], ['Wings', 'six, two to fly'], ['Life', '100']],
    stats: { maxHp: 100, speed: 8.6, atkRate: 7, dmg: 11, shots: 1, bulletSpeed: 30, dashCd: 1.15 } },
  archangel: { name: 'Archangel', sphere: 'Third Sphere', role: 'Melee', color: '#ff9a6a',
    blurb: "Michael's host in burnished plate. Every swing of the flaming sword parries the fire it meets.",
    perks: [['Cleave', 'swings erase bullets'], ['Charge', 'dash strikes through foes'], ['Life', '150 · armor 35']],
    stats: { maxHp: 150, speed: 8.1, atkRate: 2.7, dmg: 30, dashCd: 1.5, armor: 35, critDmg: 1.6, arc: 120, reach: 3.0 } },
  ophan: { name: 'Ophan', sphere: 'First Sphere · Thrones', role: 'Orbit', color: '#9fd8ff',
    blurb: 'Wheels within wheels, rims full of eyes. Burning wheels grind foes and swallow bullets while the eyes hunt.',
    perks: [['Wheels', 'three orbit you'], ['Eyes', 'seeking bolts'], ['Life', '115 · armor 10']],
    stats: { maxHp: 115, speed: 8.2, atkRate: 3.6, dmg: 9, shots: 2, bulletSpeed: 17, homing: 2, dashCd: 1.25, orbs: 3, orbDmg: 1.8, armor: 10 } }
};
const CLASS_KEYS = Object.keys(CLASSES);

/* ---------- choir skills: four per choir, two carried (Q and R) ---------- */
const ICON = {
  trisagion: '<svg viewBox="0 0 32 32" fill="none" stroke="#ffe39a" stroke-width="2"><circle cx="16" cy="16" r="4" fill="#fff3c4"/><circle cx="16" cy="16" r="11" stroke-dasharray="3 3"/><path d="M16 1v6M16 25v6M1 16h6M25 16h6M5 5l4 4M23 23l4 4M27 5l-4 4M9 23l-4 4"/></svg>',
  flamestrike: '<svg viewBox="0 0 32 32" fill="none" stroke="#ffb060" stroke-width="2"><ellipse cx="16" cy="26" rx="10" ry="3"/><path d="M11 25c-2-6 3-8 2-14 3 3 4 6 3 9 2-2 2-5 1-8 5 4 6 9 4 13" fill="#ff7a3033"/></svg>',
  gale: '<svg viewBox="0 0 32 32" fill="none" stroke="#fff1d0" stroke-width="1.8"><path d="M16 16L5 6M16 16L27 6M16 16L4 18M16 16L28 18M16 16L9 28M16 16L23 28"/><path d="M5 6l3 1-1 3M27 6l-3 1 1 3" stroke="#ffd27a"/><circle cx="16" cy="16" r="2.5" fill="#ffd27a"/></svg>',
  word: '<svg viewBox="0 0 32 32" fill="none" stroke="#ffe39a" stroke-width="2"><path d="M8 6h16v20l-8-4-8 4z" fill="#ffd27a22"/><path d="M12 12h8M12 16h8M14 20h4"/></svg>',
  aegis: '<svg viewBox="0 0 32 32" fill="none" stroke="#ffd27a" stroke-width="2"><path d="M16 3l10 4v8c0 7-5 11-10 14C11 26 6 22 6 15V7z" fill="#ffd27a22"/><path d="M16 9v14M10 14h12"/></svg>',
  whirl: '<svg viewBox="0 0 32 32" fill="none" stroke="#ffb060" stroke-width="2"><path d="M16 4a12 12 0 1 1-11 8"/><path d="M5 5v7h7"/><path d="M16 10v12M12 14l4-4 4 4" stroke="#fff1d0"/></svg>',
  leap: '<svg viewBox="0 0 32 32" fill="none" stroke="#ffd27a" stroke-width="2"><path d="M5 26c4-14 12-20 22-20"/><path d="M22 4l5 2-2 5"/><ellipse cx="9" cy="27" rx="6" ry="2" stroke="#ff7a30"/></svg>',
  heal: '<svg viewBox="0 0 32 32" fill="none" stroke="#7ddc8a" stroke-width="2.2"><path d="M16 6v20M6 16h20"/><circle cx="16" cy="16" r="12" stroke="#ffd27a" stroke-width="1.5"/></svg>',
  wheel: '<svg viewBox="0 0 32 32" fill="none" stroke="#9fd8ff" stroke-width="2"><circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="5" ry="12"/><circle cx="16" cy="4" r="1.6" fill="#fff"/><circle cx="16" cy="28" r="1.6" fill="#fff"/><circle cx="4" cy="16" r="1.6" fill="#fff"/><circle cx="28" cy="16" r="1.6" fill="#fff"/><circle cx="16" cy="16" r="3" fill="#e9fbff"/></svg>',
  stillness: '<svg viewBox="0 0 32 32" fill="none" stroke="#b8e8ff" stroke-width="2"><path d="M8 4h16M8 28h16M10 4c0 7 12 8 12 12s-12 5-12 12M22 4c0 7-12 8-12 12s12 5 12 12"/></svg>',
  stream: '<svg viewBox="0 0 32 32" fill="none" stroke="#ff9a40" stroke-width="2"><path d="M4 16h4M8 16c6-6 10 6 16 0M8 16c6 6 10-6 16 0" /><path d="M24 12l4 4-4 4"/></svg>',
  eyes: '<svg viewBox="0 0 32 32" fill="none" stroke="#b8e8ff" stroke-width="1.8"><path d="M3 16c4-7 22-7 26 0-4 7-22 7-26 0z"/><circle cx="16" cy="16" r="4.5" fill="#9fd8ff55"/><circle cx="16" cy="16" r="1.8" fill="#fff"/><path d="M16 3v4M16 25v4M6 6l3 3M26 6l-3 3"/></svg>'
};
const SKILLS = {
  seraph: [
    { id: 'trisagion', name: 'Trisagion', src: 'Isaiah 6:3', cd: 8, cost: 0, desc: 'A thrice-holy burst burns away every bullet near you and hurls the Fallen back.' },
    { id: 'flamestrike', name: 'Flame Strike', src: 'Deva · Solar', cd: 6, cost: 0, desc: 'A pillar of fire falls where you aim. It erupts after a breath and burns foes and bullets inside it.' },
    { id: 'gale', name: 'Six-Winged Gale', src: 'Isaiah 6:2', cd: 10, cost: 2500, desc: 'Loose a storm of thirty burning feathers that seek the Fallen.' },
    { id: 'word', name: 'Divine Word', src: 'Solar', cd: 16, cost: 6000, desc: 'Speak a word of power. Every foe within ten paces is struck and held still for two and a half seconds.' }
  ],
  archangel: [
    { id: 'aegis', name: 'Aegis', src: 'Ephesians 6:16', cd: 9, cost: 0, desc: 'A sphere of light turns every bullet that touches it into flame aimed back at the Fallen.' },
    { id: 'whirl', name: 'Sword of Michael', src: 'Revelation 12:7', cd: 9, cost: 0, desc: 'Spin for two seconds, cutting everything around you and shattering bullets.' },
    { id: 'leap', name: 'Leap of Judgment', src: 'Planetar', cd: 8, cost: 2500, desc: 'Leap to where you aim, untouchable in the air, and land in a crushing blast.' },
    { id: 'heal', name: 'Healing Touch', src: 'Deva · Planetar', cd: 20, cost: 6000, desc: 'Restore 40% of your life and take half damage for four seconds.' }
  ],
  ophan: [
    { id: 'wheel', name: 'Wheel within Wheel', src: 'Ezekiel 1:16', cd: 9, cost: 0, desc: 'Your wheels spin wide and fast, grinding foes and swallowing bullets.' },
    { id: 'stillness', name: 'Stillness of the Throne', src: 'Celestial Hierarchy VII', cd: 14, cost: 0, desc: 'For four seconds the Fallen move at half speed and their bullets crawl.' },
    { id: 'stream', name: 'Fiery Stream', src: 'Daniel 7:10', cd: 9, cost: 2500, desc: 'Pour a river of fire where you aim. It burns through foes and bullets alike.' },
    { id: 'eyes', name: 'Rims Full of Eyes', src: 'Ezekiel 1:18', cd: 11, cost: 6000, desc: 'Open every eye at once: twenty-four seeking bolts.' }
  ]
};
const skillDef = (cls, id) => SKILLS[cls].find(s => s.id === id);

/* ---------- level-up relics (reset each descent). `cls` limits a relic to one choir ---------- */
const UPG = [
  { id: 'volley', cls: 'seraph', name: 'Six-Winged Volley', tier: 'legend', w: .7, max: 6, src: 'Isaiah 6:2', desc: 'One more bolt of light in every volley.', apply: S => S.shots++ },
  { id: 'pierce', cls: 'seraph', name: 'Living Coal', tier: 'rare', w: .8, max: 4, src: 'Isaiah 6:6', desc: 'Bolts burn through one more foe.', apply: S => S.pierce++ },
  { id: 'homing', cls: 'seraph', name: 'Divine Awareness', tier: 'rare', w: .7, max: 4, src: 'Deva', desc: 'Bolts bend toward the nearest of the Fallen.', apply: S => S.homing++ },
  { id: 'slay', cls: 'seraph', name: 'Slaying Longbow', tier: 'legend', w: .5, max: 2, src: 'Solar', desc: 'Any hit destroys a lesser foe below 12% life.', apply: S => S.slay += 0.12 },
  { id: 'arc', cls: 'archangel', name: 'Sweep of the Host', tier: 'rare', w: .8, max: 3, src: 'Revelation 12:7', desc: 'Your cleave sweeps 20° wider.', apply: S => S.arc += 20 },
  { id: 'reach', cls: 'archangel', name: 'Long Reach', tier: 'magic', w: .9, max: 4, src: 'Planetar', desc: 'Your blade reaches 14% farther.', apply: S => S.reach *= 1.14 },
  { id: 'crescent', cls: 'archangel', name: 'The Turning Flame', tier: 'legend', w: .7, max: 3, src: 'Genesis 3:24', desc: 'Each swing hurls a blade of flame that cuts through everything.', apply: S => S.waves++ },
  { id: 'iron', cls: 'archangel', name: 'Armor of Light', tier: 'magic', w: .8, max: 5, src: 'Romans 13:12', desc: '+30 armor.', apply: S => S.armor += 30 },
  { id: 'eyes', cls: 'ophan', name: 'Rims Full of Eyes', tier: 'legend', w: .7, max: 4, src: 'Ezekiel 1:18', desc: 'One more wheel joins your orbit.', apply: S => S.orbs++ },
  { id: 'gaze', cls: 'ophan', name: 'Gaze of the Throne', tier: 'rare', w: .8, max: 4, src: 'Ezekiel 10:12', desc: 'Your eyes loose one more seeking bolt.', apply: S => S.shots++ },
  { id: 'rims', cls: 'ophan', name: 'Burning Rims', tier: 'magic', w: .9, max: 5, src: 'Daniel 7:9', desc: 'Wheels strike 30% harder.', apply: S => S.orbDmg *= 1.3 },
  { id: 'litany', name: 'Unceasing Litany', tier: 'rare', w: .8, max: 5, src: 'Revelation 4:8', desc: 'Choir skills return 12% sooner.', apply: S => S.skillCdMul *= .88 },
  { id: 'glory', name: 'Weight of Glory', tier: 'rare', w: .8, max: 5, src: '2 Corinthians 4:17', desc: 'Choir skills strike 20% harder and reach 10% farther.', apply: S => { S.skillPow *= 1.2; S.skillArea *= 1.1; } },
  { id: 'kinship', name: 'Fellow Servant', tier: 'magic', w: .6, max: 4, src: 'Revelation 19:10', desc: 'Your companion strikes 25% harder.', apply: S => S.petPow *= 1.25 },
  { id: 'rate', name: 'Quickened Hymn', tier: 'magic', w: 1, max: 8, src: 'Psalm 104:4', desc: 'Attack 16% faster.', apply: S => S.atkRate *= 1.16 },
  { id: 'dmg', name: 'Angelic Weapons', tier: 'magic', w: 1, max: 10, src: 'Deva', desc: 'All radiant damage rises by 22%.', apply: S => S.dmg *= 1.22 },
  { id: 'speed', name: 'Swift as Lightning', tier: 'magic', w: .9, max: 5, src: 'Ezekiel 1:14', desc: 'Move 9% faster.', apply: S => S.speed *= 1.09 },
  { id: 'vigor', name: 'Healing Touch', tier: 'magic', w: .9, max: 8, src: 'Deva', desc: '+25 maximum life, and you are made whole.', apply: S => S.maxHp += 25 },
  { id: 'orb', name: "Ezekiel's Wheel", tier: 'legend', w: .55, max: 6, src: 'Ezekiel 1:16', desc: 'A burning wheel orbits you, grinding foes and swallowing bullets.', apply: S => S.orbs++ },
  { id: 'veil', name: 'Covered Faces', tier: 'rare', w: .8, max: 5, src: 'Isaiah 6:2', desc: 'Graze from 20% farther away and gain 20% more grace.', apply: S => { S.grazeR *= 1.2; S.graceMul *= 1.2; } },
  { id: 'step', name: 'Fly', tier: 'magic', w: .7, max: 4, src: 'Daniel 9:21', desc: 'Dash returns 18% sooner.', apply: S => S.dashCd *= .82 },
  { id: 'lode', name: "Jacob's Ladder", tier: 'magic', w: .6, max: 4, src: 'Genesis 28:12', desc: 'Souls rise to you from 50% farther.', apply: S => S.magnet *= 1.5 }
];

/* ---------- items (kept forever) ---------- */
const SLOTS = ['weapon', 'helm', 'chest', 'gloves', 'boots', 'amulet', 'ring'];
const SLOT_LABEL = { weapon: 'Weapon', helm: 'Helm', chest: 'Chest', gloves: 'Gloves', boots: 'Boots', amulet: 'Amulet', ring: 'Ring' };
const BASES = { helm: ['Mitre', 'Great Helm', 'Cowl', 'Circlet'], chest: ['Hauberk', 'Vestments', 'Cuirass', 'Ephod'], gloves: ['Gauntlets', 'Wraps', 'Grips'],
  boots: ['Sabatons', 'Sandals', 'Greaves'], amulet: ['Reliquary', 'Rosary', 'Phylactery'], ring: ['Signet', 'Band', 'Seal'] };
const WEAPON_BASES = { seraph: ['Wand', 'Censer', 'Psalter', 'Lyre'], archangel: ['Longsword', 'Flail', 'Glaive', 'Mace'], ophan: ['Orrery', 'Astrolabe', 'Lantern', 'Rim'] };
const AFFIX = {
  dmg:    { u: '% damage', roll: l => 5 + l * 1.6, cap: 90, pre: 'Wrathful' },
  atk:    { u: '% attack speed', roll: l => 4 + l * .7, cap: 40, suf: 'of Haste' },
  life:   { u: ' maximum life', roll: l => 10 + l * 4.5, cap: 400, pre: 'Hale' },
  armor:  { u: ' armor', roll: l => 4 + l * 2.5, cap: 300, pre: 'Warded' },
  move:   { u: '% movement speed', roll: l => 3 + l * .4, cap: 15, suf: 'of the Pilgrim' },
  grace:  { u: '% grace gained', roll: l => 6 + l * 1.2, cap: 50, pre: 'Blessed' },
  graze:  { u: '% graze radius', roll: l => 5 + l, cap: 40, suf: 'of the Veil' },
  magnet: { u: '% pickup radius', roll: l => 12 + l * 2, cap: 80, suf: 'of Gathering' },
  crit:   { u: '% critical chance', roll: l => 2 + l * .35, cap: 20, pre: 'Keen' },
  critDmg:{ u: '% critical damage', roll: l => 10 + l * 3, cap: 120, suf: 'of Ruin' },
  cdr:    { u: '% faster cooldowns', roll: l => 3 + l * .6, cap: 20, suf: 'of Vigil' },
  lok:    { u: ' life per kill', roll: l => 1 + l * .25, cap: 12, pre: 'Leeching' },
  skill:  { u: '% choir skill power', roll: l => 6 + l * 1.4, cap: 80, pre: 'Psalmic' },
  pet:    { u: '% companion damage', roll: l => 8 + l * 2, cap: 120, suf: 'of Fellowship' }
};
const EXTRA = { seraph: { v: 1, u: ' bolt per volley' }, archangel: { v: 20, u: '° cleave arc' }, ophan: { v: 1, u: ' orbiting wheel' } };
const POWERS = {
  echo:     { name: 'Trisagion Choir', text: 'Every graze looses a seeking bolt of light.', src: 'Isaiah 6:3' },
  wings:    { name: "Isaiah's Six Wings", text: 'Dashing releases a ring of twelve holy bolts.', src: 'Isaiah 6:2' },
  patience: { name: 'Throne of Stillness', text: 'Ascension lasts 3 seconds longer.', src: 'Celestial Hierarchy VII' },
  tithe:    { name: 'Coal from the Altar', text: 'Every kill restores 3 life.', src: 'Isaiah 6:6' },
  thorns:   { name: 'Wheels of Ezekiel', text: 'Two extra burning wheels orbit you.', src: 'Ezekiel 1:16' },
  ember:    { name: "Uriel's Flame", text: 'Choir skills return 35% sooner and reach 30% farther.', src: '1 Enoch 20:2' },
  martyr:   { name: "Michael's Vow", text: 'When struck, your first choir skill answers for free.', src: 'Jude 1:9' },
  raziel:   { name: 'Book of Raziel', text: 'Souls from the Fallen are worth 40% more experience.', src: 'Sefer Raziel' },
  raphael:  { name: "Raphael's Remedy", text: 'Your companion heals you for 2% of your life each time it strikes.', src: 'Tobit 12:15' },
  sandals:  { name: 'Sandals of the Messenger', text: 'Dash twice before it needs to return.', src: 'Isaiah 52:7' }
};
const RARE_A = ['Ash', 'Cinder', 'Vesper', 'Dusk', 'Ember', 'Saint', 'Hollow', 'Pyre', 'Thorn', 'Grief', 'Seventh', 'Wormwood'];
const RARE_B = ['Psalm', 'Shroud', 'Ward', 'Vow', 'Hymn', 'Brand', 'Rite', 'Mantle', 'Lament', 'Seal', 'Vigil', 'Censure'];
const TIER_LABEL = { common: 'Common', magic: 'Magic', rare: 'Rare', legend: 'Legendary' };
const RCOL = { common: 0xd9d2c6, magic: 0x6f95ff, rare: 0xffe066, legend: 0xff8a2a };
const SLOT_ICON = {
  seraph: '<path d="M5 19L15 9"/><path d="M17 3l1.2 2.8L21 7l-2.8 1.2L17 11l-1.2-2.8L13 7l2.8-1.2z"/>',
  archangel: '<path d="M19 3l-9.5 9.5M19 3h-3.5M19 3v3.5M7.5 10.5l6 6M6 15l3 3M4 20l3.5-3.5"/>',
  ophan: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.5" ry="8"/><circle cx="12" cy="12" r="1.6"/>',
  helm: '<path d="M5 15v-4a7 7 0 0 1 14 0v4z"/><path d="M5 15h14v3H5zM12 4v4M9 11h6"/>',
  chest: '<path d="M8 4l4 2 4-2 4 3-2 4v9H6v-9L4 7z"/>',
  gloves: '<path d="M7 21v-8l-2-3 2-1 2 2V5a1 1 0 0 1 2 0v5V4a1 1 0 0 1 2 0v6V5a1 1 0 0 1 2 0v6V7a1 1 0 0 1 2 0v8l-2 6z"/>',
  boots: '<path d="M8 3h5v10l6 3v4H6v-4l2-2z"/><path d="M6 17h13"/>',
  amulet: '<path d="M6 3c0 6 3 9 6 10 3-1 6-4 6-10"/><path d="M12 13l3 4-3 4-3-4z"/>',
  ring: '<circle cx="12" cy="14" r="6"/><path d="M10 8l2-4 2 4"/>'
};

/* ---------- companions ---------- */
const PET_MAX = 10;
const PETS = {
  hound: { name: "Tobit's Hound", src: 'Tobit 6:1 · it walked with Raphael', cost: 0, color: '#e9dcc4',
    role: 'Runs down the nearest foe and bites. Between fights it fetches souls and relics back to you.',
    icon: '<svg viewBox="0 0 32 32" fill="none" stroke="#e9dcc4" stroke-width="1.8" stroke-linejoin="round"><path d="M6 20l3-7 5-2 3-5 3 1 1 4 4 1v3l-4 1-1 6h-3l-1-4h-6l-1 4H6z"/><circle cx="20.5" cy="9.5" r=".8" fill="#e9dcc4"/><ellipse cx="18" cy="4.5" rx="3" ry="1" stroke="#ffd27a"/></svg>' },
  dove: { name: "Noah's Dove", src: 'Genesis 8:11', cost: 3000, color: '#ffffff',
    role: 'Circles you swallowing bullets, and every few seconds brings an olive leaf that heals you.',
    icon: '<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"><path d="M4 16c6 0 8-8 16-9-2 3-2 5 0 6l6-2-4 4c0 5-5 9-12 9l-4 3 1-5c-2-1-3-3-3-6z"/><path d="M24 11l3 1" stroke="#ffb060"/><path d="M26 13c2 1 3 3 2 5-2-1-3-3-2-5z" stroke="#7ddc8a"/></svg>' },
  eagle: { name: 'Eagle of Patmos', src: 'Revelation 4:7 · the fourth living creature', cost: 5000, color: '#d8a24a',
    role: 'Wheels high overhead, then dives on the strongest foe nearby for heavy damage.',
    icon: '<svg viewBox="0 0 32 32" fill="none" stroke="#d8a24a" stroke-width="1.8" stroke-linejoin="round"><path d="M2 12c6-1 9 1 12 4l2-3 2 3c3-3 6-5 12-4-4 2-7 5-9 9l-3 1-2 5-2-5-3-1C11 17 6 14 2 12z"/><path d="M16 13l-1-3 2-1 1 2" stroke="#fff"/></svg>' },
  cherub: { name: 'Cherub of the Ark', src: 'Exodus 25:18 · of beaten gold', cost: 8000, color: '#ffd27a',
    role: 'A small golden cherub that hovers at your shoulder and looses seeking arrows of light.',
    icon: '<svg viewBox="0 0 32 32" fill="none" stroke="#ffd27a" stroke-width="1.8" stroke-linejoin="round"><circle cx="16" cy="10" r="3.5"/><path d="M12 16h8l-1 9h-6z"/><path d="M12 16C7 12 4 13 3 9c4 0 7 2 9 5M20 16c5-4 8-3 9-7-4 0-7 2-9 5"/><path d="M22 20c3 0 4 3 3 6M22 26l4-3" stroke="#fff1d0"/></svg>' }
};
const PET_ORDER = ['hound', 'dove', 'eagle', 'cherub'];
const petPower = lvl => 1 + 0.25 * (lvl - 1);
const petUpgradeCost = lvl => Math.round(400 * Math.pow(lvl, 1.7) / 50) * 50;

/* ---------- hero rank (kept forever) ---------- */
const rankNeed = r => Math.round(200 * Math.pow(r, 1.4));
function rankOf(xp) { let r = 0, left = xp; while (left >= rankNeed(r + 1)) { left -= rankNeed(r + 1); r++; } return { rank: r, into: left, need: rankNeed(r + 1) }; }
const RANK_BONUS = { dmg: 0.02, life: 3, armor: 1 };
// Gates: start a descent at Circle I, or one past any Watcher prince you have slain (VI, XI, XVI…)
function gatesFor(h) { const out = [1]; for (let g = 6; g <= h.deepest + 1; g += 5) out.push(g); return out; }

/* ---------- the Fallen, from 1 Enoch ---------- */
const ETYPES = {
  imp:     { name: 'Lesser Fallen', hp: 20,  r: 0.6,  speed: 3.7, contact: 14, xp: 1,  score: 10,   col: 0xff3a2a, drop: .045, hb: 1.75 },
  caster:  { name: 'Grigori Watcher', hp: 42, r: 0.7, speed: 2.8, contact: 12, xp: 2,  score: 25,   col: 0xa070ff, drop: .07, hb: 2.75 },
  spinner: { name: 'Fallen Ophan', hp: 70,  r: 0.85, speed: 1.6, contact: 12, xp: 3,  score: 40,   col: 0xff9a20, drop: .1, hb: 2.4 },
  brute:   { name: 'Nephil',  hp: 150, r: 1.05, speed: 2.1, contact: 24, xp: 5,  score: 60,   col: 0xff5a2e, drop: .25, hb: 3.3 },
  boss:    { name: 'Watcher Prince', hp: 2100, r: 2.2, speed: 2.4, contact: 30, xp: 60, score: 1500, col: 0xff6aa8, drop: 0, hb: 6 }
};
const BOSSES = [
  ['Shemihaza', 'chief of the Watchers'], ['Azazel', 'who taught the forging of blades'], ['Kokabiel', 'reader of the stars'],
  ['Baraqiel', 'of the lightning-signs'], ['Mastema', 'prince of hostility']
];
const PHASES = ['Oath on Hermon', 'The Forbidden Arts', 'The Flood'];
