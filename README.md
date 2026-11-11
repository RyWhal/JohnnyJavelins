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

The game is served by a Cloudflare Worker (`src/worker.js`) with static assets from `public/`, on the custom domain `javelins.rjpw.space`. The Worker also serves the leaderboard API, backed by the D1 database `johnny-javelins-leaderboard`:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/leaderboard` | Top 25 runs, total run count and total javelins thrown |
| `POST /api/score` | Submit a run (`time`, `kills`, `javelins`, `level`, `bosses`, `won`); any name sent is ignored |

Submissions are sanity-checked and rate-limited per IP (stored only as a salted hash).

```bash
npx wrangler d1 migrations apply johnny-javelins-leaderboard --remote   # first time / new migrations
npx wrangler deploy
```

For local development with a local D1 copy:

```bash
npx wrangler d1 migrations apply johnny-javelins-leaderboard --local
npx wrangler dev
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

The world is split into seven biomes with blended borders, each with its own pixel-art ground, low props, weather and favourite monsters: Greenhollow Meadow, the Darkwood, Sunscorch Dunes, the Frostlands, Murkmire Bog, the Barrow Fields and the Ashen Wastes. Ground features (dirt, leaf litter, dunes, ice sheets, bog water, stone paths, lava pools) are baked into the ground; props are kept low (rocks, flowers, mushrooms, stumps, cacti, tombstones...) since the camera looks straight down, and the Darkwood suggests its canopy with drifting leaf shadows instead of trees. Day turns to night over a 15-minute run, and the dynamic lighting picks up Johnny's torch, glowing javelins, explosions, lava, lantern mushrooms, candles and embers.

If the game runs slowly, set **Graphics** to **Low** in Options (it also switches automatically if a run is struggling).

## Leaderboard

Every run of 30 seconds or more is submitted to the online leaderboard automatically at game over, and the game-over screen shows where it placed. There's no name entry: every entry on the board is **Johnny**. Ranking puts dragon slayers (🐉) first, then the longest survival, then most kills. The game also counts every javelin Johnny throws (volleys, splits, novas, the Mega-Javelin and javelin rain): each run's count goes on the board, the board shows the total thrown by all Johnnys, and your lifetime total is in the Armory's Hall of Records. Open it from **🏆 Leaderboard** on the main menu or the game-over screen.

The leaderboard only works on the hosted site; opening `index.html` from disk shows a friendly offline message.

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
| `public/js/world.js` | Biomes, Voronoi world layout and cached pixel-art ground chunks |
| `public/js/sprites.js`, `public/js/sprite-index.js` | Sprite atlas loading/drawing and the atlas index |
| `public/assets/` | Sprite atlas and its credits |
| `public/js/enemies.js` | Monster and boss definitions (attack patterns), wave schedule, events and monster drawing |
| `public/js/input.js` | Keyboard, mouse and touch joystick |
| `public/js/game.js` | Simulation: Johnny, javelins, monsters, pickups, leveling |
| `public/js/render.js` | Canvas rendering |
| `public/js/ui.js` | Menus, HUD, level-up, chest, pause and game-over screens |
| `public/js/leaderboard.js` | Leaderboard API client |
| `public/js/main.js` | Boot and main loop |
| `src/worker.js` | Cloudflare Worker: static assets and the leaderboard API |
| `migrations/` | D1 schema |

`wrangler.jsonc` holds the Cloudflare deploy config.

## Art credits

Monster, boss, pickup and prop sprites are hand-picked from [Pixel Art Atlas — 1.4M Synthetic Sprites](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) by Angais, released under **CC0 1.0** (AI-generated 16×16 sprites). The selection is packed into `public/assets/sprites.png`, with the source row of every sprite listed in `public/assets/sprites-credits.txt`; `public/js/sprite-index.js` maps names to atlas cells. Upgrade, Armory, menu and HUD icons come from the same dataset and are drawn as CSS sprites from the atlas. Johnny (and the Johnny designer), javelins, effects and the pixel-art ground are drawn procedurally, and all sound is synthesized.

The UI font is [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (SIL Open Font License 1.1), self-hosted in `public/assets/fonts/` with its license.

To change a sprite, edit its dataset row id in `tools/sprite-picks.json` and rebuild the atlas with `tools/build-atlas.py` (instructions at the top of the script).
