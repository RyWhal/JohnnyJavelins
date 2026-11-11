// In-run upgrade cards. Stats are recomputed from scratch from the list of
// owned upgrades, so each `apply(s, level)` describes the full effect at that level.
'use strict';

JJ.UPGRADES = [
  // ---- Javelin upgrades ----
  {
    id: 'multishot', name: 'Extra Javelin', icon: '🔱', max: 8, weight: 10, kind: 'javelin',
    desc: (l) => `Throw <b>+1</b> javelin per volley (total +${l}).`,
    apply: (s, l) => { s.count += l; },
  },
  {
    id: 'rapid', name: 'Quick Hands', icon: '🤾', max: 8, weight: 10, kind: 'javelin',
    desc: () => `Throw <b>14%</b> faster.`,
    apply: (s, l) => { s.interval *= Math.pow(0.86, l); },
  },
  {
    id: 'pierce', name: 'Sharpened Tips', icon: '📍', max: 6, weight: 8, kind: 'javelin',
    desc: () => `Javelins skewer <b>+1</b> more monster.`,
    apply: (s, l) => { s.pierce += l; },
  },
  {
    id: 'heavy', name: 'Heavy Shafts', icon: '🏋️', max: 8, weight: 9, kind: 'javelin',
    desc: () => `<b>+25%</b> javelin damage.`,
    apply: (s, l) => { s.dmg *= 1 + 0.25 * l; },
  },
  {
    id: 'velocity', name: 'Aerodynamics', icon: '💨', max: 5, weight: 6, kind: 'javelin',
    desc: () => `Javelins fly <b>18%</b> faster and <b>15%</b> farther.`,
    apply: (s, l) => { s.jspeed *= 1 + 0.18 * l; s.range *= 1 + 0.15 * l; },
  },
  {
    id: 'giant', name: 'Colossal Javelins', icon: '🗿', max: 5, weight: 6, kind: 'javelin',
    desc: () => `Javelins are <b>30%</b> bigger and hit <b>8%</b> harder.`,
    apply: (s, l) => { s.size *= 1 + 0.3 * l; s.dmg *= 1 + 0.08 * l; },
  },
  {
    id: 'ricochet', name: 'Ricochet', icon: '🎱', max: 5, weight: 7, kind: 'javelin',
    desc: () => `Spent javelins bounce to <b>+1</b> more monster.`,
    apply: (s, l) => { s.bounce += l; },
  },
  {
    id: 'split', name: 'Splitting Shafts', icon: '✂️', max: 4, weight: 6, kind: 'javelin', locked: true,
    desc: (l) => `On first hit, javelins split into <b>${l + 1}</b> smaller javelins.`,
    apply: (s, l) => { s.split = l + 1; },
  },
  {
    id: 'explode', name: 'Boom Tips', icon: '💥', max: 5, weight: 7, kind: 'javelin',
    desc: (l) => `Hits explode (radius ${35 + 12 * l}, ${Math.round((0.4 + 0.15 * l) * 100)}% damage).`,
    apply: (s, l) => { s.explode = 35 + 12 * l; s.explodeDmg = 0.4 + 0.15 * l; },
  },
  {
    id: 'fire', name: 'Flaming Javelins', icon: '🔥', max: 5, weight: 6, kind: 'javelin',
    desc: (l) => l >= 5
      ? `Burn deals <b>${Math.round((0.3 + 0.2 * l) * 100)}%</b> dmg/sec. <b>Burning monsters spread fire on death!</b>`
      : `Hits ignite monsters for <b>${Math.round((0.3 + 0.2 * l) * 100)}%</b> damage per second.`,
    apply: (s, l) => { s.burn = 0.3 + 0.2 * l; s.burnSpread = l >= 5; },
  },
  {
    id: 'lightning', name: 'Storm Javelins', icon: '🌩️', max: 5, weight: 6, kind: 'javelin', locked: true,
    desc: (l) => `${30 + 10 * l}% chance on hit to chain lightning to <b>${l + 2}</b> monsters.`,
    apply: (s, l) => { s.chainChance = 0.3 + 0.1 * l; s.chain = l + 2; s.chainDmg = 0.5 + 0.1 * l; },
  },
  {
    id: 'frost', name: 'Frostbite', icon: '❄️', max: 4, weight: 5, kind: 'javelin',
    desc: (l) => `Hits slow monsters by ${Math.round((0.2 + 0.08 * l) * 100)}% with a ${4 * l}% chance to freeze.`,
    apply: (s, l) => { s.slow = 0.2 + 0.08 * l; s.freeze = 0.04 * l; },
  },
  {
    id: 'homing', name: 'Seeker Spirits', icon: '🎯', max: 4, weight: 6, kind: 'javelin',
    desc: () => `Javelins curve toward monsters (more steering).`,
    apply: (s, l) => { s.homing = l; },
  },
  {
    id: 'boomerang', name: 'Boomerjav', icon: '🪃', max: 3, weight: 5, kind: 'javelin', locked: true,
    desc: (l) => l === 1 ? `Javelins fly back to Johnny, hitting everything again.` : `Returning javelins deal <b>+30%</b> damage.`,
    apply: (s, l) => { s.boomerang = l; },
  },
  {
    id: 'backthrow', name: 'Rear Guard', icon: '🔄', max: 3, weight: 6, kind: 'javelin',
    desc: (l) => ['', 'Also throw a volley <b>backwards</b>.', 'Throw volleys in <b>4 directions</b>.', 'Throw volleys in <b>8 directions</b>.'][l],
    apply: (s, l) => { s.dirs = [1, 2, 4, 8][l]; },
  },
  {
    id: 'orbit', name: 'Javelin Halo', icon: '🪐', max: 5, weight: 6, kind: 'javelin', locked: true,
    desc: (l) => `<b>${[0, 2, 3, 4, 5, 7][l]}</b> javelins orbit Johnny, shredding anything close.`,
    apply: (s, l) => { s.orbit = [0, 2, 3, 4, 5, 7][l]; },
  },
  {
    id: 'rain', name: 'Javelin Storm', icon: '🌧️', max: 5, weight: 6, kind: 'javelin', locked: true,
    desc: (l) => `Every 2.2s, <b>${2 + 2 * l}</b> javelins rain from the sky.`,
    apply: (s, l) => { s.rain = 2 + 2 * l; },
  },
  {
    id: 'nova', name: 'Javelin Nova', icon: '✴️', max: 5, weight: 5, kind: 'javelin', locked: true,
    desc: (l) => `Every ${(4 - 0.4 * l).toFixed(1)}s, burst <b>${8 + 4 * l}</b> javelins in every direction.`,
    apply: (s, l) => { s.nova = 8 + 4 * l; s.novaInterval = 4 - 0.4 * l; },
  },
  {
    id: 'crit', name: 'Critical Points', icon: '🎲', max: 5, weight: 6, kind: 'javelin',
    desc: () => `<b>+7%</b> crit chance, <b>+25%</b> crit damage.`,
    apply: (s, l) => { s.crit += 0.07 * l; s.critMult += 0.25 * l; },
  },

  // ---- Johnny upgrades ----
  {
    id: 'vitality', name: 'Hearty Meal', icon: '🍗', max: 5, weight: 5, kind: 'johnny',
    desc: () => `<b>+25</b> max HP and heal 25.`,
    apply: (s, l) => { s.maxHp += 25 * l; },
    onTake: (g) => g.heal(25),
  },
  {
    id: 'swift', name: 'Sandals of Swiftness', icon: '👟', max: 5, weight: 5, kind: 'johnny',
    desc: () => `<b>+8%</b> movement speed.`,
    apply: (s, l) => { s.speed *= 1 + 0.08 * l; },
  },
  {
    id: 'magnet', name: 'Lodestone', icon: '🧲', max: 4, weight: 5, kind: 'johnny',
    desc: () => `<b>+35%</b> pickup range.`,
    apply: (s, l) => { s.pickup *= 1 + 0.35 * l; },
  },
  {
    id: 'regen', name: 'Troll Blood', icon: '🌿', max: 5, weight: 4, kind: 'johnny',
    desc: () => `Regenerate <b>+0.6</b> HP per second.`,
    apply: (s, l) => { s.regen += 0.6 * l; },
  },
  {
    id: 'armor', name: 'Bronze Breastplate', icon: '🛡️', max: 5, weight: 4, kind: 'johnny',
    desc: () => `Take <b>1</b> less damage from every hit.`,
    apply: (s, l) => { s.armor += l; },
  },
  {
    id: 'greed', name: 'Lucky Coin', icon: '💰', max: 4, weight: 3, kind: 'johnny',
    desc: () => `<b>+20%</b> gold gained.`,
    apply: (s, l) => { s.goldMult += 0.2 * l; },
  },
  {
    id: 'wisdom', name: 'Ancient Tome', icon: '📜', max: 5, weight: 4, kind: 'johnny',
    desc: () => `<b>+12%</b> XP gained.`,
    apply: (s, l) => { s.xpMult += 0.12 * l; },
  },

  // ---- Legendary evolutions (unlock when prerequisites are met) ----
  {
    id: 'thousand', name: 'Thousand Spears', icon: '☄️', max: 1, weight: 40, kind: 'legendary',
    requires: { multishot: 6, rapid: 4 },
    desc: () => `<b>DOUBLE</b> the javelins in every volley. Yes, all of them.`,
    apply: (s) => { s.thousand = true; },
  },
  {
    id: 'singularity', name: 'Javelin Singularity', icon: '🕳️', max: 1, weight: 40, kind: 'legendary',
    requires: { explode: 4, homing: 2 },
    desc: () => `Explosions leave <b>black holes</b> that drag monsters in and crush them.`,
    apply: (s) => { s.singularity = true; },
  },
  {
    id: 'zeus', name: "Zeus's Arsenal", icon: '⚡', max: 1, weight: 40, kind: 'legendary',
    requires: { lightning: 3, rain: 3 },
    desc: () => `Rain doubles and every falling javelin is a <b>lightning bolt</b>.`,
    apply: (s) => { s.zeus = true; },
  },
  {
    id: 'recursion', name: 'Infinite Recursion', icon: '♾️', max: 1, weight: 40, kind: 'legendary',
    requires: { split: 3, ricochet: 2 },
    desc: () => `Split javelins <b>split again</b>. And again.`,
    apply: (s) => { s.splitDepth = 3; },
  },
  {
    id: 'mega', name: 'The Mega-Javelin', icon: '🚀', max: 1, weight: 40, kind: 'legendary',
    requires: { giant: 4, heavy: 5 },
    desc: () => `Every 4th volley adds a <b>titanic javelin</b>: 4x size, 10x damage, infinite pierce.`,
    apply: (s) => { s.mega = true; },
  },
  {
    id: 'destiny', name: 'Spear of Destiny', icon: '🌠', max: 1, weight: 40, kind: 'legendary',
    requires: { pierce: 5, velocity: 3 },
    desc: () => `Javelins pierce <b>infinitely</b> and fly twice as far.`,
    apply: (s) => { s.pierce = Infinity; s.range *= 2; },
  },
  {
    id: 'hellfire', name: 'Hellfire Payload', icon: '🌋', max: 1, weight: 40, kind: 'legendary',
    requires: { fire: 4, explode: 3 },
    desc: () => `Explosions ignite everything and hit <b>twice as hard</b>.`,
    apply: (s) => { s.hellfire = true; s.explodeDmg *= 2; },
  },
];

JJ.UPGRADES_BY_ID = {};
for (const u of JJ.UPGRADES) JJ.UPGRADES_BY_ID[u.id] = u;
