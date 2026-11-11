// Biomes and pre-rendered pixel-art ground chunks.
// The world is split into Voronoi regions (one jittered site per BIOME_CELL
// square); each region is one biome. Each 512px chunk is painted once into an
// offscreen canvas: a dithered pixel-art ground (2 world px per texel) with
// biome features baked in (water, lava, ice, dunes, paths), then low props
// from the sprite atlas. No trees: the camera looks straight down.
'use strict';

JJ.BIOME_CELL = 1700;
JJ.CHUNK = 512;
JJ.TEXEL = 2;

JJ.BIOMES = {
  meadow: {
    name: 'Greenhollow Meadow', dark: 0, tint: null, ambient: 'leaves', favored: {},
    ground: ['#2f5a2a', '#3a6b30', '#467c37', '#548b40', '#63994a'],
    density: 0.12,
    props: { m_grass1: 5, m_grass2: 3, m_grass3: 3, m_daisy1: 2, m_daisy2: 2, m_clover1: 2, m_clover2: 2, m_rock1: 1, m_rock2: 1, m_pebble: 2, m_toad: 0.6 },
  },
  forest: {
    name: 'The Darkwood', dark: 0.32, tint: 'rgba(20,40,30,0.12)', ambient: 'fireflies', canopy: true,
    favored: { wolf: 2.5, goblin: 2, troll: 1.5 },
    ground: ['#1c3019', '#233a1f', '#2b4524', '#33502a', '#3d5c30'],
    density: 0.16,
    props: { f_fern1: 3, f_fern2: 3, f_moss1: 2, f_moss2: 2, f_mush1: 2, f_mush2: 1.5, f_lant1: 0.8, f_lant2: 0.8, f_stump1: 1, f_stump2: 1, f_log1: 0.8, f_log2: 0.8 },
  },
  desert: {
    name: 'Sunscorch Dunes', dark: -0.1, tint: 'rgba(255,170,60,0.07)', ambient: 'dust',
    favored: { skeleton: 2, archer: 2.5, mage: 1.2 },
    ground: ['#b8904f', '#c69e5c', '#d2ab68', '#ddb978', '#e7c88c'],
    density: 0.07,
    props: { d_cact1: 1.5, d_cact2: 1.5, d_sag1: 1.5, d_sag2: 1.5, d_bone1: 1, d_bone2: 1, d_dino: 0.6, d_rock: 1, d_peb: 1.5, d_bush: 1.5 },
  },
  tundra: {
    name: 'The Frostlands', dark: 0, tint: 'rgba(120,170,255,0.08)', ambient: 'snow',
    favored: { wolf: 3, wraith: 1.5, troll: 1.5 },
    ground: ['#b9c9d6', '#c9d7e2', '#d8e3ec', '#e5eef4', '#f2f7fa'],
    density: 0.09,
    props: { t_snow1: 2, t_snow2: 2, t_fmush1: 1, t_fmush2: 1, t_cry1: 1, t_cry2: 1, t_rock1: 1.5, t_rock2: 1.5, t_log: 0.8, t_grass: 2 },
  },
  swamp: {
    name: 'Murkmire Bog', dark: 0.22, tint: 'rgba(60,90,40,0.12)', ambient: 'mist',
    favored: { slime: 3, mage: 2, bat: 1.5 },
    ground: ['#2c3424', '#343e2a', '#3d4830', '#465236', '#505d3c'],
    density: 0.12,
    props: { s_reed1: 3, s_reed2: 3, s_moss: 2, s_bush: 1.5, s_mush: 1 },
    waterProps: { s_lily1: 2, s_lily2: 2 },
  },
  graveyard: {
    name: 'The Barrow Fields', dark: 0.3, tint: 'rgba(80,90,130,0.12)', ambient: 'fog',
    favored: { skeleton: 3, archer: 2, wraith: 2.5 },
    ground: ['#3b4036', '#43483d', '#4b5144', '#545a4c', '#5e6455'],
    density: 0.13,
    props: { g_tomb1: 2, g_tomb2: 2, g_tomb3: 2, g_tomb4: 2, g_coffin: 0.6, g_candle1: 1, g_candle2: 1, g_urn: 0.7, g_bone: 1, g_bush: 1.5 },
  },
  volcanic: {
    name: 'The Ashen Wastes', dark: 0.35, tint: 'rgba(255,60,20,0.08)', ambient: 'embers',
    favored: { orc: 2.5, mage: 1.5, troll: 1.5 },
    ground: ['#241e1d', '#2c2524', '#352c2a', '#3e3431', '#483c38'],
    density: 0.09,
    props: { v_obs1: 1.5, v_obs2: 1.5, v_rock1: 1.5, v_rock2: 1.5, v_cl1: 1, v_cl2: 1, v_ember1: 1, v_ember2: 1, v_log: 0.6 },
  },
};
JJ.BIOME_KEYS = Object.keys(JJ.BIOMES);

// Props that give off light (colour, radius).
JJ.GLOW_PROPS = {
  f_lant1: ['#ffd27a', 90], f_lant2: ['#ffd27a', 90],
  g_candle1: ['#ffcf6a', 80], g_candle2: ['#ffcf6a', 80],
  v_ember1: ['#ff7a2a', 90], v_ember2: ['#ff5a2a', 90], v_log: ['#ff8a3a', 110],
  t_cry1: ['#bfe4ff', 60], t_cry2: ['#9fd8ff', 60],
};

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

  // Biome with a wobbly, dithered border (resolution: 8 world px).
  function paintBiomeAt(x, y) {
    const n = nearest(x, y);
    const gap = (n.d2 - n.d1) / 2;
    const wob = (vnoise(x / 120 + 31, y / 120 + 17) - 0.5) * 90;
    const g = gap + wob;
    if (g < 0) return n.b2;
    if (g < 28 && JJ.hash2(Math.floor(x / 8) + 911, Math.floor(y / 8) + 37) > g / 28) return n.b2;
    return n.b1;
  }

  // Smooth value noise in [0,1].
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = JJ.hash2(xi, yi), b = JJ.hash2(xi + 1, yi);
    const c = JJ.hash2(xi, yi + 1), d = JJ.hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // Biome "feature" field: water, lava, ice, dirt patches all key off this.
  const feature = (x, y) => vnoise(x / 140 + 50, y / 140 + 70) * 0.7 + vnoise(x / 45, y / 45 + 30) * 0.3;

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

  const rgbCache = {};
  function rgb(hex) {
    let c = rgbCache[hex];
    if (!c) {
      const n = parseInt(hex.slice(1), 16);
      c = rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return c;
  }
  const ramp = (pal, v, d) => pal[JJ.clamp(Math.floor(v * pal.length + d), 0, pal.length - 1)];

  const PAL = {
    dirt: ['#5a4428', '#6b5232', '#7a5f3b'],
    litter: ['#4a3a22', '#5a4628'],
    dune: '#a9824a', duneLight: '#efd6a0',
    ice: ['#8fc0e0', '#a6d2ec', '#c4e4f6'], iceRim: '#e8f6ff',
    water: ['#1a2e2e', '#21393a', '#2a4746'], waterHi: '#4a7a70', mud: '#2a2a1c',
    path: ['#5f5f58', '#6a6a62', '#77776e'],
    lava: ['#3a1208', '#7a1a08', '#c2380c', '#ff6a1a', '#ffb040'],
  };

  // Colour of one ground texel at world position (x,y) in biome b.
  // Returns [hex, isBlocking] where blocking = water/lava (no props there).
  function groundTexel(b, x, y, tx, ty) {
    const B = JJ.BIOMES[b];
    const d = BAYER[(ty & 3) * 4 + (tx & 3)];
    const h = JJ.hash2(tx * 7 + 3, ty * 13 + 5);
    const n1 = vnoise(x / 90, y / 90);
    const n2 = vnoise(x / 23 + 100, y / 23);
    const v = 0.55 * n1 + 0.3 * n2 + 0.15 * h;
    const f = feature(x, y);
    switch (b) {
      case 'meadow':
        if (f > 0.74) return [ramp(PAL.dirt, (f - 0.74) * 4 + h * 0.3, d), false];
        if (h > 0.985) return [B.ground[4], false];
        break;
      case 'forest':
        if (h > 0.9) return [ramp(PAL.litter, h, d), false];
        if (f > 0.72) return [ramp(B.ground, v * 0.5, d), false];
        break;
      case 'desert': {
        const s = Math.sin(x * 0.035 + y * 0.012 + n1 * 7);
        if (s > 0.94) return [PAL.dune, false];
        if (s < -0.96) return [PAL.duneLight, false];
        break;
      }
      case 'tundra':
        if (f > 0.7) return [f < 0.715 ? PAL.iceRim : h > 0.985 ? '#ffffff' : ramp(PAL.ice, n2, d), false];
        break;
      case 'swamp':
        if (f > 0.62) {
          if (h > 0.985) return [PAL.waterHi, true];
          return [ramp(PAL.water, (f - 0.62) * 3 + n2 * 0.4, d), true];
        }
        if (f > 0.6) return [PAL.mud, false];
        break;
      case 'graveyard':
        if (Math.abs(f - 0.5) < 0.02) return [ramp(PAL.path, h, d), false];
        if (f > 0.78) return [ramp(PAL.dirt, h * 0.6, d), false];
        break;
      case 'volcanic':
        if (f > 0.75) {
          if (f < 0.762) return [PAL.lava[0], true];
          return [ramp(PAL.lava, 0.15 + (f - 0.762) * 11 + n2 * 0.2, d), true];
        }
        if (Math.abs(n2 - 0.5) < 0.012 && n1 > 0.45) return [PAL.lava[2], false];
        break;
    }
    return [ramp(B.ground, v, d), false];
  }

  // ------------------------------------------------------------ chunk painting
  const chunks = new Map();
  const queue = [];
  let frame = 0;

  const chunkKey = (ix, iy) => ix * 100003 + iy;

  function getChunk(ix, iy) {
    const k = chunkKey(ix, iy);
    let c = chunks.get(k);
    if (!c) {
      c = paintChunk(ix, iy);
      chunks.set(k, c);
      evict();
    }
    c.used = frame;
    return c;
  }

  function evict() {
    while (chunks.size > 40) {
      let oldK = null, oldF = Infinity;
      for (const [kk, cc] of chunks) if (cc.used < oldF) { oldF = cc.used; oldK = kk; }
      chunks.delete(oldK);
    }
  }

  // Pre-paint chunks around the camera, one per frame, so walking into new
  // ground rarely has to paint synchronously.
  function prefetch(cx, cy, hw, hh) {
    const S = JJ.CHUNK;
    const x0 = Math.floor((cx - hw - S) / S), x1 = Math.floor((cx + hw + S) / S);
    const y0 = Math.floor((cy - hh - S) / S), y1 = Math.floor((cy + hh + S) / S);
    queue.length = 0;
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) if (!chunks.has(chunkKey(ix, iy))) queue.push([ix, iy]);
    if (queue.length) {
      const [ix, iy] = queue[0];
      const c = paintChunk(ix, iy);
      c.used = frame;
      chunks.set(chunkKey(ix, iy), c);
      evict();
    }
  }

  function paintChunk(ix, iy) {
    const S = JJ.CHUNK, T = JJ.TEXEL, N = S / T;
    const ox = ix * S, oy = iy * S;

    // 1. Pixel ground, written straight into ImageData.
    const low = document.createElement('canvas');
    low.width = low.height = N;
    const lctx = low.getContext('2d');
    const imgData = lctx.createImageData(N, N);
    const px = imgData.data;
    const blocked = new Uint8Array(N * N);
    const B4 = 4; // biome resolved per 4x4 texels (8 world px)
    for (let by = 0; by < N; by += B4) {
      for (let bx = 0; bx < N; bx += B4) {
        const biome = paintBiomeAt(ox + (bx + 2) * T, oy + (by + 2) * T);
        for (let ty = by; ty < by + B4; ty++) {
          for (let tx = bx; tx < bx + B4; tx++) {
            const wx = ox + tx * T + 1, wy = oy + ty * T + 1;
            const [hex, block] = groundTexel(biome, wx, wy, Math.floor(wx / T), Math.floor(wy / T));
            const c = rgb(hex);
            const i = (ty * N + tx) * 4;
            px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
            if (block) blocked[ty * N + tx] = 1;
          }
        }
      }
    }
    lctx.putImageData(imgData, 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, S, S);

    // Light from lava pools.
    const lights = [];
    for (let gy = 16; gy < S; gy += 48) {
      for (let gx = 16; gx < S; gx += 48) {
        const wx = ox + gx, wy = oy + gy;
        if (biomeAt(wx, wy) === 'volcanic' && feature(wx, wy) > 0.79) lights.push({ x: wx, y: wy, r: 130, color: '#ff5a14', a: 0.75 });
      }
    }

    // 2. Props on a world-aligned grid. A band around the chunk is included
    // so props straddling an edge are drawn in both chunks (no seams).
    const props = [];
    if (JJ.Sprites.ready) {
      const G = 40;
      const hx0 = Math.floor((ox - G * 2) / G), hx1 = Math.floor((ox + S + G) / G);
      const hy0 = Math.floor((oy - G * 2) / G), hy1 = Math.floor((oy + S + G) / G);
      for (let hx = hx0; hx <= hx1; hx++) {
        for (let hy = hy0; hy <= hy1; hy++) {
          const wx = Math.round((hx * G + JJ.hash2(hx + 5, hy + 9) * G) / T) * T;
          const wy = Math.round((hy * G + JJ.hash2(hx + 17, hy + 3) * G) / T) * T;
          const bName = paintBiomeAt(wx, wy);
          const B = JJ.BIOMES[bName];
          if (JJ.hash2(hx, hy) > B.density) continue;
          const f = feature(wx, wy);
          const wet = (bName === 'swamp' && f > 0.64) || (bName === 'volcanic' && f > 0.74);
          const dry = (bName === 'swamp' && f < 0.59) || (bName === 'volcanic' && f < 0.73) || (bName !== 'swamp' && bName !== 'volcanic');
          let table = null;
          if (wet && B.waterProps) table = B.waterProps;
          else if (dry) table = B.props;
          if (!table) continue;
          const name = pickWeighted(table, JJ.hash2(hx + 31, hy + 71));
          props.push({ name, x: wx - ox, y: wy - oy, wx, wy, flip: JJ.hash2(hx + 3, hy + 91) > 0.5 });
        }
      }
      props.sort((a, b) => a.y - b.y);
      for (const p of props) {
        const lily = p.name.startsWith('s_lily');
        if (!lily) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(p.x - 9, p.y - 2, 18, 4);
          ctx.fillRect(p.x - 6, p.y - 3, 12, 6);
        }
        // Props sit back a little (dimmed) so monsters read clearly on top.
        const o = { flip: p.flip, center: lily };
        JJ.Sprites.draw(ctx, p.name, p.x, p.y, 28, o);
        if (!JJ.GLOW_PROPS[p.name]) JJ.Sprites.draw(ctx, p.name, p.x, p.y, 28, { ...o, tint: 'dark', alpha: 0.28 });
        const g = JJ.GLOW_PROPS[p.name];
        if (g && p.x >= 0 && p.x < S && p.y >= 0 && p.y < S) lights.push({ x: p.wx, y: p.wy - 14, r: g[1], color: g[0], a: 0.7 });
      }
    }

    return { canvas, lights, used: frame, withProps: JJ.Sprites.ready };
  }

  function pickWeighted(table, r) {
    let total = 0;
    for (const k in table) total += table[k];
    let x = r * total;
    for (const k in table) {
      x -= table[k];
      if (x <= 0) return k;
    }
    return Object.keys(table)[0];
  }

  // Repaint chunks once the sprite atlas arrives (props were skipped).
  JJ.Sprites.onReady(() => {
    for (const [k, c] of chunks) if (!c.withProps) chunks.delete(k);
  });

  return {
    biomeAt,
    getChunk,
    prefetch,
    tick() { frame++; },
    feature,
  };
})();
