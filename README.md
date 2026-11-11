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
- Bosses arrive at 5:00 (Ogre Warlord), 10:00 (Lich King) and 15:00 (Ancient Dragon). Slay the dragon to win.

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
| `public/js/upgrades.js` | In-run upgrade cards and legendary evolutions |
| `public/js/enemies.js` | Monster stats, wave schedule, scripted events and monster drawing |
| `public/js/input.js` | Keyboard, mouse and touch joystick |
| `public/js/game.js` | Simulation: Johnny, javelins, monsters, pickups, leveling |
| `public/js/render.js` | Canvas rendering |
| `public/js/ui.js` | Menus, HUD, level-up, chest, pause and game-over screens |
| `public/js/main.js` | Boot and main loop |

`wrangler.jsonc` holds the Cloudflare deploy config. All art is drawn procedurally on a canvas, so there are no image or audio assets.
