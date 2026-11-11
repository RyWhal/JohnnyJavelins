# Johnny Javelins

A top-down, browser-based survival roguelite. Johnny is surrounded by endless hordes of fantasy monsters, and his only weapon is an unlimited supply of javelins. Level up, stack absurd javelin upgrades, unlock legendary evolutions, and survive 15 minutes to face the Ancient Dragon.

## Play

Live at **https://javelins.rjpw.space**.

No build step and no dependencies. Open `public/index.html` in a modern browser, or serve the folder:

```bash
python3 -m http.server 8000 --directory public
```

Then visit http://localhost:8000.

## Deploy

The site is served as a Cloudflare Worker with static assets (`wrangler.jsonc`), on the custom domain `javelins.rjpw.space`:

```bash
npx wrangler deploy
```

## Controls

| Action | Keys |
| --- | --- |
| Move | `WASD` / arrow keys, or drag on a touch screen |
| Throw | Automatic: Johnny targets the nearest monster. Switch to mouse aim in **Options**. |
| Pause | `Esc` / `P` |
| Pick upgrade | Click, or `1`–`4` |
| Reroll choices | `R` |

## How a run works

- Monsters drop **XP gems**. Each level up lets you choose one of three upgrades (four with *Insight*).
- **Javelin upgrades** stack: extra javelins, piercing, ricochets, splitting shafts, explosive tips, fire, frost, chain lightning, homing, boomerang returns, 8-way volleys, orbiting halos, javelin rain, and javelin novas.
- **Legendary evolutions** appear once you've invested in the right pair of upgrades. Examples: *Thousand Spears* doubles every volley, *Javelin Singularity* turns explosions into black holes, and *Infinite Recursion* makes split javelins split again. Hints are in the Armory's Hall of Records.
- **Elite** monsters (gold glow) and **bosses** drop treasure chests with free upgrades. Chests favour legendaries.
- **A boss every minute.** Crowned mini-bosses (Goblin Warchief, Gelatinous King, Alpha Wolf, Bone Colossus, Hexmother, Banshee, Troll Chieftain, Orc Warlord) fill the gaps between the big three: the Ogre Warlord (5:00), the Lich King (10:00) and the Ancient Dragon (15:00). Slay the dragon to win. Bosses are shielded until they're on screen, telegraph their charges, and enrage below half health.
- **Adaptive difficulty.** A director watches how easily you're clearing the horde and toughens monsters when you're cruising. Boss health is sized from the damage you've actually been dealing to bosses, so fights stay meaningful however broken your build gets.

## The world

The world is split into seven biomes with blended borders, each with its own ground, props, weather and favourite monsters: Greenhollow Meadow, the Darkwood, Sunscorch Dunes, the Frostlands, Murkmire Bog, the Barrow Fields and the Ashen Wastes. Day turns to night over a 15-minute run, and the dynamic lighting picks up Johnny's torch, glowing javelins, explosions, lava, mushrooms and will-o'-wisps.

If the game runs slowly, set **Graphics** to **Low** in Options (it also switches automatically if a run is struggling).

## Design your Johnny

**🎨 Customize Johnny** on the main menu lets you pick a name, skin, hairstyle and colour, headgear, facial features, tunic, trousers, cape, and your javelins' shaft and fletching. Your choices are saved and used in every run.

## Roguelite progression

You keep all gold you collect, plus a survival bonus, even when Johnny dies. Spend it in **The Armory**:

- **Training**: permanent stat ranks (HP, damage, throw rate, speed, XP, gold, rerolls, armor, an extra starting javelin, a Phoenix Feather revive, and more). You can refund ranks at any time.
- **Javelin Techniques**: unlock new upgrade cards (Splitting Shafts, Boomerjav, Storm Javelins, Javelin Halo, Javelin Storm, Javelin Nova) so they can appear during runs.

Progress is saved in your browser's `localStorage`.

## Code layout

| File | Purpose |
| --- | --- |
| `public/index.html`, `public/css/style.css` | Page shell, HUD and menu styling |
| `public/js/util.js` | Helpers and the spatial grid used for collisions |
| `public/js/audio.js` | Procedural WebAudio sound effects |
| `public/js/save.js` | Persistent gold, Armory items, unlocks and records |
| `public/js/johnny.js` | Johnny customization options and Johnny/javelin drawing |
| `public/js/upgrades.js` | In-run upgrade cards and legendary evolutions |
| `public/js/world.js` | Biomes, Voronoi world layout and cached ground-chunk painting |
| `public/js/enemies.js` | Monster and boss definitions (attack patterns), wave schedule, events and monster drawing |
| `public/js/input.js` | Keyboard, mouse and touch joystick |
| `public/js/game.js` | Simulation: Johnny, javelins, monsters, pickups, leveling |
| `public/js/render.js` | Canvas rendering |
| `public/js/ui.js` | Menus, HUD, level-up, chest, pause and game-over screens |
| `public/js/main.js` | Boot and main loop |

`wrangler.jsonc` holds the Cloudflare deploy config. All art is drawn procedurally on a canvas, so there are no image or audio assets.
