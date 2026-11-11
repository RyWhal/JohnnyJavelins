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
      this.menuCam.x += dt * 30;
      this.menuCam.y += dt * 12;
      cx = this.menuCam.x;
      cy = this.menuCam.y;
    }

    let sx = 0, sy = 0;
    if (live && game.shake > 0 && JJ.Save.data.settings.shake) {
      sx = JJ.rand(-game.shake, game.shake);
      sy = JJ.rand(-game.shake, game.shake);
    }

    const z = this.zoom * this.dpr;
    const ox = this.dpr * (this.w / 2 + sx) - cx * z;
    const oy = this.dpr * (this.h / 2 + sy) - cy * z;
    ctx.setTransform(z, 0, 0, z, ox, oy);

    // Mouse in world space (for mouse aim)
    const m = JJ.Input.mouse;
    game.mouseWorld = { x: (m.x - this.w / 2) / this.zoom + cx, y: (m.y - this.h / 2) / this.zoom + cy };

    this.drawGround(cx, cy, time);
    if (!live) return this.drawScreenFx(time);

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
    this.drawTexts();
    this.drawScreenFx(time);
  }

  // ------------------------------------------------------------- ground
  drawGround(cx, cy, time) {
    const { ctx } = this;
    const g = this.game;
    const hw = g.viewW / 2 + 40, hh = g.viewH / 2 + 40;
    ctx.fillStyle = '#3d6b35';
    ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    const T = 96;
    const x0 = Math.floor((cx - hw) / T), x1 = Math.floor((cx + hw) / T);
    const y0 = Math.floor((cy - hh) / T), y1 = Math.floor((cy + hh) / T);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const h = JJ.hash2(ix, iy);
        const x = ix * T, y = iy * T;
        // Large, soft patches of lighter / darker grass
        const patch = JJ.hash2(Math.floor(ix / 4), Math.floor(iy / 4));
        if (patch < 0.3) {
          ctx.fillStyle = 'rgba(0,0,0,0.035)';
          ctx.fillRect(x, y, T, T);
        } else if (patch > 0.8) {
          ctx.fillStyle = 'rgba(255,255,160,0.03)';
          ctx.fillRect(x, y, T, T);
        }
        const dx = x + JJ.hash2(ix + 7, iy) * (T - 20) + 10;
        const dy = y + JJ.hash2(ix, iy + 13) * (T - 20) + 10;
        if (h < 0.35) {
          ctx.strokeStyle = '#4f8a43';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let k = -1; k <= 1; k++) {
            ctx.moveTo(dx + k * 4, dy);
            ctx.lineTo(dx + k * 6, dy - 9 - Math.abs(k) * -2);
          }
          ctx.stroke();
        } else if (h < 0.42) {
          const colors = ['#f6e05e', '#f78fb3', '#ffffff', '#9ad0ff'];
          ctx.fillStyle = colors[Math.floor(JJ.hash2(ix, iy + 99) * 4)];
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(dx + k * 9 - 9, dy + (k % 2) * 6, 2.5, 0, JJ.TAU);
            ctx.fill();
          }
        } else if (h < 0.45) {
          ctx.fillStyle = '#7d7f7a';
          ctx.beginPath();
          ctx.ellipse(dx, dy, 11, 8, 0, 0, JJ.TAU);
          ctx.fill();
          ctx.fillStyle = '#9a9c96';
          ctx.beginPath();
          ctx.ellipse(dx - 3, dy - 2, 6, 4, 0, 0, JJ.TAU);
          ctx.fill();
        } else if (h < 0.46) {
          // Old javelin stuck in the ground. Johnny was here before.
          ctx.strokeStyle = '#8b6a3e';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(dx + 10, dy - 26);
          ctx.stroke();
        } else if (h < 0.47) {
          ctx.fillStyle = '#c94a3a';
          ctx.beginPath();
          ctx.arc(dx, dy - 4, 6, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#eee';
          ctx.fillRect(dx - 2, dy - 4, 4, 6);
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
    const faceRight = Math.cos(p.face) >= 0;
    const bob = p.moving ? Math.sin(p.walk) * 1.5 : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 12, 5, 0, 0, JJ.TAU);
    ctx.fill();

    // legs
    ctx.fillStyle = '#5b3a1e';
    const leg = p.moving ? Math.sin(p.walk) * 4 : 0;
    ctx.fillRect(x - 6, y + 4 + leg * 0.5, 4, 10 - leg * 0.5);
    ctx.fillRect(x + 2, y + 4 - leg * 0.5, 4, 10 + leg * 0.5);

    // tunic
    ctx.fillStyle = '#2f7fc1';
    ctx.beginPath();
    ctx.ellipse(x, y + bob, 10, 11, 0, 0, JJ.TAU);
    ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 10, y + 3 + bob, 20, 3);

    // head
    const hy = y - 13 + bob;
    ctx.fillStyle = '#f2c79a';
    ctx.beginPath();
    ctx.arc(x, hy, 8, 0, JJ.TAU);
    ctx.fill();
    // hair
    ctx.fillStyle = '#6b3d1a';
    ctx.beginPath();
    ctx.arc(x, hy - 2, 8, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    // headband + tails
    ctx.fillStyle = '#d6322b';
    ctx.fillRect(x - 8, hy - 4, 16, 3);
    const tailX = faceRight ? x - 8 : x + 8;
    const sway = Math.sin(time * 10) * 2;
    ctx.beginPath();
    ctx.moveTo(tailX, hy - 4);
    ctx.lineTo(tailX + (faceRight ? -9 : 9), hy - 1 + sway);
    ctx.lineTo(tailX + (faceRight ? -8 : 8), hy + 2 + sway);
    ctx.closePath();
    ctx.fill();
    // eyes
    ctx.fillStyle = '#222';
    const ex = Math.cos(p.face) * 3;
    const ey = Math.sin(p.face) * 1.5;
    ctx.fillRect(x - 3.5 + ex, hy - 1 + ey, 2, 2.5);
    ctx.fillRect(x + 1.5 + ex, hy - 1 + ey, 2, 2.5);

    // held javelin
    const pull = p.throwAnim > 0 ? -10 * (p.throwAnim / 0.15) : 0;
    const a = p.face;
    const hx = x + Math.cos(a) * (6 + pull), hyy = y - 4 + Math.sin(a) * (6 + pull);
    this.javelinShape(hx, hyy, a, 0.9, this.tipColor(), false);

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
    const { ctx } = this;
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
    // shaft
    ctx.strokeStyle = mega ? '#ffcf3f' : '#c9a066';
    ctx.lineWidth = 2.6 * size;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx - c * 6 * size, ty - s * 6 * size);
    ctx.stroke();
    // tip
    const px = -s, py = c;
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.moveTo(tx + c * 3 * size, ty + s * 3 * size);
    ctx.lineTo(tx - c * 7 * size + px * 3.5 * size, ty - s * 7 * size + py * 3.5 * size);
    ctx.lineTo(tx - c * 7 * size - px * 3.5 * size, ty - s * 7 * size - py * 3.5 * size);
    ctx.closePath();
    ctx.fill();
    // fletching
    ctx.fillStyle = mega ? '#ff4a2a' : '#d6322b';
    ctx.beginPath();
    ctx.moveTo(bx + c * 7 * size, by + s * 7 * size);
    ctx.lineTo(bx + px * 4 * size, by + py * 4 * size);
    ctx.lineTo(bx - px * 4 * size, by - py * 4 * size);
    ctx.closePath();
    ctx.fill();
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
    for (const k of this.game.pickups) {
      if (k.dead) continue;
      const bob = Math.sin(k.t * 4) * 2;
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
