# Brimstone Halo

A modern isometric, Diablo-like bullet hell / bullet heaven built with [three.js](https://threejs.org/).

You play one of the heavenly choirs descending into the pit to fight the fallen Watchers. Grazing enemy bullets fills a **Grace** globe; when it is full you **Ascend** and the hellfire around you turns to light.

**Play:** open `index.html` in any modern browser. No build step or server is needed; three.js loads from a CDN.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move |
| Mouse | Aim (attacks fire automatically; `F` switches to hold-to-fire) |
| `Shift` (hold) | Focus: move slowly and reveal your hitbox (the white heart) |
| `Space` | Dash |
| `Q` / right click | Choir skill |
| `E` | Ascend when grace is full |
| `I` / `Tab` | Open the reliquary (inventory) |
| `P` / `Esc` | Pause · `M` mute |

On touch screens: drag on the left side to move; attacks auto-aim; skills are on the belt.

## Classes

Drawn from Pseudo-Dionysius' *Celestial Hierarchy*:

- **Seraph** (First Sphere · ranged): volleys of light. Skill: *Trisagion*, a burst that burns away nearby bullets.
- **Archangel** (Third Sphere · melee): sword and shield. Every swing parries the bullets in its arc. Dash is a damaging charge. Skill: *Aegis*, which reflects fire back at the Fallen.
- **Ophan** (First Sphere · Thrones · orbit): wheels within wheels, rims full of eyes (Ezekiel 1). Orbiting wheels grind foes and swallow bullets while seeking eyes hunt. Skill: *Wheel within Wheel*.

Each class has its own level-up relics (e.g. *The Turning Flame*, Genesis 3:24; *Slaying Longbow*, from the D&D Solar).

## Loot and the reliquary

- Enemies drop **Common / Magic / Rare / Legendary** items for seven slots (weapon, helm, chest, gloves, boots, amulet, ring), shown on the ground with light beams and labels.
- Legendaries carry a unique power, such as *Michael's Vow*, *Coal from the Altar*, *Isaiah's Six Wings* or *Book of Raziel*.
- Hovering an item shows a Diablo-style tooltip: the item, what you currently wear in that slot, and the exact change to every stat (damage per second, life, armor, crit, cooldowns, …) if you swap. The character sheet previews the new values too.
- Double-click to equip; salvage unwanted items for souls and experience.

## Enemies

From 1 Enoch: Lesser Fallen, Grigori Watchers, Fallen Ophanim and Nephilim. Every fifth circle is a Watcher prince (Shemihaza, Azazel, Kokabiel, Baraqiel, Mastema) with three phases: *Oath on Hermon*, *The Forbidden Arts*, *The Flood*.

## Lore sources

- Pseudo-Dionysius the Areopagite, *Celestial Hierarchy* (5th–6th c.): the nine choirs and three spheres.
- Biblical and Enochic material: Isaiah 6, Ezekiel 1 and 10, Genesis 3:24, 1 Enoch (the Watchers and the Nephilim).
- D&D celestials (Deva, Planetar, Solar) for game-ready abilities.

## Tech notes

- Single-file prototype: `index.html` holds all HTML, CSS and JavaScript.
- three.js r147 with UnrealBloom post-processing, loaded from jsDelivr.
- Bullets, particles and pickups are drawn with instanced meshes and pooled objects, so thousands of bullets stay smooth.
- Sound effects are synthesized with the Web Audio API; there are no asset files.
