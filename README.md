# Brimstone Halo

A modern isometric, Diablo-like bullet hell / bullet heaven built with [three.js](https://threejs.org/).

You play one of the heavenly choirs descending into the pit to fight the fallen Watchers. Grazing enemy bullets fills a **Grace** globe; when it is full you **Ascend** and the hellfire around you turns to light. Relics, souls, choir skills and companions are kept from one descent to the next.

**Play:** https://lseman.github.io/brimstone-halo/

Every push to `main` republishes the site through `.github/workflows/pages.yml`, which copies it to the `gh-pages` branch that GitHub Pages serves. To run it locally, serve the folder with any static server (for example `npx serve .`) and open `index.html`; three.js loads from a CDN and there is no build step.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move |
| Mouse | Aim (attacks fire automatically; `F` switches to hold-to-fire). Wheel zooms |
| `Shift` (hold) | Focus: move slowly and reveal your hitbox (the white heart) |
| `Space` | Dash |
| `Q` / right click, `R` | Your two choir skills |
| `E` | Ascend when grace is full |
| `I` / `Tab` | Open the reliquary |
| `P` / `Esc` | Pause · `M` mute |

On touch screens: drag on the left side to move; attacks auto-aim; dash, skills, Ascend and the reliquary are on the belt.

## Progression

- **Sanctuary.** Choosing a choir opens its sanctuary: the hero stands on the left, the reliquary on the right. From here you manage gear, learn skills, pick a companion and choose which circle to begin at.
- **Kept forever:** equipped relics, the 30-slot bag of each choir, a 50-slot **shared stash** every choir can reach, **souls** (the currency), each choir's **rank**, learned skills, companions and their levels.
- **Reset each descent:** the level-up relics you pick during a run, and your run level.
- **Rank.** Experience also raises the choir's permanent rank: +2% damage, +3 life and +1 armor per rank.
- **Gates.** Slaying a Watcher prince (every fifth circle) opens a gate: later descents may begin at Circle VI, XI, XVI… and the gate grants three relics per five circles skipped.
- **Souls** come from every kill and graze, and from salvaging relics. Spend them on choir skills and on companions.

### Saving

Progress saves itself in the browser (`localStorage`). When the page runs as a Claude artifact with the `db` capability, it is also mirrored to the viewer's private record so it follows them across devices. The title screen's **Save code** panel exports the whole record as a `BH1.` code you can paste into another browser, and can erase all progress.

## Choirs

Drawn from Pseudo-Dionysius' *Celestial Hierarchy*. Each knows four choir skills and carries two; two are known from the start and two are learned with souls.

- **Seraph** (First Sphere · ranged): robed, six wings (two cover the face, two the feet, two to fly), a staff crowned with the living coal. Skills: *Trisagion*, *Flame Strike*, *Six-Winged Gale*, *Divine Word*.
- **Archangel** (Third Sphere · melee): burnished plate, winged great helm, kite shield and a flaming sword. Every swing parries the bullets in its arc; the dash is a damaging charge. Skills: *Aegis*, *Sword of Michael*, *Leap of Judgment*, *Healing Touch*.
- **Ophan** (First Sphere · Thrones · orbit): wheels within wheels, rims full of eyes (Ezekiel 1). Orbiting wheels grind foes and swallow bullets while seeking eyes hunt. Skills: *Wheel within Wheel*, *Stillness of the Throne*, *Fiery Stream*, *Rims Full of Eyes*.

## Companions

One walks with you on every descent, whichever choir you play. They grow stronger with souls, up to level 10.

- **Tobit's Hound** (Tobit 6:1): bites the nearest foe; between fights it fetches souls and relics.
- **Noah's Dove** (Genesis 8:11): circles you swallowing bullets and brings an olive leaf that heals.
- **Eagle of Patmos** (Revelation 4:7): wheels overhead, then dives on the strongest foe.
- **Cherub of the Ark** (Exodus 25:18): a small golden cherub that looses seeking arrows.

## Loot

- Enemies drop **Common / Magic / Rare / Legendary** relics for seven slots, with light beams and labels on the ground. Item level follows the circle.
- Legendaries carry a unique power, such as *Michael's Vow*, *Raphael's Remedy*, *Sandals of the Messenger* or *Book of Raziel*.
- Hovering a relic shows a Diablo-style tooltip: the relic, what you wear in that slot, and the exact change to every stat if you swap. Weapons belong to one choir; the others can only keep them in the stash.

## Enemies

From 1 Enoch: imp-like **Lesser Fallen** with bat wings and tails, black-winged **Grigori Watchers** under broken halos, iron **Fallen Ophanim**, and lava-cracked **Nephilim**. Every fifth circle is a Watcher prince (Shemihaza, Azazel, Kokabiel, Baraqiel, Mastema) in blackened plate with four ragged wings, fought in three phases: *Oath on Hermon*, *The Forbidden Arts*, *The Flood*.

## Lore sources

- Pseudo-Dionysius the Areopagite, *Celestial Hierarchy* (5th–6th c.): the nine choirs and three spheres.
- Biblical and Enochic material: Isaiah 6, Ezekiel 1 and 10, Daniel 7, Genesis 3:24 and 8:11, Exodus 25, Tobit, Revelation 4 and 12, 1 Enoch (the Watchers and the Nephilim).
- D&D celestials (Deva, Planetar, Solar) for game-ready abilities.

## Code

Plain classic scripts that share globals, loaded in order by `index.html`:

| File | Contents |
| --- | --- |
| `js/core.js` | helpers, the save record, cloud sync, save codes, input sanitizing |
| `js/data.js` | choirs, skills, relics, item affixes, legendary powers, companions, ranks, enemies |
| `js/engine.js` | renderer, HDR grade pass, lighting, arena, atmosphere, instanced pools, impact effects |
| `js/models.js` | procedural models: angels, demons, companions; merged-geometry kits and rig helpers |
| `js/game.js` | the hero, stats, items, enemies and their AI, combat, waves, loot, run lifecycle |
| `js/skills.js` | the twelve choir skills |
| `js/pets.js` | companion behaviour |
| `js/ui.js` | HUD, relic choices, reliquary and sanctuary, title, run summary, save code, input |
| `js/audio.js` | synthesized sound effects |
| `js/main.js` | frame loop, visual sync, camera, boot |

Rendering notes: three.js r147 with a half-float MSAA target, UnrealBloom and a custom grade pass (ACES filmic, split toning, chromatic aberration, vignette, grain); soft PCF shadows; image-based lighting from a generated sky. Characters are built from primitives at load time and merged per material with vertex colors, so each one costs a handful of draw calls. Bullets, particles and pickups are instanced and pooled.
