// Johnny's look: customization options and the shared drawing code used by
// both the game and the Johnny designer preview.
'use strict';

JJ.LOOK = {
  skin: ['#f6d7b8', '#f2c79a', '#d9a57a', '#b97d52', '#8d5a36', '#5e3a22', '#9fd88a', '#a9c8ff'],
  hairColor: ['#6b3d1a', '#2a1a10', '#d9a441', '#b8452a', '#e8e4dc', '#6b6b6b', '#3d6bd6', '#d64fa8', '#4fd67a'],
  hair: [
    { id: 'short', name: 'Short' },
    { id: 'spiky', name: 'Spiky' },
    { id: 'long', name: 'Long' },
    { id: 'mohawk', name: 'Mohawk' },
    { id: 'ponytail', name: 'Ponytail' },
    { id: 'bald', name: 'Bald' },
  ],
  hat: [
    { id: 'headband', name: 'Headband' },
    { id: 'none', name: 'None' },
    { id: 'helm', name: 'Bronze Helm' },
    { id: 'hood', name: 'Hood' },
    { id: 'crown', name: 'Crown' },
    { id: 'wizard', name: 'Wizard Hat' },
    { id: 'horns', name: 'Horned Helm' },
  ],
  hatColor: ['#d6322b', '#2f7fc1', '#3a9a4a', '#f2c230', '#8a3ad6', '#222222', '#f0f0f0', '#ff7ab8'],
  face: [
    { id: 'none', name: 'Clean' },
    { id: 'beard', name: 'Beard' },
    { id: 'mustache', name: 'Mustache' },
    { id: 'eyepatch', name: 'Eyepatch' },
    { id: 'shades', name: 'Shades' },
    { id: 'warpaint', name: 'War Paint' },
  ],
  tunic: ['#2f7fc1', '#c13a2f', '#3a9a4a', '#7a4fa8', '#e0a82a', '#333a44', '#e8e4dc', '#e06a1a'],
  pants: ['#5b3a1e', '#2a2a2a', '#3a4a6a', '#6b6b6b', '#7a2a2a', '#3a5a2a'],
  cape: ['none', '#b8322b', '#2f4fa8', '#2a2a2a', '#e0a82a', '#6a2a8a', '#2a8a5a'],
  shaft: [
    { id: '#c9a066', name: 'Ash' },
    { id: '#7a4a24', name: 'Oak' },
    { id: '#e8e2d0', name: 'Bone' },
    { id: '#ffcf3f', name: 'Gold' },
    { id: '#3a3a44', name: 'Obsidian' },
  ],
  fletch: ['#d6322b', '#2f7fc1', '#3a9a4a', '#f2c230', '#e8e4dc', '#8a3ad6', '#ff7ab8', '#222222'],
};

JJ.defaultLook = () => ({
  name: 'Johnny',
  skin: '#f2c79a',
  hairColor: '#6b3d1a',
  hair: 'short',
  hat: 'headband',
  hatColor: '#d6322b',
  face: 'none',
  tunic: '#2f7fc1',
  pants: '#5b3a1e',
  cape: 'none',
  shaft: '#c9a066',
  fletch: '#d6322b',
});

JJ.randomLook = () => {
  const L = JJ.LOOK;
  const pick = (a) => {
    const v = JJ.choice(a);
    return typeof v === 'object' ? v.id : v;
  };
  return {
    name: JJ.Save ? JJ.Save.data.johnny.name : 'Johnny',
    skin: pick(L.skin), hairColor: pick(L.hairColor), hair: pick(L.hair), hat: pick(L.hat),
    hatColor: pick(L.hatColor), face: pick(L.face), tunic: pick(L.tunic), pants: pick(L.pants),
    cape: pick(L.cape), shaft: pick(L.shaft), fletch: pick(L.fletch),
  };
};

// Draw a javelin centred at x,y pointing along `ang`.
JJ.drawJavelin = (ctx, x, y, ang, size, tip, trail, mega, look) => {
  const len = 30 * size;
  const c = Math.cos(ang), s = Math.sin(ang);
  const tx = x + c * len * 0.5, ty = y + s * len * 0.5; // tip
  const bx = x - c * len * 0.5, by = y - s * len * 0.5; // butt
  if (trail) {
    ctx.strokeStyle = mega ? 'rgba(255,220,90,0.35)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3 * size;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - c * len * 0.7, by - s * len * 0.7);
    ctx.stroke();
  }
  ctx.strokeStyle = mega ? '#ffcf3f' : look.shaft;
  ctx.lineWidth = 2.6 * size;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(tx - c * 6 * size, ty - s * 6 * size);
  ctx.stroke();
  const px = -s, py = c;
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.moveTo(tx + c * 3 * size, ty + s * 3 * size);
  ctx.lineTo(tx - c * 7 * size + px * 3.5 * size, ty - s * 7 * size + py * 3.5 * size);
  ctx.lineTo(tx - c * 7 * size - px * 3.5 * size, ty - s * 7 * size - py * 3.5 * size);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mega ? '#ff4a2a' : look.fletch;
  ctx.beginPath();
  ctx.moveTo(bx + c * 7 * size, by + s * 7 * size);
  ctx.lineTo(bx + px * 4 * size, by + py * 4 * size);
  ctx.lineTo(bx - px * 4 * size, by - py * 4 * size);
  ctx.closePath();
  ctx.fill();
};

// Draw Johnny (without the held javelin) at x,y.
// st: { face, walk, moving, time }
JJ.drawJohnny = (ctx, look, x, y, st) => {
  const TAU = JJ.TAU;
  const faceRight = Math.cos(st.face) >= 0;
  const dir = faceRight ? 1 : -1;
  const bob = st.moving ? Math.sin(st.walk) * 1.5 : 0;
  const time = st.time;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 12, 5, 0, 0, TAU);
  ctx.fill();

  // cape (behind)
  if (look.cape !== 'none') {
    const sway = Math.sin(time * 6) * 2 + (st.moving ? 3 : 0);
    ctx.fillStyle = look.cape;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 6 + bob);
    ctx.lineTo(x + 8, y - 6 + bob);
    ctx.lineTo(x + 10 - dir * sway, y + 13);
    ctx.lineTo(x - 10 - dir * sway, y + 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x - 10 - dir * sway, y + 10, 20, 3);
  }

  // legs
  ctx.fillStyle = look.pants;
  const leg = st.moving ? Math.sin(st.walk) * 4 : 0;
  ctx.fillRect(x - 6, y + 4 + leg * 0.5, 4, 10 - leg * 0.5);
  ctx.fillRect(x + 2, y + 4 - leg * 0.5, 4, 10 + leg * 0.5);

  // tunic
  ctx.fillStyle = look.tunic;
  ctx.beginPath();
  ctx.ellipse(x, y + bob, 10, 11, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(x - 3, y - 3 + bob, 4, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x - 10, y + 3 + bob, 20, 3);
  ctx.fillStyle = '#e0c060';
  ctx.fillRect(x - 2, y + 3 + bob, 4, 3);

  const hy = y - 13 + bob;

  // hair behind the head
  ctx.fillStyle = look.hairColor;
  if (look.hair === 'long') {
    ctx.fillRect(x - 8, hy - 2, 16, 13);
  } else if (look.hair === 'ponytail') {
    const sw = Math.sin(time * 8) * 2;
    ctx.beginPath();
    ctx.ellipse(x - dir * 9, hy + 4 + sw * 0.3, 3.5, 7, -dir * 0.4, 0, TAU);
    ctx.fill();
  }

  // head
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(x, hy, 8, 0, TAU);
  ctx.fill();

  // hair on top
  ctx.fillStyle = look.hairColor;
  switch (look.hair) {
    case 'short':
    case 'long':
    case 'ponytail':
      ctx.beginPath();
      ctx.arc(x, hy - 2, 8, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      break;
    case 'spiky':
      ctx.beginPath();
      ctx.moveTo(x - 8, hy - 2);
      for (let i = 0; i <= 5; i++) {
        ctx.lineTo(x - 8 + i * 3.2, hy - 6 - (i % 2 ? 0 : 6));
      }
      ctx.lineTo(x + 8, hy - 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'mohawk':
      ctx.fillRect(x - 2, hy - 15, 4, 10);
      ctx.beginPath();
      ctx.arc(x, hy - 14, 2.5, 0, TAU);
      ctx.fill();
      break;
  }

  // face accessories under the hat
  const ex = Math.cos(st.face) * 3;
  const ey = Math.sin(st.face) * 1.5;
  ctx.fillStyle = '#222';
  if (look.face === 'shades') {
    ctx.fillRect(x - 5 + ex, hy - 1.5 + ey, 10, 3);
  } else {
    ctx.fillRect(x - 3.5 + ex, hy - 1 + ey, 2, 2.5);
    if (look.face !== 'eyepatch') ctx.fillRect(x + 1.5 + ex, hy - 1 + ey, 2, 2.5);
  }
  if (look.face === 'eyepatch') {
    ctx.fillRect(x + 0.5 + ex, hy - 2 + ey, 4, 4);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 7, hy - 4);
    ctx.lineTo(x + 7, hy + 1);
    ctx.stroke();
  } else if (look.face === 'beard') {
    ctx.fillStyle = look.hairColor;
    ctx.beginPath();
    ctx.arc(x + ex * 0.5, hy + 3, 6.5, 0.1, Math.PI - 0.1);
    ctx.fill();
  } else if (look.face === 'mustache') {
    ctx.fillStyle = look.hairColor;
    ctx.fillRect(x - 4 + ex, hy + 2 + ey, 8, 2);
  } else if (look.face === 'warpaint') {
    ctx.fillStyle = 'rgba(200,30,30,0.8)';
    ctx.fillRect(x - 6 + ex, hy + 1.5 + ey, 4, 1.5);
    ctx.fillRect(x + 2 + ex, hy + 1.5 + ey, 4, 1.5);
  }

  // headgear
  const hc = look.hatColor;
  switch (look.hat) {
    case 'headband': {
      ctx.fillStyle = hc;
      ctx.fillRect(x - 8, hy - 4, 16, 3);
      const tailX = x - dir * 8;
      const sway = Math.sin(time * 10) * 2;
      ctx.beginPath();
      ctx.moveTo(tailX, hy - 4);
      ctx.lineTo(tailX - dir * 9, hy - 1 + sway);
      ctx.lineTo(tailX - dir * 8, hy + 2 + sway);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'helm':
    case 'horns':
      ctx.fillStyle = look.hat === 'helm' ? '#c08a3a' : '#9aa0a8';
      ctx.beginPath();
      ctx.arc(x, hy - 1, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 9, hy - 2, 18, 2.5);
      if (look.hat === 'helm') {
        ctx.fillStyle = hc; // plume
        ctx.beginPath();
        ctx.ellipse(x - dir * 2, hy - 12, 8, 3, -dir * 0.3, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f0ead8';
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + sd * 7, hy - 5);
          ctx.quadraticCurveTo(x + sd * 15, hy - 8, x + sd * 13, hy - 17);
          ctx.lineTo(x + sd * 9, hy - 7);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    case 'hood':
      ctx.fillStyle = hc;
      ctx.beginPath();
      ctx.arc(x, hy - 1, 10, Math.PI * 0.9, Math.PI * 2.1);
      ctx.lineTo(x + 10, hy + 6);
      ctx.lineTo(x + 7, hy + 6);
      ctx.lineTo(x + 7, hy - 1);
      ctx.arc(x, hy - 1, 7, 0, Math.PI, true);
      ctx.lineTo(x - 7, hy + 6);
      ctx.lineTo(x - 10, hy + 6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(x - 7, hy - 5);
      ctx.lineTo(x - 7, hy - 12);
      ctx.lineTo(x - 3.5, hy - 8);
      ctx.lineTo(x, hy - 13);
      ctx.lineTo(x + 3.5, hy - 8);
      ctx.lineTo(x + 7, hy - 12);
      ctx.lineTo(x + 7, hy - 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hc;
      ctx.beginPath();
      ctx.arc(x, hy - 7, 1.5, 0, TAU);
      ctx.fill();
      break;
    case 'wizard':
      ctx.fillStyle = hc;
      ctx.beginPath();
      ctx.ellipse(x, hy - 4, 12, 3, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 7, hy - 5);
      ctx.lineTo(x - dir * 4, hy - 24);
      ctx.lineTo(x + 7, hy - 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(x - dir, hy - 13, 1.6, 0, TAU);
      ctx.fill();
      break;
  }
};
