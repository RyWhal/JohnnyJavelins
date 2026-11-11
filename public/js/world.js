// Biomes and pre-rendered ground chunks.
// The world is split into Voronoi regions (one jittered site per BIOME_CELL
// square); each region is one biome. Ground is painted once per 512px chunk into
// an offscreen canvas and cached, so rich detail costs nothing per frame.
'use strict';

JJ.BIOME_CELL = 1700;
JJ.CHUNK = 512;

JJ.BIOMES = {
  meadow: {
    name: 'Greenhollow Meadow', colors: ['#4a7c3a', '#527f3c', '#45733a', '#5a8a42'],
    dark: 0, tint: null, ambient: 'leaves',
    favored: {},
  },
  forest: {
    name: 'The Darkwood', colors: ['#2a4527', '#2f4b2b', '#263f24', '#33522e'],
    dark: 0.32, tint: 'rgba(20,40,30,0.12)', ambient: 'fireflies',
    favored: { wolf: 2.5, goblin: 2, troll: 1.5 },
  },
  desert: {
    name: 'Sunscorch Dunes', colors: ['#cfae6f', '#d6b778', '#c6a466', '#dcbf84'],
    dark: -0.1, tint: 'rgba(255,170,60,0.07)', ambient: 'dust',
    favored: { skeleton: 2, archer: 2.5, mage: 1.2 },
  },
  tundra: {
    name: 'The Frostlands', colors: ['#dce6ec', '#e6eef3', '#d3dee6', '#cad8e2'],
    dark: 0, tint: 'rgba(120,170,255,0.08)', ambient: 'snow',
    favored: { wolf: 3, wraith: 1.5, troll: 1.5 },
  },
  swamp: {
    name: 'Murkmire Bog', colors: ['#3d4a30', '#435034', '#37432c', '#4a5638'],
    dark: 0.22, tint: 'rgba(60,90,40,0.12)', ambient: 'mist',
    favored: { slime: 3, mage: 2, bat: 1.5 },
  },
  graveyard: {
    name: 'The Barrow Fields', colors: ['#4f5449', '#575c50', '#4a4e44', '#5e6255'],
    dark: 0.3, tint: 'rgba(80,90,130,0.12)', ambient: 'fog',
    favored: { skeleton: 3, archer: 2, wraith: 2.5 },
  },
  volcanic: {
    name: 'The Ashen Wastes', colors: ['#3a3230', '#423734', '#332b29', '#4a3c37'],
    dark: 0.35, tint: 'rgba(255,60,20,0.08)', ambient: 'embers',
    favored: { orc: 2.5, mage: 1.5, troll: 1.5 },
  },
};
JJ.BIOME_KEYS = Object.keys(JJ.BIOMES);

JJ.World = (() => {
  const C = JJ.BIOME_CELL;
  const siteCache = new Map();

  function site(cx, cy) {
    const k = cx * 100003 + cy;
    let s = siteCache.get(k);
    if (s) return s;
    if (cx === 0 && cy === 0) {
      s = { x: 0, y: 0, biome: 'meadow' };
    } else {
      const others = JJ.BIOME_KEYS;
      s = {
        x: (cx + 0.15 + 0.7 * JJ.hash2(cx * 3 + 1, cy * 7 + 2)) * C,
        y: (cy + 0.15 + 0.7 * JJ.hash2(cx * 5 + 3, cy * 11 + 4)) * C,
        biome: others[Math.floor(JJ.hash2(cx * 13 + 5, cy * 17 + 6) * others.length)],
      };
    }
    if (siteCache.size > 5000) siteCache.clear();
    siteCache.set(k, s);
    return s;
  }

  // Nearest and second-nearest biome sites.
  function nearest(x, y) {
    const cx = Math.floor(x / C), cy = Math.floor(y / C);
    let d1 = Infinity, d2 = Infinity, b1 = 'meadow', b2 = 'meadow';
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iy = cy - 1; iy <= cy + 1; iy++) {
        const s = site(ix, iy);
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < d1) {
          if (s.biome !== b1) { d2 = d1; b2 = b1; }
          d1 = d; b1 = s.biome;
        } else if (d < d2 && s.biome !== b1) {
          d2 = d; b2 = s.biome;
        }
      }
    }
    return { b1, d1, b2, d2 };
  }

  function biomeAt(x, y) {
    return nearest(x, y).b1;
  }

  // Biome with a dithered, organic border (used for painting).
  function paintBiomeAt(x, y) {
    const n = nearest(x, y);
    const gap = (n.d2 - n.d1) / 2; // distance to the border
    // wobble the border with low-frequency noise
    const wob = (JJ.hash2(Math.floor(x / 96), Math.floor(y / 96)) - 0.5) * 70;
    if (gap + wob < 0) return n.b2;
    if (gap + wob < 40 && JJ.hash2(Math.floor(x / 16) + 911, Math.floor(y / 16) + 37) > (gap + wob) / 40) return n.b2;
    return n.b1;
  }

  // ------------------------------------------------------------ chunk painting
  const chunks = new Map();
  let frame = 0;

  function getChunk(ix, iy) {
    const k = ix * 100003 + iy;
    let c = chunks.get(k);
    if (!c) {
      c = paintChunk(ix, iy);
      chunks.set(k, c);
      if (chunks.size > 36) {
        // Evict the least recently used chunk.
        let oldK = null, oldF = Infinity;
        for (const [kk, cc] of chunks) if (cc.used < oldF) { oldF = cc.used; oldK = kk; }
        chunks.delete(oldK);
      }
    }
    c.used = frame;
    return c;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = JJ.clamp(Math.round(r + amt), 0, 255);
    g = JJ.clamp(Math.round(g + amt), 0, 255);
    b = JJ.clamp(Math.round(b + amt), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function paintChunk(ix, iy) {
    const S = JJ.CHUNK;
    const ox = ix * S, oy = iy * S;
    const M = 24; // margin so blurred edges line up between chunks
    const T = 16;

    // 1. Base colour mosaic (with margin), blurred into soft gradients.
    const base = document.createElement('canvas');
    base.width = base.height = S + M * 2;
    const b = base.getContext('2d');
    for (let x = -M; x < S + M; x += T) {
      for (let y = -M; y < S + M; y += T) {
        const wx = ox + x, wy = oy + y;
        const bio = JJ.BIOMES[paintBiomeAt(wx + T / 2, wy + T / 2)];
        const h = JJ.hash2(Math.floor(wx / T), Math.floor(wy / T));
        const big = JJ.hash2(Math.floor(wx / 160) + 77, Math.floor(wy / 160) + 99);
        b.fillStyle = shade(bio.colors[Math.floor(h * bio.colors.length)], (big - 0.5) * 18);
        b.fillRect(x + M, y + M, T, T);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.filter = 'blur(7px)';
    ctx.drawImage(base, -M, -M);
    ctx.filter = 'none';

    // 2. Fine speckle texture
    for (let i = 0; i < 900; i++) {
      const x = JJ.hash2(ix * 1000 + i, iy * 7 + 1) * S;
      const y = JJ.hash2(ix * 13 + 2, iy * 1000 + i) * S;
      const l = JJ.hash2(i, ix + iy * 31);
      ctx.fillStyle = l > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(x, y, 2 + l * 2, 2 + l * 2);
    }

    // 3. Decorations, on a jittered grid, sorted top-to-bottom for overlap.
    const lights = [];
    const props = [];
    const G = 48;
    // Props live on a world-aligned grid. Include a band around the chunk so
    // big props that straddle a chunk edge are painted on both sides.
    const hx0 = Math.floor((ox - G * 2) / G), hx1 = Math.floor((ox + S + G * 2) / G);
    const hy0 = Math.floor((oy - G * 2) / G), hy1 = Math.floor((oy + S + G * 2) / G);
    for (let hx = hx0; hx <= hx1; hx++) {
      for (let hy = hy0; hy <= hy1; hy++) {
        const x = hx * G - ox + JJ.hash2(hx + 5, hy + 9) * G;
        const y = hy * G - oy + JJ.hash2(hx + 17, hy + 3) * G;
        const r = JJ.hash2(hx, hy);
        const inside = x >= 0 && x < S && y >= 0 && y < S;
        props.push({ x, y, r, r2: JJ.hash2(hx + 31, hy + 71), biome: paintBiomeAt(ox + x, oy + y), inside });
      }
    }
    props.sort((a, b) => a.y - b.y);
    const scratch = [];
    for (const p of props) JJ.Decor[p.biome](ctx, p.x, p.y, p.r, p.r2, p.inside ? lights : scratch, ox, oy);

    return { canvas, lights, used: frame };
  }

  return {
    biomeAt,
    getChunk,
    tick() { frame++; },
    shade,
  };
})();

// ---------------------------------------------------------------- decorations
// Each painter gets (ctx, x, y, r, r2) where r/r2 are stable random numbers in
// [0,1). Most cells get nothing; a few get a prop.
JJ.Decor = (() => {
  const TAU = Math.PI * 2;

  const shadow = (ctx, x, y, rx, ry, a = 0.25) => {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  };
  const tuft = (ctx, x, y, color, h = 9) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) {
      ctx.moveTo(x + k * 3, y);
      ctx.lineTo(x + k * 5, y - h + Math.abs(k) * 2);
    }
    ctx.stroke();
  };
  const rock = (ctx, x, y, s, c1, c2) => {
    shadow(ctx, x + 2, y + s * 0.5, s * 1.1, s * 0.5);
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.3);
    ctx.lineTo(x - s * 0.6, y - s * 0.6);
    ctx.lineTo(x + s * 0.3, y - s * 0.8);
    ctx.lineTo(x + s, y - s * 0.1);
    ctx.lineTo(x + s * 0.7, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y - s * 0.6);
    ctx.lineTo(x + s * 0.3, y - s * 0.8);
    ctx.lineTo(x + s * 0.2, y - s * 0.2);
    ctx.lineTo(x - s * 0.5, y - s * 0.1);
    ctx.closePath();
    ctx.fill();
  };
  const canopy = (ctx, x, y, s, dark, mid, light) => {
    shadow(ctx, x + s * 0.35, y + s * 0.45, s * 1.15, s * 0.8, 0.35);
    const blobs = [[0, 0, 1], [-0.5, 0.15, 0.7], [0.5, 0.2, 0.7], [0, -0.45, 0.65], [0.1, 0.4, 0.6]];
    ctx.fillStyle = dark;
    for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(x + bx * s, y + by * s, br * s, 0, TAU); ctx.fill(); }
    ctx.fillStyle = mid;
    for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(x + bx * s - s * 0.12, y + by * s - s * 0.12, br * s * 0.8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.35, s * 0.35, 0, TAU); ctx.fill();
  };
  const pine = (ctx, x, y, s, c1, c2, snow) => {
    shadow(ctx, x + s * 0.4, y + s * 0.4, s * 0.9, s * 0.5, 0.3);
    for (let layer = 0; layer < 3; layer++) {
      const ls = s * (1 - layer * 0.28);
      ctx.fillStyle = layer % 2 ? c2 : c1;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const rr = i % 2 ? ls * 0.55 : ls;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(x - s * 0.15, y - s * 0.15, s * 0.3, 0, TAU); ctx.fill();
    }
  };

  return {
    meadow(ctx, x, y, r, r2) {
      if (r < 0.28) tuft(ctx, x, y, '#5d9a4b');
      else if (r < 0.36) {
        const colors = ['#f6e05e', '#f78fb3', '#ffffff', '#9ad0ff', '#ffb347'];
        ctx.fillStyle = colors[Math.floor(r2 * colors.length)];
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + (k % 2) * 8 - 4 + r2 * 4, y + Math.floor(k / 2) * 7, 2.5, 0, TAU); ctx.fill(); }
      } else if (r < 0.39) rock(ctx, x, y, 7 + r2 * 6, '#8a8c86', '#a5a7a0');
      else if (r < 0.43) canopy(ctx, x, y, 14 + r2 * 6, '#2f5e2a', '#3f7a35', '#5a9a48');
      else if (r < 0.435) canopy(ctx, x, y, 34 + r2 * 10, '#28512a', '#356b31', '#4e8c43');
    },
    forest(ctx, x, y, r, r2, lights, ox, oy) {
      if (r < 0.3) canopy(ctx, x, y, 26 + r2 * 18, '#142a14', '#1e3d1c', '#2e5a28');
      else if (r < 0.42) tuft(ctx, x, y, '#3d6b34', 12);
      else if (r < 0.46) {
        // glowing mushrooms
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(x - 1.5, y - 2, 3, 5);
        ctx.fillStyle = r2 < 0.5 ? '#7fe0ff' : '#c58bff';
        ctx.beginPath(); ctx.arc(x, y - 3, 5, Math.PI, 0); ctx.fill();
        lights.push({ x: ox + x, y: oy + y - 3, r: 60, color: r2 < 0.5 ? '#7fe0ff' : '#c58bff', a: 0.5 });
      } else if (r < 0.48) {
        // fallen log
        shadow(ctx, x + 3, y + 5, 26, 6);
        ctx.save(); ctx.translate(x, y); ctx.rotate(r2 * Math.PI);
        ctx.fillStyle = '#5a3d22'; ctx.fillRect(-24, -6, 48, 12);
        ctx.fillStyle = '#7a5532'; ctx.beginPath(); ctx.ellipse(24, 0, 4, 6, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    },
    desert(ctx, x, y, r, r2) {
      if (r < 0.2) {
        ctx.strokeStyle = 'rgba(150,110,60,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y + 30, 34 + r2 * 20, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      } else if (r < 0.25) {
        // cactus
        shadow(ctx, x + 6, y + 8, 12, 5);
        ctx.fillStyle = '#4f8a45';
        ctx.fillRect(x - 4, y - 22, 8, 30);
        ctx.fillRect(x - 13, y - 12, 6, 12); ctx.fillRect(x - 13, y - 4, 10, 5);
        ctx.fillRect(x + 7, y - 16, 6, 10); ctx.fillRect(x + 3, y - 8, 10, 5);
        ctx.fillStyle = '#6aa85c'; ctx.fillRect(x - 2, y - 22, 2, 30);
      } else if (r < 0.29) rock(ctx, x, y, 8 + r2 * 10, '#a8865a', '#c4a273');
      else if (r < 0.31) {
        // bleached skull and bones
        ctx.fillStyle = '#efe8d8';
        ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
        ctx.fillRect(x - 3, y + 3, 6, 4);
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(x - 3.5, y - 1.5, 2.5, 2.5); ctx.fillRect(x + 1, y - 1.5, 2.5, 2.5);
        ctx.strokeStyle = '#efe8d8'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x + 10, y + 2); ctx.lineTo(x + 24, y + 8); ctx.stroke();
      }
    },
    tundra(ctx, x, y, r, r2) {
      if (r < 0.2) pine(ctx, x, y, 16 + r2 * 12, '#2c5a4a', '#3a6d5a', true);
      else if (r < 0.3) {
        ctx.fillStyle = 'rgba(170,215,245,0.55)';
        ctx.beginPath(); ctx.ellipse(x, y, 24 + r2 * 20, 12 + r2 * 8, r2 * 3, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 10, y - 2); ctx.lineTo(x + 8, y + 3); ctx.stroke();
      } else if (r < 0.36) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.ellipse(x, y, 18, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(160,180,200,0.35)';
        ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 18, 4, 0, 0, TAU); ctx.fill();
      } else if (r < 0.39) rock(ctx, x, y, 8 + r2 * 8, '#7d8a96', '#e8f0f6');
    },
    swamp(ctx, x, y, r, r2, lights, ox, oy) {
      if (r < 0.16) {
        ctx.fillStyle = '#1f3a3a';
        ctx.beginPath(); ctx.ellipse(x, y, 30 + r2 * 26, 16 + r2 * 12, r2 * 2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(120,180,170,0.18)';
        ctx.beginPath(); ctx.ellipse(x - 6, y - 4, 16 + r2 * 10, 6, r2 * 2, 0, TAU); ctx.fill();
        if (r2 > 0.4) {
          ctx.fillStyle = '#4f8a3a';
          ctx.beginPath(); ctx.arc(x + 10, y + 2, 5, 0.3, TAU - 0.3); ctx.lineTo(x + 10, y + 2); ctx.fill();
        }
      } else if (r < 0.32) tuft(ctx, x, y, '#6b7a3a', 14);
      else if (r < 0.36) {
        // dead tree
        shadow(ctx, x + 6, y + 6, 18, 6);
        ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y + 4); ctx.lineTo(x + 2, y - 22);
        ctx.moveTo(x + 1, y - 12); ctx.lineTo(x - 12, y - 24);
        ctx.moveTo(x + 2, y - 18); ctx.lineTo(x + 14, y - 30);
        ctx.stroke(); ctx.lineCap = 'butt';
      } else if (r < 0.37) {
        // will-o-wisp
        ctx.fillStyle = 'rgba(160,255,200,0.8)';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
        lights.push({ x: ox + x, y: oy + y, r: 70, color: '#8fffc0', a: 0.6 });
      }
    },
    graveyard(ctx, x, y, r, r2) {
      if (r < 0.16) {
        // tombstone
        shadow(ctx, x + 4, y + 6, 12, 4);
        ctx.fillStyle = '#7d8079';
        ctx.beginPath(); ctx.moveTo(x - 9, y + 4); ctx.lineTo(x - 9, y - 12); ctx.arc(x, y - 12, 9, Math.PI, 0); ctx.lineTo(x + 9, y + 4); ctx.fill();
        ctx.fillStyle = '#9a9d95'; ctx.fillRect(x - 9, y - 12, 3, 16);
        ctx.fillStyle = '#5a5d56'; ctx.fillRect(x - 4, y - 10, 8, 2); ctx.fillRect(x - 3, y - 6, 6, 2);
      } else if (r < 0.22) {
        // stone cross
        shadow(ctx, x + 4, y + 6, 10, 4);
        ctx.fillStyle = '#8a8d85';
        ctx.fillRect(x - 3, y - 20, 6, 24); ctx.fillRect(x - 9, y - 14, 18, 5);
      } else if (r < 0.34) tuft(ctx, x, y, '#7a7a5a', 8);
      else if (r < 0.36) {
        // open grave
        ctx.fillStyle = '#2a2420'; ctx.fillRect(x - 10, y - 18, 20, 34);
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x + 12, y - 10, 10, 22);
      }
    },
    volcanic(ctx, x, y, r, r2, lights, ox, oy) {
      if (r < 0.1) {
        // lava crack
        ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
        ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10;
        ctx.beginPath();
        let px = x, py = y;
        ctx.moveTo(px, py);
        for (let k = 0; k < 5; k++) {
          px += 10 + JJ.hash2(k, Math.floor(ox + x)) * 10;
          py += (JJ.hash2(Math.floor(oy + y), k) - 0.5) * 22;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        lights.push({ x: ox + x + 25, y: oy + y, r: 110, color: '#ff6a1a', a: 0.7 });
      } else if (r < 0.14) {
        // lava pool
        ctx.fillStyle = '#2a1a16';
        ctx.beginPath(); ctx.ellipse(x, y, 22 + r2 * 10, 13, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff5a14';
        ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.ellipse(x, y, 16 + r2 * 8, 9, 0, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffc04a';
        ctx.beginPath(); ctx.ellipse(x - 4, y - 2, 6, 3, 0, 0, TAU); ctx.fill();
        lights.push({ x: ox + x, y: oy + y, r: 150, color: '#ff5a14', a: 0.85 });
      } else if (r < 0.24) rock(ctx, x, y, 8 + r2 * 12, '#241e1d', '#3e3533');
      else if (r < 0.3) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(x, y, 20, 10, r2, 0, TAU); ctx.fill();
      }
    },
  };
})();
