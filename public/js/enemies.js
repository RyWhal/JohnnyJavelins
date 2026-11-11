// Fantasy monster roster, spawn schedule and drawing.
'use strict';

JJ.ENEMIES = {
  bat:      { name: 'Cave Bat',     hp: 6,    speed: 118, r: 9,  dmg: 5,  xp: 1,  color: '#7a4fa8' },
  slime:    { name: 'Slime',        hp: 11,   speed: 52,  r: 12, dmg: 6,  xp: 1,  color: '#5fcf5a' },
  slimelet: { name: 'Slimelet',     hp: 5,    speed: 75,  r: 7,  dmg: 3,  xp: 1,  color: '#8de07f' },
  goblin:   { name: 'Goblin',       hp: 15,   speed: 82,  r: 11, dmg: 7,  xp: 2,  color: '#6aa84f' },
  skeleton: { name: 'Skeleton',     hp: 30,   speed: 64,  r: 12, dmg: 9,  xp: 3,  color: '#e8e2d0' },
  wolf:     { name: 'Dire Wolf',    hp: 24,   speed: 132, r: 13, dmg: 8,  xp: 3,  color: '#6b6f7a' },
  orc:      { name: 'Orc Brute',    hp: 75,   speed: 58,  r: 17, dmg: 14, xp: 6,  color: '#3f7d3a' },
  wraith:   { name: 'Wraith',       hp: 48,   speed: 92,  r: 13, dmg: 12, xp: 5,  color: '#9fd6e8' },
  mage:     { name: 'Dark Cultist', hp: 42,   speed: 55,  r: 12, dmg: 10, xp: 6,  color: '#5b2a6e', ranged: true },
  troll:    { name: 'Cave Troll',   hp: 280,  speed: 46,  r: 26, dmg: 22, xp: 18, color: '#7f8f6a' },
  // Bosses
  ogre:     { name: 'Grukk the Ogre Warlord', hp: 3500,  speed: 70, r: 42, dmg: 25, xp: 150, color: '#a3743f', boss: true },
  lich:     { name: 'Mor’Vath the Lich King', hp: 9000,  speed: 60, r: 34, dmg: 25, xp: 300, color: '#4b3a6b', boss: true },
  dragon:   { name: 'Ignaroth, Ancient Dragon', hp: 26000, speed: 62, r: 60, dmg: 35, xp: 0,   color: '#b8322b', boss: true },
};

// Spawn weights by minute.
JJ.WAVES = [
  { from: 0,    types: { bat: 3, slime: 5 } },
  { from: 1,    types: { bat: 3, slime: 4, goblin: 4 } },
  { from: 2.5,  types: { goblin: 5, skeleton: 3, bat: 2, wolf: 1 } },
  { from: 4,    types: { skeleton: 4, wolf: 3, goblin: 3, orc: 1 } },
  { from: 6,    types: { orc: 3, skeleton: 3, wolf: 3, wraith: 2, mage: 1 } },
  { from: 8,    types: { orc: 3, wraith: 3, mage: 2, wolf: 3, troll: 0.4 } },
  { from: 10.5, types: { wraith: 3, orc: 3, mage: 2, troll: 1, skeleton: 3 } },
  { from: 12.5, types: { troll: 1.5, wraith: 3, orc: 3, mage: 3, wolf: 3 } },
];

// Scripted moments: seconds -> event.
JJ.EVENTS = [
  { t: 75, type: 'swarm', enemy: 'bat', count: 36 },
  { t: 150, type: 'stampede', enemy: 'wolf', count: 18 },
  { t: 225, type: 'swarm', enemy: 'goblin', count: 40 },
  { t: 300, type: 'boss', enemy: 'ogre' },
  { t: 380, type: 'stampede', enemy: 'wolf', count: 28 },
  { t: 450, type: 'swarm', enemy: 'skeleton', count: 50 },
  { t: 530, type: 'swarm', enemy: 'wraith', count: 40 },
  { t: 600, type: 'boss', enemy: 'lich' },
  { t: 680, type: 'stampede', enemy: 'wolf', count: 40 },
  { t: 750, type: 'swarm', enemy: 'orc', count: 50 },
  { t: 830, type: 'swarm', enemy: 'troll', count: 14 },
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
  const body = flash ? '#ffffff' : frozen ? '#bfe9ff' : e.color;

  // shadow
  if (e.type !== 'wraith' && e.type !== 'bat') {
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

  switch (e.type) {
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
    case 'skeleton': {
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
      const a = look;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(a);
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
      if (e.charging > 0) {
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
