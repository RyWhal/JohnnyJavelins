// Fantasy monster roster, spawn schedule and drawing.
'use strict';

JJ.ENEMIES = {
  bat:      { name: 'Cave Bat',      hp: 6,   speed: 118, r: 9,  dmg: 5,  xp: 1,  color: '#7a4fa8' },
  slime:    { name: 'Slime',         hp: 11,  speed: 52,  r: 12, dmg: 6,  xp: 1,  color: '#5fcf5a' },
  slimelet: { name: 'Slimelet',      hp: 5,   speed: 75,  r: 7,  dmg: 3,  xp: 1,  color: '#8de07f' },
  goblin:   { name: 'Goblin',        hp: 15,  speed: 82,  r: 11, dmg: 7,  xp: 2,  color: '#6aa84f' },
  skeleton: { name: 'Skeleton',      hp: 30,  speed: 64,  r: 12, dmg: 9,  xp: 3,  color: '#e8e2d0' },
  archer:   { name: 'Skeleton Archer', hp: 24, speed: 58, r: 12, dmg: 8,  xp: 4,  color: '#d8d2c0',
              ranged: { every: 2.4, spd: 330, r: 5, dmg: 9, color: '#e8d8a8', kind: 'arrow', keep: [230, 330] } },
  wolf:     { name: 'Dire Wolf',     hp: 24,  speed: 132, r: 13, dmg: 8,  xp: 3,  color: '#6b6f7a' },
  orc:      { name: 'Orc Brute',     hp: 75,  speed: 58,  r: 17, dmg: 14, xp: 6,  color: '#3f7d3a' },
  wraith:   { name: 'Wraith',        hp: 48,  speed: 92,  r: 13, dmg: 12, xp: 5,  color: '#9fd6e8' },
  mage:     { name: 'Dark Cultist',  hp: 42,  speed: 55,  r: 12, dmg: 10, xp: 6,  color: '#5b2a6e',
              ranged: { every: 2.6, spd: 210, r: 7, dmg: 10, color: '#e050ff', keep: [200, 280] } },
  troll:    { name: 'Cave Troll',    hp: 280, speed: 46,  r: 26, dmg: 22, xp: 18, color: '#7f8f6a' },

  // ---- Bosses. `hp` is a floor: real HP also scales with time, the
  // difficulty director and Johnny's measured damage output (`fight` = target
  // seconds to kill). Each pattern fires on its own timer.
  goblinChief: {
    name: 'Skarg the Goblin Warchief', draw: 'goblin', hp: 220, speed: 88, r: 30, dmg: 16, xp: 60, color: '#4f8a35',
    boss: 'mini', fight: 12, shot: 8,
    patterns: [
      { type: 'summon', every: 7, enemy: 'goblin', n: 4 },
      { type: 'charge', every: 4, speed: 420, dur: 0.8, windup: 0.5 },
      { type: 'fan', every: 3, n: 5, spread: 0.2, spd: 230, color: '#c8ff6a' },
    ],
  },
  slimeKing: {
    name: 'The Gelatinous King', draw: 'slime', hp: 420, speed: 55, r: 42, dmg: 16, xp: 80, color: '#3fbf4a',
    boss: 'mini', fight: 16, shot: 11, onDeath: { enemy: 'slime', n: 14 },
    patterns: [
      { type: 'summon', every: 5, enemy: 'slimelet', n: 5 },
      { type: 'ring', every: 3, n: 14, spd: 160, color: '#7fff7a' },
      { type: 'charge', every: 5, speed: 360, dur: 0.6, windup: 0.6 },
    ],
  },
  alphaWolf: {
    name: 'Fenrik, Alpha of the Pack', draw: 'wolf', hp: 700, speed: 125, r: 28, dmg: 18, xp: 100, color: '#4a4e5a',
    boss: 'mini', fight: 16, shot: 12,
    patterns: [
      { type: 'charge', every: 3.2, speed: 480, dur: 0.6, windup: 0.5 },
      { type: 'summon', every: 8, enemy: 'wolf', n: 4 },
      { type: 'ring', every: 5, n: 10, spd: 190, color: '#c8d0ff' },
    ],
  },
  boneColossus: {
    name: 'The Bone Colossus', draw: 'skeleton', hp: 1100, speed: 58, r: 44, dmg: 22, xp: 120, color: '#e8e2d0',
    boss: 'mini', fight: 18, shot: 13,
    patterns: [
      { type: 'ring', every: 2.2, n: 18, spd: 175, color: '#f0ead8' },
      { type: 'summon', every: 6, enemy: 'archer', n: 5 },
      { type: 'spiral', every: 7, dur: 2.2, rate: 16, spd: 200, color: '#f0ead8' },
    ],
  },
  witchQueen: {
    name: 'Hexmother Ysolde', draw: 'mage', hp: 3200, speed: 65, r: 30, dmg: 20, xp: 150, color: '#7a2a8e',
    boss: 'mini', fight: 18, shot: 14, keep: [260, 360],
    patterns: [
      { type: 'spiral', every: 4.5, dur: 2.5, rate: 18, spd: 190, color: '#e050ff', arms: 3 },
      { type: 'fan', every: 2, n: 7, spread: 0.16, spd: 260, color: '#ff70ff' },
      { type: 'teleport', every: 7 },
      { type: 'summon', every: 9, enemy: 'mage', n: 3 },
    ],
  },
  banshee: {
    name: 'The Wailing Banshee', draw: 'wraith', hp: 3600, speed: 100, r: 34, dmg: 22, xp: 160, color: '#bfe8ff',
    boss: 'mini', fight: 18, shot: 14,
    patterns: [
      { type: 'teleport', every: 3.5, then: { type: 'ring', n: 22, spd: 170, color: '#9fe0ff' } },
      { type: 'summon', every: 6, enemy: 'wraith', n: 6 },
      { type: 'fan', every: 2.5, n: 3, spread: 0.3, spd: 300, color: '#d0f4ff' },
    ],
  },
  trollChief: {
    name: 'Gorrum the Troll Chieftain', draw: 'troll', hp: 5000, speed: 58, r: 52, dmg: 28, xp: 200, color: '#6a7a55',
    boss: 'mini', fight: 20, shot: 16, regen: 0.006,
    patterns: [
      { type: 'charge', every: 3.5, speed: 460, dur: 0.9, windup: 0.6, then: { type: 'ring', n: 16, spd: 160, color: '#b9a27a' } },
      { type: 'summon', every: 8, enemy: 'troll', n: 2 },
    ],
  },
  orcWarlord: {
    name: 'Krull the Orc Warlord', draw: 'orc', hp: 5500, speed: 70, r: 46, dmg: 28, xp: 220, color: '#2f6a2c',
    boss: 'mini', fight: 20, shot: 16,
    patterns: [
      { type: 'charge', every: 3, speed: 480, dur: 0.8, windup: 0.5 },
      { type: 'summon', every: 6, enemy: 'orc', n: 6 },
      { type: 'fan', every: 2.2, n: 9, spread: 0.12, spd: 250, color: '#ffb347' },
    ],
  },

  ogre: {
    name: 'Grukk the Ogre Warlord', hp: 4000, speed: 72, r: 46, dmg: 26, xp: 150, color: '#a3743f',
    boss: 'major', fight: 32, shot: 14,
    patterns: [
      { type: 'charge', every: 3.5, speed: 460, dur: 0.9, windup: 0.7, then: { type: 'ring', n: 14, spd: 170, color: '#c8a060' } },
      { type: 'ring', every: 5, n: 18, spd: 150, color: '#c8a060' },
      { type: 'summon', every: 8, enemy: 'goblin', n: 10 },
    ],
  },
  lich: {
    name: 'Mor’Vath the Lich King', hp: 10000, speed: 62, r: 36, dmg: 28, xp: 300, color: '#4b3a6b',
    boss: 'major', fight: 40, shot: 16, keep: [280, 380],
    patterns: [
      { type: 'ring', every: 2, n: 14, spd: 170, color: '#4dffd2' },
      { type: 'spiral', every: 6, dur: 3, rate: 20, spd: 200, color: '#4dffd2', arms: 4 },
      { type: 'summon', every: 6, enemy: 'skeleton', n: 10 },
      { type: 'teleport', every: 9 },
    ],
  },
  dragon: {
    name: 'Ignaroth, Ancient Dragon', hp: 28000, speed: 64, r: 62, dmg: 36, xp: 0, color: '#b8322b',
    boss: 'major', fight: 70, shot: 20,
    patterns: [
      { type: 'fan', every: 2.4, n: 9, spread: 0.12, spd: 270, color: '#ff7a1a' },
      { type: 'ring', every: 6, n: 28, spd: 190, color: '#ff4a1a' },
      { type: 'spiral', every: 9, dur: 3, rate: 24, spd: 220, color: '#ffb02a', arms: 5 },
      { type: 'charge', every: 7, speed: 520, dur: 1.0, windup: 0.8 },
    ],
  },
};

// Spawn weights by minute (multiplied by the current biome's favourites).
JJ.WAVES = [
  { from: 0,    types: { bat: 3, slime: 5 } },
  { from: 1,    types: { bat: 3, slime: 4, goblin: 4 } },
  { from: 2.5,  types: { goblin: 5, skeleton: 3, bat: 2, wolf: 1, archer: 1 } },
  { from: 4,    types: { skeleton: 4, wolf: 3, goblin: 3, orc: 1, archer: 2, mage: 0.6 } },
  { from: 6,    types: { orc: 3, skeleton: 3, wolf: 3, wraith: 2, mage: 1.5, archer: 2 } },
  { from: 8,    types: { orc: 3, wraith: 3, mage: 2, wolf: 3, troll: 0.5, archer: 2.5 } },
  { from: 10.5, types: { wraith: 3, orc: 3, mage: 2.5, troll: 1, skeleton: 3, archer: 3 } },
  { from: 12.5, types: { troll: 1.5, wraith: 3, orc: 3, mage: 3, wolf: 3, archer: 3 } },
];

// Scripted moments: a boss every minute, with hordes in between.
JJ.EVENTS = [
  { t: 45, type: 'swarm', enemy: 'bat', count: 20 },
  { t: 60, type: 'boss', enemy: 'goblinChief' },
  { t: 100, type: 'stampede', enemy: 'wolf', count: 16 },
  { t: 120, type: 'boss', enemy: 'slimeKing' },
  { t: 160, type: 'swarm', enemy: 'goblin', count: 40 },
  { t: 180, type: 'boss', enemy: 'alphaWolf' },
  { t: 220, type: 'swarm', enemy: 'skeleton', count: 36 },
  { t: 240, type: 'boss', enemy: 'boneColossus' },
  { t: 300, type: 'boss', enemy: 'ogre' },
  { t: 340, type: 'stampede', enemy: 'wolf', count: 28 },
  { t: 360, type: 'boss', enemy: 'witchQueen' },
  { t: 400, type: 'swarm', enemy: 'archer', count: 30 },
  { t: 420, type: 'boss', enemy: 'banshee' },
  { t: 460, type: 'swarm', enemy: 'wraith', count: 44 },
  { t: 480, type: 'boss', enemy: 'trollChief' },
  { t: 520, type: 'stampede', enemy: 'wolf', count: 36 },
  { t: 540, type: 'boss', enemy: 'orcWarlord' },
  { t: 600, type: 'boss', enemy: 'lich' },
  { t: 640, type: 'swarm', enemy: 'orc', count: 44 },
  { t: 660, type: 'boss', enemy: 'witchQueen' },
  { t: 700, type: 'stampede', enemy: 'wolf', count: 44 },
  { t: 720, type: 'boss', enemy: 'boneColossus' },
  { t: 760, type: 'swarm', enemy: 'archer', count: 50 },
  { t: 780, type: 'boss', enemy: 'banshee' },
  { t: 820, type: 'swarm', enemy: 'troll', count: 14 },
  { t: 840, type: 'boss', enemy: 'trollChief' },
  { t: 870, type: 'swarm', enemy: 'wraith', count: 60 },
  { t: 900, type: 'boss', enemy: 'dragon' },
];

JJ.WIN_TIME = 900;

JJ.waveAt = (t) => {
  const min = t / 60;
  let w = JJ.WAVES[0];
  for (const wave of JJ.WAVES) if (min >= wave.from) w = wave;
  return w;
};

// ---------------- Drawing ----------------
JJ.drawEnemy = (ctx, e, time, px, py) => {
  const r = e.r;
  const look = Math.atan2(py - e.y, px - e.x);
  const lx = Math.cos(look), ly = Math.sin(look);
  const flash = e.flash > 0;
  const frozen = e.frozenT > 0;
  const kind = e.draw || e.type;
  const body = flash ? '#ffffff' : frozen ? '#bfe9ff' : e.color;

  // shadow
  if (kind !== 'wraith' && kind !== 'bat') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + r * 0.8, r * 0.9, r * 0.35, 0, 0, JJ.TAU);
    ctx.fill();
  }

  if (e.elite) {
    ctx.strokeStyle = `rgba(255,210,60,${0.6 + 0.4 * Math.sin(time * 8)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 5, 0, JJ.TAU);
    ctx.stroke();
  }

  const eyes = (ex, ey, size, color = '#111', white = true) => {
    for (const s of [-1, 1]) {
      const x = e.x + s * ex + lx * r * 0.15;
      const y = e.y + ey + ly * r * 0.1;
      if (white) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, size * 1.6, 0, JJ.TAU);
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + lx * size * 0.5, y + ly * size * 0.5, size, 0, JJ.TAU);
      ctx.fill();
    }
  };

  switch (kind) {
    case 'bat': {
      const flap = Math.sin(time * 22 + e.id) * 0.6;
      ctx.fillStyle = body;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + s * r * 2.2, e.y - r * (0.6 + flap));
        ctx.lineTo(e.x + s * r * 1.5, e.y + r * 0.3);
        ctx.lineTo(e.x + s * r * 0.9, e.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 0.75, 0, JJ.TAU);
      ctx.fill();
      eyes(r * 0.3, -1, 1.6, '#ff3355', false);
      break;
    }
    case 'slime':
    case 'slimelet': {
      const wob = Math.sin(time * 6 + e.id) * 0.08;
      ctx.fillStyle = body;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + r * 0.1, r * (1 + wob), r * (0.85 - wob), 0, 0, JJ.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(e.x - r * 0.35, e.y - r * 0.3, r * 0.22, 0, JJ.TAU);
      ctx.fill();
      eyes(r * 0.3, -1, r * 0.13);
      break;
    }
    case 'goblin': {
      ctx.fillStyle = body;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(e.x + s * r * 0.6, e.y - r * 0.3);
        ctx.lineTo(e.x + s * r * 1.6, e.y - r * 0.8);
        ctx.lineTo(e.x + s * r * 0.7, e.y + r * 0.1);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(e.x - r * 0.8, e.y + r * 0.3, r * 1.6, r * 0.5);
      eyes(r * 0.35, -2, r * 0.14, '#d42');
      break;
    }
    case 'skeleton':
    case 'archer': {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y - r * 0.15, r, 0, JJ.TAU);
      ctx.fill();
      ctx.fillRect(e.x - r * 0.55, e.y + r * 0.5, r * 1.1, r * 0.45);
      ctx.fillStyle = '#222';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x + s * r * 0.38 + lx * 2, e.y - r * 0.2 + ly * 2, r * 0.25, 0, JJ.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ff5533';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x + s * r * 0.38 + lx * 3, e.y - r * 0.2 + ly * 3, r * 0.08, 0, JJ.TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(e.x + i * r * 0.18, e.y + r * 0.5);
        ctx.lineTo(e.x + i * r * 0.18, e.y + r * 0.9);
        ctx.stroke();
      }
      break;
    }
    case 'wolf': {
      const a = e.lungeT > 0 ? e.chargeDir : look;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(a);
      if (e.lungeT > 0) ctx.scale(0.8, 1.2);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, 0, r * 1.25, r * 0.7, 0, 0, JJ.TAU);
      ctx.fill();
      ctx.beginPath(); // tail
      ctx.moveTo(-r * 1.3, 0);
      ctx.lineTo(-r * 2.1, Math.sin(time * 15 + e.id) * r * 0.4);
      ctx.lineTo(-r * 1.2, r * 0.25);
      ctx.fill();
      ctx.beginPath(); // head
      ctx.arc(r * 0.9, 0, r * 0.6, 0, JJ.TAU);
      ctx.fill();
      ctx.beginPath(); // snout
      ctx.moveTo(r * 1.2, -r * 0.3);
      ctx.lineTo(r * 1.9, 0);
      ctx.lineTo(r * 1.2, r * 0.3);
      ctx.fill();
      ctx.beginPath(); // ears
      ctx.moveTo(r * 0.7, -r * 0.4); ctx.lineTo(r * 0.5, -r * 0.95); ctx.lineTo(r * 1.0, -r * 0.5);
      ctx.moveTo(r * 0.7, r * 0.4); ctx.lineTo(r * 0.5, r * 0.95); ctx.lineTo(r * 1.0, r * 0.5);
      ctx.fill();
      ctx.fillStyle = '#ffdd33';
      ctx.beginPath();
      ctx.arc(r * 1.1, -r * 0.22, r * 0.12, 0, JJ.TAU);
      ctx.arc(r * 1.1, r * 0.22, r * 0.12, 0, JJ.TAU);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'orc': {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#5a3b22'; // shoulder pads
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x + s * r * 0.85, e.y + r * 0.1, r * 0.4, 0, JJ.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fff8e0'; // tusks
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(e.x + s * r * 0.3, e.y + r * 0.3);
        ctx.lineTo(e.x + s * r * 0.4, e.y - r * 0.05);
        ctx.lineTo(e.x + s * r * 0.15, e.y + r * 0.3);
        ctx.fill();
      }
      eyes(r * 0.3, -r * 0.3, r * 0.1, '#c00');
      break;
    }
    case 'wraith': {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y - r * 0.2, r, Math.PI, 0);
      const waves = 4;
      for (let i = 0; i <= waves; i++) {
        const x = e.x + r - (i / waves) * 2 * r;
        const y = e.y + r * 0.9 + Math.sin(time * 10 + i * 2 + e.id) * r * 0.25;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#123';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(e.x + s * r * 0.35 + lx * 2, e.y - r * 0.25 + ly * 2, r * 0.15, r * 0.25, 0, 0, JJ.TAU);
        ctx.fill();
      }
      break;
    }
    case 'mage': {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - r * 1.6);
      ctx.lineTo(e.x + r, e.y + r);
      ctx.lineTo(e.x - r, e.y + r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a0d22';
      ctx.beginPath();
      ctx.arc(e.x, e.y - r * 0.1, r * 0.5, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#f0f';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x + s * r * 0.2 + lx * 2, e.y - r * 0.15 + ly * 2, r * 0.09, 0, JJ.TAU);
        ctx.fill();
      }
      // orb
      ctx.fillStyle = `rgba(230,80,255,${0.6 + 0.4 * Math.sin(time * 6)})`;
      ctx.beginPath();
      ctx.arc(e.x + lx * r * 1.1, e.y + ly * r * 1.1, r * 0.3, 0, JJ.TAU);
      ctx.fill();
      break;
    }
    case 'troll': {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#5f6d4c';
      ctx.beginPath();
      ctx.arc(e.x - r * 0.3, e.y + r * 0.3, r * 0.25, 0, JJ.TAU);
      ctx.arc(e.x + r * 0.4, e.y - r * 0.4, r * 0.18, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#8a6a3a'; // club
      ctx.save();
      ctx.translate(e.x + r * 0.9, e.y);
      ctx.rotate(Math.sin(time * 4 + e.id) * 0.5 - 0.5);
      ctx.fillRect(-4, -r * 1.3, 9, r * 1.3);
      ctx.beginPath();
      ctx.arc(0, -r * 1.3, 9, 0, JJ.TAU);
      ctx.fill();
      ctx.restore();
      eyes(r * 0.25, -r * 0.25, r * 0.08, '#000');
      break;
    }
    case 'ogre': {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#6b4a2b'; // belly strap
      ctx.fillRect(e.x - r, e.y + r * 0.2, r * 2, r * 0.25);
      ctx.fillStyle = '#ffd34d'; // crown
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.5, e.y - r * 0.75);
      for (let i = 0; i <= 4; i++) {
        ctx.lineTo(e.x - r * 0.5 + i * r * 0.25, e.y - r * (i % 2 ? 0.8 : 1.15));
      }
      ctx.lineTo(e.x + r * 0.5, e.y - r * 0.6);
      ctx.lineTo(e.x - r * 0.5, e.y - r * 0.6);
      ctx.fill();
      eyes(r * 0.3, -r * 0.3, r * 0.08, '#000');
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x - r * 0.3, e.y + r * 0.05, r * 0.15, r * 0.15);
      ctx.fillRect(e.x + r * 0.15, e.y + r * 0.05, r * 0.15, r * 0.15);
      if (e.chargeT > 0) {
        ctx.strokeStyle = 'rgba(255,80,40,0.8)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 8, 0, JJ.TAU);
        ctx.stroke();
      }
      break;
    }
    case 'lich': {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - r * 1.2);
      ctx.lineTo(e.x + r * 1.1, e.y + r);
      ctx.lineTo(e.x - r * 1.1, e.y + r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8e2d0';
      ctx.beginPath();
      ctx.arc(e.x, e.y - r * 0.35, r * 0.5, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#4dffd2';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(e.x + s * r * 0.2, e.y - r * 0.4, r * 0.1, 0, JJ.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = e.x - r * 0.5 + i * r * 0.25;
        ctx.moveTo(x, e.y - r * 0.75);
        ctx.lineTo(x + r * 0.12, e.y - r * 1.1);
        ctx.lineTo(x + r * 0.24, e.y - r * 0.75);
      }
      ctx.fill();
      ctx.strokeStyle = `rgba(77,255,210,${0.4 + 0.3 * Math.sin(time * 5)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 1.5, 0, JJ.TAU);
      ctx.stroke();
      break;
    }
    case 'dragon': {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(look);
      const flap = Math.sin(time * 4) * 0.3;
      ctx.fillStyle = flash ? '#fff' : '#7a1f1a';
      for (const s of [-1, 1]) { // wings
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-r * 0.6, s * r * (1.9 + flap));
        ctx.lineTo(-r * 1.2, s * r * (1.4 + flap));
        ctx.lineTo(-r * 0.9, s * r * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = body;
      ctx.beginPath(); // body
      ctx.ellipse(-r * 0.2, 0, r, r * 0.6, 0, 0, JJ.TAU);
      ctx.fill();
      ctx.beginPath(); // tail
      ctx.moveTo(-r * 1.0, -r * 0.2);
      ctx.quadraticCurveTo(-r * 2, Math.sin(time * 3) * r * 0.8, -r * 2.4, 0);
      ctx.quadraticCurveTo(-r * 2, Math.sin(time * 3) * r * 0.8 + r * 0.2, -r * 1.0, r * 0.2);
      ctx.fill();
      ctx.beginPath(); // head
      ctx.ellipse(r * 0.95, 0, r * 0.5, r * 0.35, 0, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#f5d76e'; // horns
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(r * 0.8, s * r * 0.2);
        ctx.lineTo(r * 0.45, s * r * 0.6);
        ctx.lineTo(r * 0.9, s * r * 0.3);
        ctx.fill();
      }
      ctx.fillStyle = '#ffee00';
      ctx.beginPath();
      ctx.arc(r * 1.1, -r * 0.15, r * 0.07, 0, JJ.TAU);
      ctx.arc(r * 1.1, r * 0.15, r * 0.07, 0, JJ.TAU);
      ctx.fill();
      ctx.restore();
      break;
    }
    default:
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, JJ.TAU);
      ctx.fill();
  }

  if (e.type === 'archer') {
    // bow
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x + lx * r * 0.9, e.y + ly * r * 0.9, r * 0.8, look - 1.2, look + 1.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.x + lx * r * 0.9 + Math.cos(look - 1.2) * r * 0.8, e.y + ly * r * 0.9 + Math.sin(look - 1.2) * r * 0.8);
    ctx.lineTo(e.x + lx * r * 0.9 + Math.cos(look + 1.2) * r * 0.8, e.y + ly * r * 0.9 + Math.sin(look + 1.2) * r * 0.8);
    ctx.stroke();
  }

  if (e.boss) {
    // Mini-bosses get a crown; everyone gets a menacing aura.
    if (e.boss === 'mini') {
      const cy = e.y - r * 1.05;
      ctx.fillStyle = '#ffd34d';
      ctx.strokeStyle = '#8a5a00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.45, cy + r * 0.25);
      ctx.lineTo(e.x - r * 0.45, cy - r * 0.1);
      ctx.lineTo(e.x - r * 0.22, cy + r * 0.08);
      ctx.lineTo(e.x, cy - r * 0.25);
      ctx.lineTo(e.x + r * 0.22, cy + r * 0.08);
      ctx.lineTo(e.x + r * 0.45, cy - r * 0.1);
      ctx.lineTo(e.x + r * 0.45, cy + r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,60,40,${0.25 + 0.15 * Math.sin(time * 4)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 1.25, 0, JJ.TAU);
    ctx.stroke();
    if (e.windupT > 0) {
      // Telegraph the charge direction.
      ctx.strokeStyle = `rgba(255,40,40,${0.35 + 0.35 * Math.sin(time * 30)})`;
      ctx.lineWidth = r * 0.8;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.chargeDir) * 420, e.y + Math.sin(e.chargeDir) * 420);
      ctx.stroke();
    }
    if (e.invuln) {
      ctx.strokeStyle = 'rgba(140,200,255,0.8)';
      ctx.fillStyle = 'rgba(140,200,255,0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 1.5, 0, JJ.TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (e.burnT > 0) {
    ctx.fillStyle = `rgba(255,${120 + Math.random() * 100},0,0.7)`;
    ctx.beginPath();
    ctx.arc(e.x + JJ.rand(-r, r) * 0.6, e.y - r * 0.8 + JJ.rand(-3, 3), r * 0.25 + 2, 0, JJ.TAU);
    ctx.fill();
  }

  // Health bar for tougher monsters once damaged
  if (!e.boss && e.hp < e.maxHp && (e.maxHp > 60 || e.elite)) {
    const w = r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - r - 10, w, 4);
    ctx.fillStyle = '#e33';
    ctx.fillRect(e.x - w / 2, e.y - r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
  }
};
