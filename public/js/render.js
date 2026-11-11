// Canvas renderer: everything is drawn procedurally, no image assets.
'use strict';

JJ.Renderer = class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.menuCam = { x: 0, y: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.zoom = JJ.clamp(Math.sqrt(this.w * this.h) / 900, 0.55, 1.15);
    this.game.viewW = this.w / this.zoom;
    this.game.viewH = this.h / this.zoom;
  }

  render(time, dt) {
    const { ctx, game } = this;
    const live = game.player && game.state !== 'idle';
    let cx, cy;
    if (live) {
      cx = game.player.x;
      cy = game.player.y;
    } else {
      this.menuCam.x += dt * 40;
      this.menuCam.y += dt * 15;
      cx = this.menuCam.x;
      cy = this.menuCam.y;
    }
    this.cam = { x: cx, y: cy };
    JJ.World.tick();

    let sx = 0, sy = 0;
    if (live && game.shake > 0 && JJ.Save.data.settings.shake) {
      sx = JJ.rand(-game.shake, game.shake);
      sy = JJ.rand(-game.shake, game.shake);
    }

    const z = this.zoom * this.dpr;
    const ox = this.dpr * (this.w / 2 + sx) - cx * z;
    const oy = this.dpr * (this.h / 2 + sy) - cy * z;
    this.worldTransform = [z, 0, 0, z, ox, oy];
    ctx.setTransform(z, 0, 0, z, ox, oy);

    // Mouse in world space (for mouse aim)
    const m = JJ.Input.mouse;
    game.mouseWorld = { x: (m.x - this.w / 2) / this.zoom + cx, y: (m.y - this.h / 2) / this.zoom + cy };

    // Atmosphere: the biome under the camera plus a slow day -> night cycle.
    const biome = JJ.BIOMES[JJ.World.biomeAt(cx, cy)];
    const night = live ? JJ.clamp((game.t - 120) / 720, 0, 1) * 0.5 : 0.1;
    const targetDark = JJ.clamp(biome.dark + night, 0, 0.82);
    const k = 1 - Math.exp(-dt * 1.5);
    this.dark = this.dark === undefined ? targetDark : JJ.lerp(this.dark, targetDark, k);
    this.biome = biome;

    this.hi = JJ.Save.data.settings.quality !== 'low';
    this.lights = [];
    this.drawGround(cx, cy, time);
    if (this.hi) this.drawDecals();
    if (!live) {
      this.drawAtmosphere(time, dt, false);
      return this.drawScreenFx(time);
    }

    this.drawPickups(time);
    this.drawStrikeMarkers();
    this.drawVortexes(time);
    for (const e of game.enemies) if (!e.dead) JJ.drawEnemy(ctx, e, time, game.player.x, game.player.y);
    this.drawPlayer(time);
    this.drawOrbit();
    this.drawProjectiles();
    this.drawShots(time);
    this.drawFallingJavelins();
    this.drawEffects();
    this.drawParticles();
    this.drawAtmosphere(time, dt, true);
    ctx.setTransform(...this.worldTransform);
    this.drawTexts();
    this.drawScreenFx(time);
  }

  // ------------------------------------------------------------- ground
  drawGround(cx, cy) {
    const { ctx } = this;
    const g = this.game;
    const S = JJ.CHUNK;
    const hw = g.viewW / 2 + 40, hh = g.viewH / 2 + 40;
    const x0 = Math.floor((cx - hw) / S), x1 = Math.floor((cx + hw) / S);
    const y0 = Math.floor((cy - hh) / S), y1 = Math.floor((cy + hh) / S);
    ctx.imageSmoothingEnabled = false;
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const c = JJ.World.getChunk(ix, iy);
        // +1px overlap hides hairline seams between chunks
        ctx.drawImage(c.canvas, ix * S, iy * S, S + 1, S + 1);
        for (const l of c.lights) this.lights.push(l);
      }
    }
    ctx.imageSmoothingEnabled = true;
    JJ.World.prefetch(cx, cy, hw, hh);
  }

  // The Darkwood has no trees on the ground; instead, soft leaf shadows from
  // an unseen canopy drift over everything (two layers with parallax).
  drawCanopy(time) {
    const { ctx } = this;
    const { x: cx, y: cy } = this.cam;
    const g = this.game;
    const hw = g.viewW / 2 + 200, hh = g.viewH / 2 + 200;
    ctx.setTransform(...this.worldTransform);
    const spr = this.glowSprite('#000000');
    for (const [cell, par, alpha, size] of [[260, 0.15, 0.22, 230], [180, 0.35, 0.16, 150]]) {
      const ox = time * 6 * (1 + par), oy = time * 3;
      const px = cx * par;
      const py = cy * par;
      const x0 = Math.floor((cx - hw - px - ox) / cell), x1 = Math.floor((cx + hw - px - ox) / cell);
      const y0 = Math.floor((cy - hh - py - oy) / cell), y1 = Math.floor((cy + hh - py - oy) / cell);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iy = y0; iy <= y1; iy++) {
          if (JJ.hash2(ix * 3 + cell, iy * 7) > 0.55) continue;
          const x = ix * cell + JJ.hash2(ix, iy + cell) * cell + px + ox;
          const y = iy * cell + JJ.hash2(ix + cell, iy) * cell + py + oy;
          const s = size * (0.7 + JJ.hash2(ix + 9, iy + 4) * 0.6);
          ctx.globalAlpha = alpha * this.canopyFade;
          ctx.drawImage(spr, x - s, y - s * 0.7, s * 2, s * 1.4);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawDecals() {
    const { ctx } = this;
    const g = this.game;
    if (!g.decals) return;
    for (const d of g.decals) {
      const a = 0.45 * (1 - d.t / d.life);
      ctx.fillStyle = d.color + a.toFixed(3) + ')';
      for (const [bx, by, br] of d.blobs) {
        ctx.beginPath();
        ctx.ellipse(d.x + bx, d.y + by, br, br * 0.7, 0, 0, JJ.TAU);
        ctx.fill();
      }
    }
  }

  // ------------------------------------------------------------- lighting
  glowSprite(color) {
    this.glowCache = this.glowCache || {};
    let c = this.glowCache[color];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.glowCache[color] = c;
    return c;
  }

  lightSprite() {
    if (this._lightSprite) return this._lightSprite;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this._lightSprite = c;
    return c;
  }

  collectLights(time) {
    const g = this.game, s = g.stats, L = this.lights, p = g.player;
    L.push({ x: p.x, y: p.y, r: 330 + (g.frenzyT > 0 ? 80 : 0), a: 1, color: '#ffcf8a' });
    const tip = this.tipColor();
    const glowy = s.burn || s.chain || s.zeus || s.explode;
    // Sample javelins evenly; a few dozen lights read as "lots of glowing javelins".
    const proj = g.projectiles;
    const stride = Math.max(1, Math.ceil(proj.length / 40));
    for (let i = 0; i < proj.length; i += stride) {
      const j = proj[i];
      if (j.dead) continue;
      if (j.mega) L.push({ x: j.x, y: j.y, r: 200, a: 0.9, color: '#ffd34d' });
      else if (glowy) L.push({ x: j.x, y: j.y, r: 55 * j.size * Math.min(2, Math.sqrt(stride)), a: 0.5, color: tip });
    }
    for (const o of g.orbitPos) L.push({ x: o.x, y: o.y, r: 70, a: 0.5, color: tip });
    for (const f of g.effects) {
      const k = f.t / f.life;
      if (f.type === 'boom') L.push({ x: f.x, y: f.y, r: f.r * 2.6, a: 1 - k, color: '#ff8a3a' });
      else if (f.type === 'bolt') {
        const a = f.pts[f.pts.length - 1];
        L.push({ x: a.x, y: a.y, r: 160, a: 1 - k, color: '#9fdcff' });
      }
    }
    const shotStride = Math.max(1, Math.ceil(g.shots.length / 60));
    for (let i = 0; i < g.shots.length; i += shotStride) {
      const b = g.shots[i];
      L.push({ x: b.x, y: b.y, r: b.kind === 'arrow' ? 30 : b.r * 6, a: 0.8, color: b.color });
    }
    let burning = 0;
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.boss) L.push({ x: e.x, y: e.y, r: e.r * 4, a: 0.6, color: e.type === 'lich' ? '#4dffd2' : '#ff5040' });
      else if (e.burnT > 0 && burning++ < 25) L.push({ x: e.x, y: e.y, r: 45, a: 0.5, color: '#ff8a2a' });
      else if (e.elite) L.push({ x: e.x, y: e.y, r: 90, a: 0.6, color: '#ffd34d' });
    }
    for (const k of g.pickups) if (k.type === 'chest') L.push({ x: k.x, y: k.y, r: 110, a: 0.8, color: '#ffd34d' });
    for (const st of g.strikes) if (st.t > st.land * 0.6) L.push({ x: st.x, y: st.y, r: 70, a: 0.5, color: '#ffe680' });
  }

  drawLighting(time) {
    const dark = this.dark;
    if (dark < 0.02) return;
    const { ctx } = this;
    if (!this.hi) {
      // Low quality: one cheap gradient instead of a per-light light map.
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const r0 = 300 * this.zoom;
      const grad = ctx.createRadialGradient(this.w / 2, this.h / 2, r0 * 0.3, this.w / 2, this.h / 2, r0 * 1.6);
      grad.addColorStop(0, 'rgba(6,8,22,0)');
      grad.addColorStop(1, `rgba(6,8,22,${dark})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
      return;
    }
    const RES = 4; // light map at quarter resolution; it's all soft gradients
    const lw = Math.ceil(this.w / RES), lh = Math.ceil(this.h / RES);
    if (!this.lightCanvas) this.lightCanvas = document.createElement('canvas');
    const lc = this.lightCanvas;
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    const l = lc.getContext('2d');
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, lw, lh);
    l.fillStyle = `rgba(6,8,22,${dark})`;
    l.fillRect(0, 0, lw, lh);
    l.globalCompositeOperation = 'destination-out';
    const [z, , , , ox, oy] = this.worldTransform;
    const sc = z / this.dpr / RES;
    l.setTransform(sc, 0, 0, sc, ox / this.dpr / RES, oy / this.dpr / RES);
    const spr = this.lightSprite();
    const { x: cx, y: cy } = this.cam;
    const hw = this.game.viewW / 2, hh = this.game.viewH / 2;
    for (const li of this.lights) {
      if (Math.abs(li.x - cx) > hw + li.r || Math.abs(li.y - cy) > hh + li.r) continue;
      l.globalAlpha = Math.min(1, li.a);
      l.drawImage(spr, li.x - li.r, li.y - li.r, li.r * 2, li.r * 2);
    }
    l.globalAlpha = 1;
    l.globalCompositeOperation = 'source-over';

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(lc, 0, 0, this.w, this.h);
  }

  drawGlows() {
    const { ctx } = this;
    ctx.setTransform(...this.worldTransform);
    ctx.globalCompositeOperation = 'lighter';
    const strength = this.dark * 0.4;
    if (strength < 0.06 || !this.hi) {
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    let n = 0;
    const { x: cx, y: cy } = this.cam;
    const hw = this.game.viewW / 2, hh = this.game.viewH / 2;
    for (const li of this.lights) {
      if (Math.abs(li.x - cx) > hw + li.r || Math.abs(li.y - cy) > hh + li.r) continue;
      if (n++ > 45) break;
      if (!li.color || li.r > 300) continue;
      ctx.globalAlpha = Math.min(1, li.a) * strength;
      const r = li.r * 0.6;
      ctx.drawImage(this.glowSprite(li.color), li.x - r, li.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Biome tint, darkness, glows and weather.
  drawAtmosphere(time, dt, live) {
    const { ctx } = this;
    if (this.biome.tint) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = this.biome.tint;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (live && this.hi) this.collectLights(time);
    this.canopyFade = JJ.lerp(this.canopyFade || 0, this.biome.canopy ? 1 : 0, 1 - Math.exp(-dt * 1.5));
    if (this.hi && this.canopyFade > 0.02) this.drawCanopy(time);
    this.updateAmbient(dt);
    this.drawAmbient(time, false);
    this.drawLighting(time);
    this.drawGlows();
    this.drawAmbient(time, true);
  }

  // ------------------------------------------------------------- weather
  updateAmbient(dt) {
    this.ambient = this.ambient || [];
    const A = this.ambient;
    const kind = this.biome.ambient;
    let want = { snow: 160, embers: 70, fireflies: 45, dust: 50, leaves: 26, mist: 14, fog: 16 }[kind] || 0;
    if (!this.hi) want = Math.floor(want / 3);
    const g = this.game;
    const hw = g.viewW / 2 + 60, hh = g.viewH / 2 + 60;
    const { x: cx, y: cy } = this.cam;
    let count = 0;
    for (const q of A) if (q.kind === kind && !q.dead) count++;
    for (let n = 0; count < want && n < 8; n++, count++) {
      const q = { kind, t: 0, x: cx + JJ.rand(-hw, hw), y: cy + JJ.rand(-hh, hh), seed: Math.random() * 100 };
      switch (kind) {
        case 'snow': Object.assign(q, { vx: JJ.rand(-30, -10), vy: JJ.rand(40, 80), size: JJ.rand(1.5, 3.5), life: JJ.rand(6, 12) }); break;
        case 'embers': Object.assign(q, { vx: JJ.rand(-15, 15), vy: JJ.rand(-60, -25), size: JJ.rand(1.5, 3), life: JJ.rand(2, 5) }); break;
        case 'fireflies': Object.assign(q, { vx: 0, vy: 0, size: 2.2, life: JJ.rand(4, 9) }); break;
        case 'dust': Object.assign(q, { vx: JJ.rand(60, 120), vy: JJ.rand(-10, 10), size: JJ.rand(1, 2.5), life: JJ.rand(3, 6) }); break;
        case 'leaves': Object.assign(q, { vx: JJ.rand(20, 50), vy: JJ.rand(15, 35), size: JJ.rand(3, 5), life: JJ.rand(5, 10) }); break;
        case 'mist':
        case 'fog': Object.assign(q, { vx: JJ.rand(8, 20), vy: JJ.rand(-4, 4), size: JJ.rand(90, 180), life: JJ.rand(8, 14) }); break;
      }
      A.push(q);
    }
    for (const q of A) {
      q.t += dt;
      if (q.kind === 'fireflies') {
        q.vx += Math.sin(q.t * 1.7 + q.seed) * 30 * dt;
        q.vy += Math.cos(q.t * 1.3 + q.seed) * 30 * dt;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.t > q.life || Math.abs(q.x - cx) > hw + 200 || Math.abs(q.y - cy) > hh + 200) q.dead = true;
    }
    JJ.compact(A);
  }

  drawAmbient(time, glowing) {
    const { ctx } = this;
    const A = this.ambient;
    if (!A || !A.length) return;
    ctx.setTransform(...this.worldTransform);
    for (const q of A) {
      const fade = Math.min(1, q.t / 0.8, (q.life - q.t) / 0.8);
      const isGlow = q.kind === 'embers' || q.kind === 'fireflies';
      if (isGlow !== glowing) continue;
      switch (q.kind) {
        case 'snow':
          ctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
          ctx.fillRect(q.x, q.y, q.size, q.size);
          break;
        case 'dust':
          ctx.fillStyle = `rgba(240,215,160,${0.5 * fade})`;
          ctx.fillRect(q.x, q.y, q.size * 4, q.size * 0.7);
          break;
        case 'leaves':
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.t * 2 + q.seed);
          ctx.fillStyle = q.seed > 50 ? `rgba(220,150,50,${fade})` : `rgba(120,170,60,${fade})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, q.size, q.size * 0.45, 0, 0, JJ.TAU);
          ctx.fill();
          ctx.restore();
          break;
        case 'mist':
        case 'fog':
          ctx.globalAlpha = (q.kind === 'fog' ? 0.16 : 0.12) * fade;
          ctx.drawImage(this.glowSprite(q.kind === 'fog' ? '#c8d0e8' : '#cfe8c8'), q.x - q.size, q.y - q.size * 0.6, q.size * 2, q.size * 1.2);
          ctx.globalAlpha = 1;
          break;
        case 'embers': {
          const fl = 0.6 + 0.4 * Math.sin(time * 12 + q.seed);
          ctx.fillStyle = `rgba(255,${120 + Math.floor(q.seed)},40,${fade * fl})`;
          ctx.fillRect(q.x, q.y, q.size, q.size);
          break;
        }
        case 'fireflies': {
          const fl = Math.max(0, Math.sin(time * 3 + q.seed));
          ctx.globalAlpha = fade * fl;
          ctx.drawImage(this.glowSprite('#d8ff6a'), q.x - 10, q.y - 10, 20, 20);
          ctx.fillStyle = '#f4ffb0';
          ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
          ctx.globalAlpha = 1;
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------- player
  drawPlayer(time) {
    const { ctx } = this;
    const g = this.game, p = g.player;
    if (p.inv > 0 && g.state === 'playing' && Math.floor(time * 20) % 2 === 0 && !g.won) return;
    const x = p.x, y = p.y;
    const look = JJ.Save.data.johnny;
    const pull = p.throwAnim > 0 ? -10 * (p.throwAnim / 0.15) : 0;
    const a = p.face;
    const gr = JJ.johnnyGrip(x, y + (p.moving ? Math.sin(p.walk) * 1.5 : 0), a, pull);
    // Held javelin is carried behind the body; the hand grips it on top.
    this.javelinShape(gr.jx, gr.jy, a, 0.9, this.tipColor(), false);
    JJ.drawJohnny(ctx, look, x, y, { face: a, walk: p.walk, moving: p.moving, time, hand: { x: gr.gx, y: gr.gy } });
    JJ.drawJohnnyHand(ctx, look, gr.gx, gr.gy);

    // frenzy aura
    if (g.frenzyT > 0) {
      ctx.strokeStyle = `rgba(255,140,40,${0.5 + 0.3 * Math.sin(time * 20)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - 2, 24, 0, JJ.TAU);
      ctx.stroke();
    }

    // HP bar under Johnny
    const hpw = 34;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - hpw / 2, y + 20, hpw, 4);
    ctx.fillStyle = '#e8413a';
    ctx.fillRect(x - hpw / 2, y + 20, hpw * JJ.clamp(p.hp / g.stats.maxHp, 0, 1), 4);
  }

  tipColor() {
    const s = this.game.stats;
    if (s.zeus || s.chain) return '#ffe95c';
    if (s.burn) return '#ff8a2a';
    if (s.slow) return '#8ff0ff';
    if (s.explode) return '#ff5a3c';
    return '#dfe6ee';
  }

  javelinShape(x, y, ang, size, tip, trail, mega) {
    JJ.drawJavelin(this.ctx, x, y, ang, size, tip, trail, mega, JJ.Save.data.johnny);
  }

  drawProjectiles() {
    const tip = this.tipColor();
    for (const j of this.game.projectiles) {
      if (j.dead) continue;
      if (j.mega) {
        const { ctx } = this;
        ctx.fillStyle = 'rgba(255,200,60,0.18)';
        ctx.beginPath();
        ctx.arc(j.x, j.y, 26 * j.size * 0.5, 0, JJ.TAU);
        ctx.fill();
      }
      this.javelinShape(j.x, j.y, j.ang, j.size, j.mega ? '#fff3a0' : tip, true, j.mega);
    }
  }

  drawOrbit() {
    const tip = this.tipColor();
    const s = this.game.stats;
    for (const o of this.game.orbitPos) this.javelinShape(o.x, o.y, o.a, s.size, tip, true);
  }

  drawStrikeMarkers() {
    const { ctx } = this;
    for (const st of this.game.strikes) {
      if (st.t < 0) continue;
      const k = st.t / st.land;
      ctx.strokeStyle = `rgba(255,80,60,${0.3 + 0.5 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 30 * (1.4 - k * 0.6), 0, JJ.TAU);
      ctx.stroke();
    }
  }

  drawFallingJavelins() {
    const tip = this.tipColor();
    const s = this.game.stats;
    for (const st of this.game.strikes) {
      if (st.t < 0) continue;
      const k = st.t / st.land;
      const h = (1 - k) * 520;
      this.javelinShape(st.x + h * 0.25, st.y - h, Math.PI / 2 - 0.25, 1.2 * s.size, s.zeus ? '#ffe95c' : tip, true);
    }
  }

  drawVortexes(time) {
    const { ctx } = this;
    for (const v of this.game.vortexes) {
      const k = v.t / v.life;
      const r = v.r * (k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1);
      const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, Math.max(1, r));
      grad.addColorStop(0, 'rgba(10,0,20,0.95)');
      grad.addColorStop(0.35, 'rgba(70,20,120,0.6)');
      grad.addColorStop(1, 'rgba(120,60,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(v.x, v.y, Math.max(1, r), 0, JJ.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,150,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * JJ.TAU) / 3;
        ctx.beginPath();
        ctx.arc(v.x, v.y, r * 0.6, a, a + 1.2);
        ctx.stroke();
      }
    }
  }

  drawShots(time) {
    const { ctx } = this;
    for (const b of this.game.shots) {
      if (b.kind === 'arrow') {
        const c = Math.cos(b.ang), sn = Math.sin(b.ang);
        ctx.strokeStyle = '#8b6a3e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x - c * 16, b.y - sn * 16);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = '#d8d8d8';
        ctx.beginPath();
        ctx.moveTo(b.x + c * 5, b.y + sn * 5);
        ctx.lineTo(b.x - c * 2 - sn * 3, b.y - sn * 2 + c * 3);
        ctx.lineTo(b.x - c * 2 + sn * 3, b.y - sn * 2 - c * 3);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.7, 0, JJ.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, JJ.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.4, 0, JJ.TAU);
      ctx.fill();
    }
  }

  drawPickups(time) {
    const { ctx } = this;
    const sprites = JJ.Sprites.ready;
    for (const k of this.game.pickups) {
      if (k.dead) continue;
      const bob = Math.sin(k.t * 4) * 2;
      if (sprites && this.drawPickupSprite(ctx, k, bob, time)) continue;
      switch (k.type) {
        case 'gem': {
          const v = k.value;
          const color = v >= 50 ? '#c86bff' : v >= 10 ? '#ff4d6d' : v >= 3 ? '#4ddc6b' : '#4db8ff';
          const s = v >= 50 ? 9 : v >= 10 ? 7.5 : v >= 3 ? 6.5 : 5.5;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(k.x, k.y - s + bob);
          ctx.lineTo(k.x + s * 0.7, k.y + bob);
          ctx.lineTo(k.x, k.y + s + bob);
          ctx.lineTo(k.x - s * 0.7, k.y + bob);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(k.x - 1.5, k.y - s * 0.5 + bob, 2, 3);
          break;
        }
        case 'coin': {
          const w = Math.abs(Math.cos(k.t * 3)) * 6 + 1;
          ctx.fillStyle = '#e0a800';
          ctx.beginPath();
          ctx.ellipse(k.x, k.y + bob, w, 7, 0, 0, JJ.TAU);
          ctx.fill();
          ctx.fillStyle = '#ffd84d';
          ctx.beginPath();
          ctx.ellipse(k.x, k.y + bob, w * 0.65, 5, 0, 0, JJ.TAU);
          ctx.fill();
          break;
        }
        case 'chest': {
          const y = k.y + bob;
          ctx.fillStyle = 'rgba(255,215,0,0.25)';
          ctx.beginPath();
          ctx.arc(k.x, y, 26 + Math.sin(k.t * 5) * 4, 0, JJ.TAU);
          ctx.fill();
          ctx.fillStyle = '#8b4a1c';
          ctx.fillRect(k.x - 14, y - 8, 28, 18);
          ctx.fillStyle = '#a65a24';
          ctx.fillRect(k.x - 14, y - 14, 28, 8);
          ctx.fillStyle = '#ffd34d';
          ctx.fillRect(k.x - 14, y - 7, 28, 3);
          ctx.fillRect(k.x - 3, y - 6, 6, 7);
          break;
        }
        default: {
          const icon = { heart: '❤️', magnet: '🧲', frenzy: '🔥' }[k.type];
          ctx.font = '20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(icon, k.x, k.y + bob);
        }
      }
    }
  }

  drawPickupSprite(ctx, k, bob, time) {
    let name, size = 16, sx = 1;
    switch (k.type) {
      case 'gem': {
        const v = k.value;
        name = v >= 50 ? 'gem50' : v >= 10 ? 'gem10' : v >= 3 ? 'gem3' : 'gem1';
        size = v >= 50 ? 22 : v >= 10 ? 18 : v >= 3 ? 15 : 13;
        break;
      }
      case 'coin':
        name = 'coin';
        size = 14;
        sx = Math.max(0.15, Math.abs(Math.cos(k.t * 3)));
        break;
      case 'chest': name = 'chest'; size = 34; break;
      case 'heart': name = 'heart'; size = 20; break;
      case 'magnet': name = 'magnet'; size = 20; break;
      case 'frenzy': name = 'frenzy'; size = 22; break;
      default: return false;
    }
    const grounded = k.type === 'chest';
    // small ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(k.x, k.y + size * 0.45, size * 0.35, size * 0.12, 0, 0, JJ.TAU);
    ctx.fill();
    if (k.type === 'chest') {
      ctx.fillStyle = `rgba(255,215,0,${0.18 + 0.1 * Math.sin(k.t * 5)})`;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 26, 0, JJ.TAU);
      ctx.fill();
    }
    JJ.Sprites.draw(ctx, name, k.x, k.y + (grounded ? size * 0.45 : bob - 2), size, { sx, center: !grounded });
    // occasional sparkle on gems
    if (k.type === 'gem' && Math.sin(k.t * 3 + k.x) > 0.97) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(k.x + size * 0.15, k.y - size * 0.3 + bob, 2, 2);
    }
    return true;
  }

  drawEffects() {
    const { ctx } = this;
    for (const f of this.game.effects) {
      const k = f.t / f.life;
      if (f.type === 'boom') {
        ctx.fillStyle = `rgba(255,${Math.floor(200 - 120 * k)},40,${0.55 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.5 + 0.5 * k), 0, JJ.TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,240,180,${0.8 * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (f.type === 'ring') {
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, JJ.TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.type === 'dust') {
        ctx.fillStyle = `rgba(200,170,120,${0.45 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, JJ.TAU);
        ctx.fill();
      } else if (f.type === 'bolt') {
        ctx.globalAlpha = 1 - k;
        for (const [w, col] of [[6, 'rgba(120,190,255,0.6)'], [2, '#ffffff']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(f.pts[0].x, f.pts[0].y);
          for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  drawParticles() {
    const { ctx } = this;
    for (const q of this.game.particles) {
      ctx.globalAlpha = 1 - q.t / q.life;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  drawTexts() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    for (const t of this.game.texts) {
      ctx.globalAlpha = 1 - (t.t / t.life) ** 2;
      ctx.font = t.big ? 'bold 18px system-ui, sans-serif' : 'bold 13px system-ui, sans-serif';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // Screen-space overlays
  drawScreenFx(time) {
    const { ctx, game } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = this.w, h = this.h;

    // Vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (!game.player || game.state === 'idle') return;

    if (game.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,0,0,${game.hurtFlash * 0.6})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (game.frenzyT > 0) {
      ctx.strokeStyle = `rgba(255,120,30,${0.35 + 0.15 * Math.sin(time * 12)})`;
      ctx.lineWidth = 14;
      ctx.strokeRect(0, 0, w, h);
    }

    // Off-screen boss indicators
    const p = game.player;
    for (const b of game.bosses) {
      const dx = (b.x - p.x) * this.zoom, dy = (b.y - p.y) * this.zoom;
      if (Math.abs(dx) < w / 2 && Math.abs(dy) < h / 2) continue;
      const a = Math.atan2(dy, dx);
      const ex = JJ.clamp(w / 2 + Math.cos(a) * w, 30, w - 30);
      const ey = JJ.clamp(h / 2 + Math.sin(a) * h, 60, h - 30);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Virtual joystick
    const st = JJ.Input.stick;
    if (st.active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, 50, 0, JJ.TAU);
      ctx.stroke();
      const dx = st.x - st.ox, dy = st.y - st.oy;
      const d = Math.min(50, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(st.ox + Math.cos(a) * d, st.oy + Math.sin(a) * d, 22, 0, JJ.TAU);
      ctx.fill();
    }
  }
};
