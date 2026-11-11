// Core simulation: Johnny, javelins, monsters, pickups and progression.
'use strict';

JJ.PROJECTILE_CAP = 2600;
JJ.ENEMY_CAP = 430;

JJ.Game = class Game {
  constructor(ui) {
    this.ui = ui;
    this.grid = new JJ.SpatialGrid(64);
    this.state = 'idle';
    this.viewW = 1280;
    this.viewH = 720;
    this.mouseWorld = null;
  }

  // ------------------------------------------------------------------ setup
  start() {
    const S = JJ.Save;
    this.t = 0;
    this.state = 'playing';
    this.nextId = 1;
    this.player = {
      x: 0, y: 0, r: 14, hp: 1, face: 0, inv: 0,
      level: 1, xp: 0, xpNext: this.xpFor(1), walk: 0, moving: false, throwAnim: 0,
    };
    this.enemies = [];
    this.projectiles = [];
    this.shots = [];
    this.pickups = [];
    this.effects = [];
    this.particles = [];
    this.texts = [];
    this.strikes = [];
    this.vortexes = [];
    this.orbitPos = [];
    this.upgrades = new Map();
    this.order = [];
    this.stats = null;
    this.computeStats();
    this.player.hp = this.stats.maxHp;

    this.throwTimer = 0.4;
    this.novaTimer = 2;
    this.rainTimer = 1.5;
    this.orbitAngle = 0;
    this.volley = 0;
    this.spawnTimer = 0;
    this.eventIdx = 0;
    this.eliteTimer = 50;
    this.gemCount = 0;

    this.kills = 0;
    this.gold = 0;
    this.bossKills = 0;
    this.rerolls = S.metaLevel('reroll');
    this.revive = S.metaLevel('phoenix') > 0;
    this.pendingLevels = 0;
    this.pendingChests = [];
    this.bosses = [];
    this.frenzyT = 0;
    this.shake = 0;
    this.hurtFlash = 0;
    this.legendaries = [];
    this.won = false;
    this.director = 1;
    this.directorTimer = 0;
    this.dpsAcc = 0;
    this.dpsEMA = 0;
    this.bossDmgAcc = 0;
    this.bossDpsEMA = 0;
    this.lastBossDps = 0;
    this.decals = [];
    this.biome = 'meadow';
    this.biomeTimer = 0;
  }

  xpFor(level) {
    return Math.round(3 + 3 * level + 0.5 * level * level + 0.012 * level * level * level);
  }

  computeStats() {
    const m = (id) => JJ.Save.metaLevel(id);
    const s = {
      maxHp: 100 + 10 * m('toughness'),
      regen: 0.2 * m('recovery'),
      speed: 200 * (1 + 0.05 * m('fleet')),
      pickup: 110 * (1 + 0.15 * m('magnet')),
      armor: m('armor'),
      dmg: 12 * (1 + 0.08 * m('might')),
      interval: 0.7 / (1 + 0.06 * m('haste')),
      count: 1 + m('extraArm'),
      pierce: 3,
      jspeed: 540,
      range: 520,
      size: 1,
      bounce: 0,
      split: 0,
      splitDepth: 1,
      explode: 0,
      explodeDmg: 0,
      burn: 0,
      burnSpread: false,
      chain: 0,
      chainChance: 0,
      chainDmg: 0,
      slow: 0,
      freeze: 0,
      homing: 0,
      boomerang: 0,
      dirs: 1,
      orbit: 0,
      rain: 0,
      nova: 0,
      novaInterval: 4,
      crit: 0.05,
      critMult: 2,
      xpMult: 1 + 0.08 * m('growth'),
      goldMult: 1 + 0.1 * m('greed'),
      choices: 3 + m('insight'),
      thousand: false,
      singularity: false,
      zeus: false,
      mega: false,
      hellfire: false,
    };
    // Apply in definition order so legendaries (defined last) see final values.
    for (const u of JJ.UPGRADES) {
      const lvl = this.upgrades.get(u.id);
      if (lvl) u.apply(s, lvl);
    }
    const old = this.stats;
    this.stats = s;
    if (old && s.maxHp > old.maxHp) this.player.hp += s.maxHp - old.maxHp;
    if (this.player) this.player.hp = Math.min(this.player.hp, s.maxHp);
  }

  // ------------------------------------------------------------------ loop
  update(dt) {
    if (this.state !== 'playing') return;
    this.t += dt;
    const p = this.player;
    const s = this.stats;

    this.updatePlayer(dt);
    this.biomeTimer -= dt;
    if (this.biomeTimer <= 0) {
      this.biomeTimer = 0.5;
      const b = JJ.World.biomeAt(p.x, p.y);
      if (b !== this.biome) {
        this.biome = b;
        this.ui.toast(`Entering ${JJ.BIOMES[b].name}`, 2.5);
      }
    }
    for (const dc of this.decals) {
      dc.t += dt;
      if (dc.t > dc.life) dc.dead = true;
    }

    // Spatial index of monsters for this frame
    this.grid.clear();
    for (const e of this.enemies) if (!e.dead) this.grid.insert(e);

    this.updateSpawning(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateVortexes(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.updateFx(dt);

    JJ.compact(this.enemies);
    JJ.compact(this.projectiles);
    JJ.compact(this.shots);
    JJ.compact(this.pickups);
    JJ.compact(this.effects);
    JJ.compact(this.particles);
    JJ.compact(this.texts);
    JJ.compact(this.strikes);
    JJ.compact(this.vortexes);
    JJ.compact(this.decals);
    this.bosses = this.bosses.filter((b) => !b.dead);

    if (p.hp < s.maxHp) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);

    if (this.state === 'playing') {
      if (this.pendingLevels > 0) this.openLevelUp();
      else if (this.pendingChests.length) this.openChest();
    }
  }

  updatePlayer(dt) {
    const p = this.player, s = this.stats;
    const mv = JJ.Input.moveVector();
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.x += mv.x * s.speed * dt;
      p.y += mv.y * s.speed * dt;
      p.face = Math.atan2(mv.y, mv.x);
      p.walk += dt * 12;
    }
    p.inv -= dt;
    p.throwAnim = Math.max(0, p.throwAnim - dt);
    this.frenzyT = Math.max(0, this.frenzyT - dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
  }

  // ------------------------------------------------------------------ spawning
  spawnPoint(ahead = false) {
    const p = this.player;
    let a = Math.random() * JJ.TAU;
    if (ahead && p.moving) a = p.face + JJ.rand(-0.9, 0.9);
    const d = Math.hypot(this.viewW, this.viewH) / 2 + JJ.rand(30, 90);
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
  }

  // Base time scaling for regular monsters (the director multiplies on top).
  timeHpScale() {
    const min = this.t / 60;
    return 1 + 0.12 * min + 0.13 * min * min;
  }

  spawnEnemy(type, x, y, opts = {}) {
    const d = JJ.ENEMIES[type];
    const min = this.t / 60;
    const elite = !!opts.elite;
    const dir = this.director;
    let hp;
    if (d.boss) {
      // Bosses: a floor from their base HP, raised to match Johnny's real
      // damage output so the fight lasts roughly `d.fight` seconds.
      const floor = d.hp * (1 + this.t / 240) * Math.pow(dir, 0.6);
      // Size the fight from the damage Johnny has actually been dealing to
      // bosses (adapts to how he plays); before any boss data, assume bosses
      // soak ~5% of total damage (the rest is splash on the horde).
      // Scale by how much stronger Johnny has grown since that was measured.
      const growth = this.lastBossDps > 0 ? JJ.clamp(this.dpsEMA / this.lastBossDps, 1, 4) : 1;
      const est = this.bossDpsEMA > 0 ? this.bossDpsEMA * growth * 1.2 : this.dpsEMA * 0.05;
      hp = Math.max(floor, est * d.fight);
    } else {
      hp = d.hp * this.timeHpScale() * dir * (elite ? 10 : 1);
    }
    const dmgScale = (1 + min * 0.07) * Math.min(1.6, Math.pow(dir, 0.25));
    const e = {
      id: this.nextId++, type, x, y, draw: d.draw,
      r: d.r * (elite ? 1.5 : 1),
      hp,
      speed: d.speed * (elite ? 0.95 : 1) * (d.boss ? 1 : JJ.rand(0.9, 1.1)),
      dmg: d.dmg * (elite ? 1.5 : 1) * dmgScale,
      xp: d.xp * (elite ? 10 : 1) * Math.pow(dir, 0.25),
      color: d.color, boss: d.boss || false, ranged: d.ranged || null, elite,
      shotDmg: (d.shot || (d.ranged && d.ranged.dmg) || 0) * dmgScale,
      kx: 0, ky: 0, flash: 0,
      slowT: 0, slowAmt: 0, frozenT: 0,
      burnT: 0, burnDps: 0, burnTick: 0,
      orbitCD: 0, vortexCD: 0,
      aiT: JJ.rand(1, 3), chargeT: 0, windupT: 0, chargeDir: 0, chargeSpd: 0,
      spiralT: 0, spiralAcc: 0, spiralA: 0, spiral: null,
      dash: null,
      invuln: !!d.boss,
    };
    if (d.patterns) e.timers = d.patterns.map((pt, i) => pt.every * (0.5 + 0.2 * i));
    e.maxHp = e.hp;
    this.enemies.push(e);
    if (e.boss) this.bosses.push(e);
    return e;
  }

  // Adaptive difficulty: if Johnny keeps the screen clear, monsters get
  // tougher until the horde starts to build up again.
  updateDirector(dt) {
    this.directorTimer += dt;
    if (this.directorTimer < 1) return;
    this.directorTimer -= 1;
    this.dpsEMA = this.dpsEMA * 0.88 + this.dpsAcc * 0.12;
    this.dpsAcc = 0;
    // Boss damage rate, only sampled while a boss is actually fightable.
    if (this.bosses.some((b) => !b.dead && !b.invuln)) {
      this.bossDpsEMA = this.bossDpsEMA > 0 ? this.bossDpsEMA * 0.85 + this.bossDmgAcc * 0.15 : this.bossDmgAcc;
      this.lastBossDps = this.dpsEMA;
    }
    this.bossDmgAcc = 0;
    if (this.t < 150) return;
    const min = this.t / 60;
    let alive = 0;
    for (const e of this.enemies) if (!e.dead && !e.boss) alive++;
    const target = Math.min(JJ.ENEMY_CAP * 0.8, 30 + 24 * min);
    const ratio = alive / target;
    if (ratio < 0.35) this.director *= 1.02;
    else if (ratio < 0.6) this.director *= 1.007;
    else if (ratio > 1) this.director *= 0.98;
    this.director = JJ.clamp(this.director, 1, 500);
  }

  pickSpawnType() {
    const wave = JJ.waveAt(this.t);
    const fav = JJ.BIOMES[this.biome].favored;
    const w = {};
    for (const k in wave.types) w[k] = wave.types[k] * (fav[k] || 1);
    return JJ.weightedKey(w);
  }

  updateSpawning(dt) {
    const min = this.t / 60;
    this.updateDirector(dt);

    // Scripted events
    while (this.eventIdx < JJ.EVENTS.length && this.t >= JJ.EVENTS[this.eventIdx].t) {
      this.runEvent(JJ.EVENTS[this.eventIdx++]);
    }

    // Elites
    this.eliteTimer -= dt;
    if (this.eliteTimer <= 0) {
      this.eliteTimer = 40;
      const pt = this.spawnPoint(true);
      this.spawnEnemy(this.pickSpawnType(), pt.x, pt.y, { elite: true });
    }

    // Steady trickle, ramping up hard (and a bit harder when Johnny is cruising)
    const rate = (0.8 + 0.8 * min + 0.1 * min * min) * Math.min(1.6, Math.pow(this.director, 0.15));
    this.spawnTimer -= dt;
    while (this.spawnTimer <= 0) {
      this.spawnTimer += 1 / rate;
      if (this.enemies.length >= JJ.ENEMY_CAP) continue;
      const pt = this.spawnPoint(Math.random() < 0.35);
      this.spawnEnemy(this.pickSpawnType(), pt.x, pt.y);
    }
  }

  runEvent(ev) {
    const p = this.player;
    const d = Math.hypot(this.viewW, this.viewH) / 2 + 40;
    if (ev.type === 'swarm') {
      this.ui.toast(`A horde of ${JJ.ENEMIES[ev.enemy].name}s surrounds you!`);
      for (let i = 0; i < ev.count; i++) {
        const a = (i / ev.count) * JJ.TAU;
        this.spawnEnemy(ev.enemy, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      }
    } else if (ev.type === 'stampede') {
      this.ui.toast('STAMPEDE!');
      const a = Math.random() * JJ.TAU;
      const dirX = -Math.cos(a), dirY = -Math.sin(a);
      const cx = p.x + Math.cos(a) * d, cy = p.y + Math.sin(a) * d;
      for (let i = 0; i < ev.count; i++) {
        const off = (i - ev.count / 2) * 28;
        const e = this.spawnEnemy(ev.enemy, cx - dirY * off + JJ.rand(-30, 30), cy + dirX * off + JJ.rand(-30, 30));
        e.dash = { vx: dirX * 300, vy: dirY * 300, t: 7 };
      }
    } else if (ev.type === 'boss') {
      // Spawn just off screen; bosses are shielded until they're in view.
      const a = Math.random() * JJ.TAU;
      const b = this.spawnEnemy(ev.enemy, p.x + Math.cos(a) * this.viewW * 0.6, p.y + Math.sin(a) * this.viewH * 0.6);
      const major = JJ.ENEMIES[ev.enemy].boss === 'major';
      this.ui.toast(`${major ? '⚠️ ' : '👑 '}${JJ.ENEMIES[ev.enemy].name} approaches!${major ? ' ⚠️' : ''}`, 4);
      JJ.Audio.sfx.boss();
      this.shake = major ? 12 : 6;
      return b;
    }
  }

  // ------------------------------------------------------------------ weapons
  nearestEnemy(x, y, maxD, exclude) {
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (e.dead || e.invuln || (exclude && exclude.has(e.id))) continue;
      const d = JJ.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  nearestInGrid(x, y, maxD, exclude) {
    let best = null, bd = maxD * maxD;
    this.grid.each(x, y, maxD, (e) => {
      if (e.dead || e.invuln || (exclude && exclude.has(e.id))) return;
      const d = JJ.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }

  aimAngle() {
    const p = this.player;
    const set = JJ.Save.data.settings;
    if (set.aim === 'mouse' && this.mouseWorld && JJ.Input.mouse.active) {
      return Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x);
    }
    const target = this.nearestEnemy(p.x, p.y, 650);
    if (target) {
      // Lead the target a little.
      const tt = Math.sqrt(JJ.dist2(p.x, p.y, target.x, target.y)) / this.stats.jspeed;
      const dx = target.x + (target.vx || 0) * tt - p.x;
      const dy = target.y + (target.vy || 0) * tt - p.y;
      return Math.atan2(dy, dx);
    }
    return p.face;
  }

  updateWeapons(dt) {
    const s = this.stats, p = this.player;

    this.throwTimer -= dt;
    if (this.throwTimer <= 0) {
      this.throwTimer += s.interval * (this.frenzyT > 0 ? 0.33 : 1);
      if (this.throwTimer < 0) this.throwTimer = 0;
      this.throwVolley();
    }

    if (s.nova) {
      this.novaTimer -= dt;
      if (this.novaTimer <= 0) {
        this.novaTimer = s.novaInterval;
        const n = s.nova * (s.thousand ? 2 : 1);
        const off = Math.random() * JJ.TAU;
        for (let i = 0; i < n; i++) this.spawnJav(p.x, p.y, off + (i / n) * JJ.TAU, { dmgMul: 0.8 });
        this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 60, t: 0, life: 0.3, color: '#ffe680' });
        JJ.Audio.sfx.throw();
      }
    }

    if (s.rain) {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this.rainTimer = 2.2;
        this.callRain(s.rain * (s.zeus ? 2 : 1));
      }
    }

    // Orbiting halo
    this.orbitPos.length = 0;
    if (s.orbit) {
      this.orbitAngle += dt * 3.2;
      const n = s.orbit;
      const R = 70 + 14 * s.size;
      const hr = 12 * s.size;
      for (let i = 0; i < n; i++) {
        const a = this.orbitAngle + (i / n) * JJ.TAU;
        const ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
        this.orbitPos.push({ x: ox, y: oy, a: a + Math.PI / 2 });
        this.grid.each(ox, oy, hr, (e) => {
          if (e.dead || e.orbitCD > 0) return;
          const rr = e.r + hr;
          if (JJ.dist2(ox, oy, e.x, e.y) < rr * rr) {
            e.orbitCD = 0.3;
            const crit = Math.random() < s.crit;
            this.damageEnemy(e, s.dmg * 0.9 * (crit ? s.critMult : 1), crit, Math.cos(a) * 200, Math.sin(a) * 200);
            this.applyStatus(e, s.dmg);
          }
        });
      }
    }
  }

  throwVolley() {
    const s = this.stats, p = this.player;
    const aim = this.aimAngle();
    const n = s.count * (s.thousand ? 2 : 1);
    const step = n > 1 ? Math.min(0.13, 1.7 / (n - 1)) : 0;
    const dirs = [[0], [0, Math.PI], [0, Math.PI / 2, Math.PI, -Math.PI / 2],
      [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -(3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4]][
      { 1: 0, 2: 1, 4: 2, 8: 3 }[s.dirs]
    ];
    for (const off of dirs) {
      for (let i = 0; i < n; i++) {
        const a = aim + off + (i - (n - 1) / 2) * step;
        this.spawnJav(p.x, p.y, a, {});
      }
    }
    this.volley++;
    if (s.mega && this.volley % 4 === 0) {
      this.spawnJav(p.x, p.y, aim, { mega: true, sizeMul: 4, dmgMul: 10, spdMul: 0.75, lifeMul: 1.6, pierce: Infinity });
      this.shake = Math.max(this.shake, 6);
    }
    p.throwAnim = 0.15;
    p.face = aim;
    JJ.Audio.sfx.throw();
  }

  spawnJav(x, y, ang, o) {
    if (this.projectiles.length >= JJ.PROJECTILE_CAP) return null;
    const s = this.stats;
    const spd = s.jspeed * (o.spdMul || 1);
    const life = (s.range / s.jspeed) * (o.lifeMul || 1);
    const j = {
      x, y, ang, spd,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      dmg: s.dmg * (o.dmgMul || 1),
      pierce: o.pierce !== undefined ? o.pierce : s.pierce,
      bounces: o.bounces !== undefined ? o.bounces : s.bounce,
      size: s.size * (o.sizeMul || 1),
      life, maxLife: life,
      hit: o.hit || new Set(),
      depth: o.depth || 0,
      didSplit: false,
      returning: false,
      mega: !!o.mega,
      target: null,
      retarget: 0,
      boomerang: s.boomerang > 0 && !o.noReturn,
    };
    this.projectiles.push(j);
    return j;
  }

  updateProjectiles(dt) {
    const s = this.stats, p = this.player;
    for (let idx = 0; idx < this.projectiles.length; idx++) {
      const j = this.projectiles[idx];
      if (j.dead) continue;
      j.life -= dt;

      if (j.returning) {
        const dx = p.x - j.x, dy = p.y - j.y;
        const d = Math.hypot(dx, dy);
        if (d < 26 || j.life < -4) { j.dead = true; continue; }
        const sp = j.spd * 1.25;
        j.vx = (dx / d) * sp;
        j.vy = (dy / d) * sp;
        j.ang = Math.atan2(dy, dx);
      } else {
        if (s.homing && !j.mega) {
          j.retarget -= dt;
          if (j.retarget <= 0 || !j.target || j.target.dead) {
            j.retarget = 0.15;
            j.target = this.nearestInGrid(j.x, j.y, 260, j.hit);
          }
          if (j.target && !j.target.dead) {
            const want = Math.atan2(j.target.y - j.y, j.target.x - j.x);
            const diff = JJ.angleDiff(j.ang, want);
            const turn = (2 + 2.2 * s.homing) * dt;
            j.ang += JJ.clamp(diff, -turn, turn);
            j.vx = Math.cos(j.ang) * j.spd;
            j.vy = Math.sin(j.ang) * j.spd;
          }
        }
        if (j.life <= 0) {
          if (j.boomerang) {
            j.returning = true;
            j.hit.clear();
            j.pierce = Infinity;
            j.dmg *= 1 + 0.3 * (s.boomerang - 1);
          } else {
            j.dead = true;
            continue;
          }
        }
      }

      j.x += j.vx * dt;
      j.y += j.vy * dt;

      const hr = 7 * j.size;
      j.redirected = false;
      this.grid.each(j.x, j.y, hr, (e) => {
        if (e.dead || e.invuln || j.hit.has(e.id)) return;
        const rr = e.r + hr;
        if (JJ.dist2(j.x, j.y, e.x, e.y) < rr * rr) {
          this.hitEnemy(j, e);
          if (j.dead || j.redirected) return false;
        }
      });
    }
  }

  hitEnemy(j, e) {
    const s = this.stats;
    j.hit.add(e.id);
    const crit = Math.random() < s.crit;
    const dmg = j.dmg * (crit ? s.critMult : 1);
    const kb = e.boss ? 0 : (j.mega ? 400 : 110) / Math.max(1, e.r / 12);
    this.damageEnemy(e, dmg, crit, Math.cos(j.ang) * kb, Math.sin(j.ang) * kb);
    this.applyStatus(e, j.dmg);
    JJ.Audio.sfx.hit();

    if (s.explode) this.explode(e.x, e.y, s.explode * Math.sqrt(j.size), dmg * s.explodeDmg);
    if (s.chain && Math.random() < s.chainChance) this.chainLightning(e, s.chain, dmg * s.chainDmg);

    if (s.split && !j.didSplit && j.depth < s.splitDepth && !j.mega) {
      j.didSplit = true;
      const n = s.split;
      for (let i = 0; i < n; i++) {
        const a = j.ang + (n > 1 ? (i / (n - 1) - 0.5) * 1.4 : 0) + JJ.rand(-0.1, 0.1);
        const c = this.spawnJav(e.x, e.y, a, {
          dmgMul: 0.6 * (j.dmg / s.dmg),
          sizeMul: (j.size / s.size) * 0.75,
          lifeMul: 0.6,
          depth: j.depth + 1,
          pierce: Math.max(1, Math.floor(s.pierce / 2)),
          bounces: Math.floor(s.bounce / 2),
          noReturn: true,
          hit: new Set([e.id]),
        });
        if (c) c.dmg = j.dmg * 0.6;
      }
    }

    j.pierce--;
    if (j.pierce <= 0) {
      if (j.bounces > 0) {
        const next = this.nearestInGrid(e.x, e.y, 320, j.hit);
        if (next) {
          j.bounces--;
          j.pierce = 1;
          j.ang = Math.atan2(next.y - j.y, next.x - j.x);
          j.vx = Math.cos(j.ang) * j.spd;
          j.vy = Math.sin(j.ang) * j.spd;
          j.life = Math.max(j.life, 0.6);
          j.redirected = true;
          return;
        }
      }
      j.dead = true;
    }
  }

  applyStatus(e, baseDmg) {
    const s = this.stats;
    if (s.burn) {
      e.burnT = 3;
      e.burnDps = Math.max(e.burnDps, baseDmg * s.burn);
    }
    if (s.slow) {
      e.slowT = 2;
      e.slowAmt = s.slow;
      if (s.freeze && !e.boss && Math.random() < s.freeze) e.frozenT = 1.2;
    }
  }

  damageEnemy(e, dmg, crit, kx = 0, ky = 0, color) {
    if (e.dead) return;
    if (e.invuln) {
      e.flash = 0.03;
      return;
    }
    this.dpsAcc += Math.min(dmg, e.hp);
    if (e.boss) this.bossDmgAcc += Math.min(dmg, e.hp);
    e.hp -= dmg;
    e.flash = 0.07;
    if (kx || ky) {
      e.kx += kx;
      e.ky += ky;
    }
    if (JJ.Save.data.settings.damageNumbers && this.texts.length < 140) {
      this.texts.push({
        x: e.x + JJ.rand(-8, 8), y: e.y - e.r, vy: -60, t: 0, life: crit ? 0.8 : 0.55,
        text: JJ.formatNum(dmg), color: color || (crit ? '#ffdd33' : '#ffffff'), big: crit,
      });
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  explode(x, y, r, dmg) {
    const s = this.stats;
    if (this.effects.length < 220) this.effects.push({ type: 'boom', x, y, r, t: 0, life: 0.3 });
    this.grid.each(x, y, r, (e) => {
      if (e.dead) return;
      const rr = r + e.r;
      if (JJ.dist2(x, y, e.x, e.y) < rr * rr) {
        this.damageEnemy(e, dmg, false, 0, 0, '#ffaa55');
        if (s.hellfire) {
          e.burnT = 3;
          e.burnDps = Math.max(e.burnDps, s.dmg * Math.max(0.6, s.burn));
        }
      }
    });
    if (s.singularity && this.vortexes.length < 8) {
      this.vortexes.push({ x, y, r: r * 1.9, t: 0, life: 1.5, dps: dmg * 1.2 });
    }
    this.shake = Math.max(this.shake, 2.5);
    JJ.Audio.sfx.boom();
  }

  chainLightning(from, n, dmg) {
    const hit = new Set([from.id]);
    let cur = from;
    const pts = [{ x: from.x, y: from.y }];
    for (let k = 0; k < n; k++) {
      const next = this.nearestInGrid(cur.x, cur.y, 190, hit);
      if (!next) break;
      hit.add(next.id);
      pts.push({ x: next.x, y: next.y });
      this.damageEnemy(next, dmg, false, 0, 0, '#9fdcff');
      cur = next;
    }
    if (pts.length > 1 && this.effects.length < 220) {
      this.effects.push({ type: 'bolt', pts: this.jagged(pts), t: 0, life: 0.18 });
      JJ.Audio.sfx.zap();
    }
  }

  jagged(pts) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        const jitter = k === 4 ? 0 : 12;
        out.push({ x: JJ.lerp(a.x, b.x, t) + JJ.rand(-jitter, jitter), y: JJ.lerp(a.y, b.y, t) + JJ.rand(-jitter, jitter) });
      }
    }
    return out;
  }

  callRain(n) {
    const p = this.player;
    const hw = this.viewW / 2, hh = this.viewH / 2;
    const visible = this.enemies.filter((e) => !e.dead && !e.invuln && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh);
    for (let i = 0; i < n; i++) {
      let x, y;
      if (visible.length) {
        const e = JJ.choice(visible);
        x = e.x + JJ.rand(-15, 15);
        y = e.y + JJ.rand(-15, 15);
      } else {
        x = p.x + JJ.rand(-hw, hw) * 0.8;
        y = p.y + JJ.rand(-hh, hh) * 0.8;
      }
      this.strikes.push({ x, y, t: -i * 0.05, land: 0.45 });
    }
  }

  updateStrikes(dt) {
    const s = this.stats;
    for (const st of this.strikes) {
      st.t += dt;
      if (st.t < st.land) continue;
      st.dead = true;
      const r = 48 * Math.sqrt(s.size);
      const crit = Math.random() < s.crit;
      const dmg = s.dmg * 1.6 * (crit ? s.critMult : 1);
      this.grid.each(st.x, st.y, r, (e) => {
        if (e.dead) return;
        const rr = r + e.r;
        if (JJ.dist2(st.x, st.y, e.x, e.y) < rr * rr) {
          this.damageEnemy(e, dmg, crit);
          this.applyStatus(e, s.dmg);
        }
      });
      if (this.effects.length < 220) this.effects.push({ type: 'dust', x: st.x, y: st.y, r, t: 0, life: 0.35 });
      if (s.zeus) {
        const target = this.nearestInGrid(st.x, st.y, 120);
        if (target) {
          this.effects.push({ type: 'bolt', pts: this.jagged([{ x: st.x, y: st.y - 600 }, { x: st.x, y: st.y }]), t: 0, life: 0.15 });
          this.chainLightning(target, 4, s.dmg * 1.2);
        }
      }
      if (s.explode) this.explode(st.x, st.y, s.explode, dmg * s.explodeDmg);
    }
  }

  updateVortexes(dt) {
    for (const v of this.vortexes) {
      v.t += dt;
      if (v.t >= v.life) { v.dead = true; continue; }
      this.grid.each(v.x, v.y, v.r, (e) => {
        if (e.dead) return;
        const dx = v.x - e.x, dy = v.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d > v.r + e.r) return;
        if (!e.boss && d > 4) {
          const pull = (260 * (1 - d / (v.r + e.r)) + 50) * dt;
          e.x += (dx / d) * pull;
          e.y += (dy / d) * pull;
        }
        e.vortexCD -= dt;
        if (e.vortexCD <= 0) {
          e.vortexCD = 0.25;
          this.damageEnemy(e, v.dps * 0.25, false, 0, 0, '#c58bff');
        }
      });
    }
  }

  // ------------------------------------------------------------------ monsters
  updateEnemies(dt) {
    const p = this.player;
    const farD = Math.max(this.viewW, this.viewH) * 0.9 + 250;
    const decay = Math.exp(-9 * dt);
    const hw = this.viewW / 2, hh = this.viewH / 2;

    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash -= dt;
      e.orbitCD -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.burnTick += dt;
        if (e.burnTick >= 0.4) {
          e.burnTick = 0;
          this.damageEnemy(e, e.burnDps * 0.4, false, 0, 0, '#ff9933');
          if (e.dead) continue;
        }
      } else e.burnDps = 0;

      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;

      // Bosses can't be hurt until they've walked on screen.
      if (e.invuln && Math.abs(dx) < hw - e.r * 0.5 && Math.abs(dy) < hh - e.r * 0.5) {
        e.invuln = false;
        this.effects.push({ type: 'ring', x: e.x, y: e.y, r: e.r * 3, t: 0, life: 0.5, color: '#8fd0ff' });
      }

      // Relocate stragglers so the pressure stays on
      if (!e.boss && dist > farD && !e.dash) {
        const pt = this.spawnPoint(true);
        e.x = pt.x;
        e.y = pt.y;
        continue;
      }

      let vx = 0, vy = 0;
      if (e.frozenT > 0) {
        e.frozenT -= dt;
      } else {
        const spd = e.speed * (e.slowT > 0 ? 1 - e.slowAmt : 1);
        if (e.dash) {
          vx = e.dash.vx;
          vy = e.dash.vy;
          e.dash.t -= dt;
          if (e.dash.t <= 0) e.dash = null;
        } else if (e.boss) {
          const v = this.bossAI(e, dt, nx, ny, dist, spd);
          vx = v.x;
          vy = v.y;
        } else if (e.ranged) {
          const R = e.ranged;
          const want = dist > R.keep[1] ? 1 : dist < R.keep[0] ? -0.7 : 0;
          const strafe = Math.sin(this.t * 0.8 + e.id) * 0.5;
          vx = (nx * want - ny * strafe) * spd;
          vy = (ny * want + nx * strafe) * spd;
          e.aiT -= dt;
          if (e.aiT <= 0 && dist < 560) {
            e.aiT = R.every * JJ.rand(0.85, 1.15);
            this.fireShot(e.x, e.y, Math.atan2(dy, dx), R.spd, R.r, e.shotDmg, R.color, R.kind);
          }
        } else if (e.type === 'bat') {
          const wob = Math.sin(this.t * 6 + e.id) * 0.6;
          vx = (nx - ny * wob) * spd;
          vy = (ny + nx * wob) * spd;
        } else {
          vx = nx * spd;
          vy = ny * spd;
          // Wolves lunge when close.
          if (e.type === 'wolf') {
            e.aiT -= dt;
            if (e.lungeT > 0) {
              // Crouch before lunging: a readable tell.
              vx = vy = 0;
              e.lungeT -= dt;
              if (e.lungeT <= 0) e.dash = { vx: Math.cos(e.chargeDir) * 330, vy: Math.sin(e.chargeDir) * 330, t: 0.35 };
            } else if (e.aiT <= 0 && dist < 170 && dist > 70) {
              e.aiT = JJ.rand(3, 4.5);
              e.lungeT = 0.35;
              e.chargeDir = Math.atan2(dy, dx);
            }
          }
        }
        if (e.type === 'troll') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01 * dt);
      }

      e.vx = vx;
      e.vy = vy;
      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      e.kx *= decay;
      e.ky *= decay;

      // Soft separation so the horde reads as a crowd, not a single blob
      if (e.type !== 'wraith' && !e.boss) {
        let pushX = 0, pushY = 0, n = 0;
        this.grid.each(e.x, e.y, e.r, (o) => {
          if (o === e || o.dead || o.boss || n > 6) return;
          const ox = e.x - o.x, oy = e.y - o.y;
          const rr = e.r + o.r;
          const d2 = ox * ox + oy * oy;
          if (d2 < rr * rr && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (rr - d) / rr;
            pushX += (ox / d) * f;
            pushY += (oy / d) * f;
            n++;
          }
        });
        e.x += pushX * 60 * dt;
        e.y += pushY * 60 * dt;
      }

      // Contact damage
      const rr = e.r + p.r - 4;
      if (JJ.dist2(e.x, e.y, p.x, p.y) < rr * rr) this.hurtPlayer(e.dmg);
    }
  }

  // Data-driven boss behaviour: each pattern in the boss definition runs on
  // its own timer. Below 50% HP bosses enrage and attack faster.
  bossAI(e, dt, nx, ny, dist, spd) {
    const d = JJ.ENEMIES[e.type];
    const enraged = e.hp < e.maxHp * 0.5;
    if (d.regen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * d.regen * dt);

    if (e.spiral) {
      const sp = e.spiral;
      e.spiralT -= dt;
      e.spiralAcc += dt * sp.rate;
      while (e.spiralAcc >= 1) {
        e.spiralAcc -= 1;
        e.spiralA += 0.32;
        const arms = sp.arms || 2;
        for (let k = 0; k < arms; k++) this.fireShot(e.x, e.y, e.spiralA + (k / arms) * JJ.TAU, sp.spd, 8, e.shotDmg, sp.color);
      }
      if (e.spiralT <= 0) e.spiral = null;
    }

    if (e.windupT > 0) {
      e.windupT -= dt;
      if (e.windupT <= 0) {
        e.chargeT = e.chargePat.dur;
        this.shake = Math.max(this.shake, 4);
      }
      return { x: 0, y: 0 };
    }
    if (e.chargeT > 0) {
      e.chargeT -= dt;
      if (e.chargeT <= 0 && e.chargePat.then) this.bossPattern(e, e.chargePat.then);
      return { x: Math.cos(e.chargeDir) * e.chargeSpd, y: Math.sin(e.chargeDir) * e.chargeSpd };
    }

    if (e.invuln) return { x: nx * spd * 1.8, y: ny * spd * 1.8 };

    // Bosses that get left behind leap back into the fight.
    e.farT = dist > 600 ? (e.farT || 0) + dt : 0;
    if (e.farT > 2.5) {
      e.farT = 0;
      this.bossPattern(e, { type: 'teleport' });
    }

    const rate = enraged ? 1.4 : 1;
    for (let i = 0; i < d.patterns.length; i++) {
      e.timers[i] -= dt * rate;
      if (e.timers[i] <= 0) {
        e.timers[i] = d.patterns[i].every;
        this.bossPattern(e, d.patterns[i]);
        if (e.windupT > 0) break;
      }
    }

    const m = enraged ? 1.25 : 1;
    if (d.keep) {
      const want = dist > d.keep[1] ? 1 : dist < d.keep[0] ? -1 : 0.15;
      return { x: (nx * want - ny * 0.6) * spd * m, y: (ny * want + nx * 0.6) * spd * m };
    }
    return { x: nx * spd * m, y: ny * spd * m };
  }

  bossPattern(e, pat) {
    const p = this.player;
    const toward = Math.atan2(p.y - e.y, p.x - e.x);
    const big = e.boss === 'major' ? 11 : 9;
    switch (pat.type) {
      case 'ring': {
        const off = Math.random() * JJ.TAU;
        for (let i = 0; i < pat.n; i++) this.fireShot(e.x, e.y, off + (i / pat.n) * JJ.TAU, pat.spd, big, e.shotDmg, pat.color);
        break;
      }
      case 'fan':
        for (let i = 0; i < pat.n; i++) {
          this.fireShot(e.x, e.y, toward + (i - (pat.n - 1) / 2) * pat.spread, pat.spd, big, e.shotDmg, pat.color);
        }
        break;
      case 'spiral':
        e.spiral = pat;
        e.spiralT = pat.dur;
        e.spiralAcc = 0;
        e.spiralA = toward;
        break;
      case 'charge':
        e.windupT = pat.windup;
        e.chargeDir = toward;
        e.chargeSpd = pat.speed;
        e.chargePat = pat;
        break;
      case 'summon': {
        const room = JJ.ENEMY_CAP + 40 - this.enemies.length;
        const n = Math.min(pat.n, room);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * JJ.TAU;
          this.spawnEnemy(pat.enemy, e.x + Math.cos(a) * (e.r + 40), e.y + Math.sin(a) * (e.r + 40));
        }
        this.effects.push({ type: 'ring', x: e.x, y: e.y, r: e.r + 60, t: 0, life: 0.5, color: e.color });
        break;
      }
      case 'teleport': {
        this.burst(e.x, e.y, e.color, 20, 200);
        const a = Math.random() * JJ.TAU;
        const r = JJ.rand(200, 280);
        e.x = p.x + Math.cos(a) * r;
        e.y = p.y + Math.sin(a) * r;
        this.burst(e.x, e.y, e.color, 20, 200);
        this.effects.push({ type: 'ring', x: e.x, y: e.y, r: 90, t: 0, life: 0.4, color: e.color });
        break;
      }
    }
    if (pat.then && pat.type !== 'charge') this.bossPattern(e, pat.then);
  }

  fireShot(x, y, ang, spd, r, dmg, color, kind) {
    if (this.shots.length > 500) return;
    this.shots.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, r, dmg, color, kind, life: 5 });
    JJ.Audio.sfx.shoot();
  }

  updateShots(dt) {
    const p = this.player;
    for (const b of this.shots) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0) { b.dead = true; continue; }
      const rr = b.r + p.r - 3;
      if (JJ.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.dead = true;
        this.hurtPlayer(b.dmg);
      }
    }
  }

  killEnemy(e) {
    e.dead = true;
    this.kills++;
    const s = this.stats;
    const coinVal = 1 + Math.floor(this.t / 180);

    if (e.boss) {
      const major = e.boss === 'major';
      const def = JJ.ENEMIES[e.type];
      this.bossKills++;
      this.shake = major ? 15 : 8;
      for (let i = 0; i < (major ? 20 : 8); i++) this.dropPickup('coin', e.x + JJ.rand(-60, 60), e.y + JJ.rand(-60, 60), coinVal);
      this.dropPickup('gem', e.x, e.y, e.xp);
      this.dropPickup('chest', e.x, e.y, major ? 3 : 1);
      if (major || Math.random() < 0.5) this.dropPickup('heart', e.x + 30, e.y, 1);
      if (def.onDeath) {
        for (let i = 0; i < def.onDeath.n; i++) {
          const a = (i / def.onDeath.n) * JJ.TAU;
          this.spawnEnemy(def.onDeath.enemy, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30);
        }
      }
      this.addDecal(e, 2.2);
      this.burst(e.x, e.y, e.color, 60, 300);
      this.ui.toast(`${JJ.ENEMIES[e.type].name} has fallen!`, 3);
      if (e.type === 'dragon') {
        this.victory();
        return;
      }
    } else {
      this.dropPickup('gem', e.x, e.y, e.xp);
      if (Math.random() < 0.025) this.dropPickup('coin', e.x + 6, e.y + 6, coinVal);
      const r = Math.random();
      if (r < 0.004) this.dropPickup('heart', e.x, e.y, 1);
      else if (r < 0.0055) this.dropPickup('magnet', e.x, e.y, 1);
      else if (r < 0.0072) this.dropPickup('frenzy', e.x, e.y, 1);
      if (e.elite) {
        this.dropPickup('chest', e.x, e.y, Math.random() < 0.15 ? 3 : 1);
        for (let i = 0; i < 6; i++) this.dropPickup('coin', e.x + JJ.rand(-30, 30), e.y + JJ.rand(-30, 30), coinVal);
      }
      this.burst(e.x, e.y, e.color, e.elite ? 24 : 6, 140);
      this.addDecal(e, 1);
    }

    if (e.type === 'slime') {
      for (let i = 0; i < 2; i++) {
        const c = this.spawnEnemy('slimelet', e.x + JJ.rand(-8, 8), e.y + JJ.rand(-8, 8));
        c.kx = JJ.rand(-150, 150);
        c.ky = JJ.rand(-150, 150);
      }
    }

    if (s.burnSpread && e.burnT > 0) {
      this.grid.each(e.x, e.y, 80, (o) => {
        if (o.dead || o === e) return;
        if (JJ.dist2(e.x, e.y, o.x, o.y) < 80 * 80) {
          o.burnT = 3;
          o.burnDps = Math.max(o.burnDps, e.burnDps);
        }
      });
      if (this.effects.length < 220) this.effects.push({ type: 'ring', x: e.x, y: e.y, r: 80, t: 0, life: 0.25, color: '#ff8833' });
    }
    JJ.Audio.sfx.kill();
  }

  // Remains left on the ground; they fade out over time.
  addDecal(e, scale) {
    const kind = e.draw || e.type;
    const color =
      kind.startsWith('slime') ? 'rgba(90,200,80,' :
      kind === 'skeleton' || kind === 'archer' ? 'rgba(220,214,195,' :
      kind === 'wraith' ? 'rgba(160,220,240,' :
      kind === 'mage' ? 'rgba(120,40,140,' : 'rgba(110,20,20,';
    if (this.decals.length > 150) this.decals.shift();
    const blobs = [];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      blobs.push([JJ.rand(-1, 1) * e.r * 0.8 * scale, JJ.rand(-0.6, 0.6) * e.r * 0.8 * scale, JJ.rand(0.3, 0.6) * e.r * scale]);
    }
    this.decals.push({ x: e.x, y: e.y, color, blobs, t: 0, life: 25 });
  }

  // ------------------------------------------------------------------ pickups
  dropPickup(type, x, y, value) {
    if (type === 'gem') {
      if (this.gemCount > 250) {
        // Merge into a nearby gem to keep things fast. Past a hard cap, the
        // oldest gem absorbs the value and moves here so no XP is lost.
        let oldest = null;
        for (let i = 0; i < this.pickups.length; i++) {
          const g = this.pickups[i];
          if (g.type !== 'gem' || g.dead || g.attract) continue;
          if (!oldest) oldest = g;
          if (JJ.dist2(g.x, g.y, x, y) < 160 * 160) {
            g.value += value;
            return;
          }
        }
        if (oldest && this.gemCount > 400) {
          oldest.value += value;
          oldest.x = x;
          oldest.y = y;
          return;
        }
      }
      this.gemCount++;
    }
    this.pickups.push({ type, x, y, value, attract: false, spd: 0, t: Math.random() * 10, age: 0 });
  }

  updatePickups(dt) {
    const p = this.player, s = this.stats;
    const range2 = s.pickup * s.pickup;
    const far2 = (this.viewW * 0.9) ** 2;
    for (const k of this.pickups) {
      k.t += dt;
      k.age += dt;
      const dx = p.x - k.x, dy = p.y - k.y;
      const d2 = dx * dx + dy * dy;
      if (!k.attract) {
        if (d2 < range2 || (k.type === 'chest' && d2 < 40 * 40)) k.attract = true;
        // Old or far-away gems drift home so XP from distant kills isn't lost.
        else if (k.type === 'gem' && (k.age > 20 || d2 > far2)) k.attract = true;
      }
      if (k.attract) {
        const d = Math.sqrt(d2) || 1;
        k.spd = Math.min(1400, k.spd + 1500 * dt);
        const step = Math.min(d, k.spd * dt);
        k.x += (dx / d) * step;
        k.y += (dy / d) * step;
        if (d < p.r + 8) this.collect(k);
      }
    }
  }

  collect(k) {
    k.dead = true;
    const s = this.stats;
    switch (k.type) {
      case 'gem':
        this.gemCount--;
        this.gainXp(k.value * s.xpMult);
        JJ.Audio.sfx.gem();
        break;
      case 'coin':
        this.gold += k.value * s.goldMult;
        JJ.Audio.sfx.coin();
        break;
      case 'heart':
        this.heal(35);
        JJ.Audio.sfx.heal();
        break;
      case 'magnet':
        for (const o of this.pickups) if (o.type === 'gem' || o.type === 'coin') o.attract = true;
        this.ui.toast('🧲 Everything comes to Johnny!');
        JJ.Audio.sfx.heal();
        break;
      case 'frenzy':
        this.frenzyT = 8;
        this.ui.toast('🔥 JAVELIN FRENZY! 🔥', 2);
        JJ.Audio.sfx.legendary();
        break;
      case 'chest':
        this.pendingChests.push(k.value);
        break;
    }
  }

  heal(n) {
    const p = this.player;
    p.hp = Math.min(this.stats.maxHp, p.hp + n);
    this.texts.push({ x: p.x, y: p.y - 24, vy: -50, t: 0, life: 0.8, text: `+${Math.round(n)}`, color: '#5f5', big: true });
  }

  gainXp(v) {
    const p = this.player;
    p.xp += v;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = this.xpFor(p.level);
      this.pendingLevels++;
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (p.inv > 0 || this.state !== 'playing') return;
    dmg = Math.max(1, dmg - this.stats.armor);
    p.hp -= dmg;
    p.inv = 0.45;
    this.hurtFlash = 0.25;
    JJ.Audio.sfx.hurt();
    this.texts.push({ x: p.x, y: p.y - 20, vy: -50, t: 0, life: 0.6, text: `-${Math.round(dmg)}`, color: '#ff4444', big: true });
    if (p.hp <= 0) {
      if (this.revive) {
        this.revive = false;
        p.hp = this.stats.maxHp * 0.5;
        p.inv = 2.5;
        this.ui.toast(`🪶 The Phoenix Feather burns... ${JJ.Save.data.johnny.name} rises!`, 3);
        this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 320, t: 0, life: 0.6, color: '#ffb347' });
        this.grid.each(p.x, p.y, 320, (e) => {
          if (e.dead) return;
          if (JJ.dist2(p.x, p.y, e.x, e.y) < 320 * 320) {
            this.damageEnemy(e, e.boss ? e.maxHp * 0.05 : e.maxHp * 2, false);
          }
        });
        for (const b of this.shots) b.dead = true;
        JJ.Audio.sfx.legendary();
      } else {
        p.hp = 0;
        this.endRun(false);
      }
    }
  }

  // ------------------------------------------------------------------ fx
  burst(x, y, color, n, speed) {
    for (let i = 0; i < n && this.particles.length < 700; i++) {
      const a = Math.random() * JJ.TAU, v = Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: JJ.rand(0.25, 0.6), color, size: JJ.rand(2, 4.5) });
    }
  }

  updateFx(dt) {
    for (const f of this.effects) {
      f.t += dt;
      if (f.t >= f.life) f.dead = true;
    }
    const drag = Math.exp(-4 * dt);
    for (const q of this.particles) {
      q.t += dt;
      if (q.t >= q.life) { q.dead = true; continue; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= drag;
      q.vy *= drag;
    }
    for (const tx of this.texts) {
      tx.t += dt;
      tx.y += tx.vy * dt;
      if (tx.t >= tx.life) tx.dead = true;
    }
  }

  // ------------------------------------------------------------------ progression
  availableUpgrades() {
    return JJ.UPGRADES.filter((u) => {
      const lvl = this.upgrades.get(u.id) || 0;
      if (lvl >= u.max) return false;
      if (u.locked && !JJ.Save.isUnlocked(u.id)) return false;
      if (u.requires) {
        for (const k in u.requires) if ((this.upgrades.get(k) || 0) < u.requires[k]) return false;
      }
      return true;
    });
  }

  rollChoices(n = this.stats.choices) {
    const avail = this.availableUpgrades();
    const picks = JJ.weightedSample(avail, n, (u) => u.weight * (this.upgrades.has(u.id) ? 1.4 : 1));
    if (!picks.length) return [JJ.FALLBACK_GOLD, JJ.FALLBACK_HEAL];
    return picks;
  }

  levelOf(id) {
    return this.upgrades.get(id) || 0;
  }

  takeUpgrade(u) {
    if (u.id === '_gold') {
      this.gold += 25 * this.stats.goldMult;
      return;
    }
    if (u.id === '_heal') {
      this.heal(50);
      return;
    }
    const lvl = this.levelOf(u.id) + 1;
    this.upgrades.set(u.id, lvl);
    if (lvl === 1) this.order.push(u.id);
    this.computeStats();
    if (u.onTake) u.onTake(this);
    if (u.kind === 'legendary') {
      this.legendaries.push(u.id);
      JJ.Save.data.stats.legendaries[u.id] = true;
      JJ.Save.save();
      JJ.Audio.sfx.legendary();
      this.shake = 8;
    }
  }

  openLevelUp() {
    this.state = 'levelup';
    JJ.Audio.sfx.levelup();
    this.ui.showLevelUp(this.rollChoices());
  }

  chooseUpgrade(u) {
    this.takeUpgrade(u);
    this.pendingLevels--;
    this.state = 'playing';
  }

  skipLevel() {
    this.gold += 5 * this.stats.goldMult;
    this.heal(10);
    this.pendingLevels--;
    this.state = 'playing';
  }

  reroll() {
    if (this.rerolls <= 0) return null;
    this.rerolls--;
    return this.rollChoices();
  }

  openChest() {
    const n = this.pendingChests.shift();
    this.state = 'chest';
    const granted = [];
    for (let i = 0; i < n; i++) {
      const avail = this.availableUpgrades();
      if (!avail.length) break;
      // Chests love legendaries.
      const [u] = JJ.weightedSample(avail, 1, (x) => (x.kind === 'legendary' ? 1000 : x.weight));
      this.takeUpgrade(u);
      granted.push({ u, level: this.levelOf(u.id) });
    }
    const bonus = Math.round((15 + n * 10) * this.stats.goldMult);
    this.gold += bonus;
    JJ.Audio.sfx.chest();
    this.ui.showChest(granted, bonus);
  }

  closeChest() {
    this.state = 'playing';
  }

  victory() {
    this.won = true;
    this.ui.toast('🏆 THE DRAGON IS SLAIN! 🏆', 4);
    this.player.inv = 99;
    setTimeout(() => this.endRun(true), 1800);
  }

  endRun(won) {
    if (this.state === 'over') return;
    won = won || this.won;
    this.state = 'over';
    const S = JJ.Save;
    const st = S.data.stats;
    const runGold = Math.round(this.gold);
    const bonus = Math.round((Math.floor(this.t / 10) + Math.floor(this.kills / 25) + (won ? 300 : 0)) * this.stats.goldMult);
    const total = runGold + bonus;
    const newBest = this.t > st.bestTime;
    S.data.gold += total;
    st.runs++;
    if (won) st.wins++;
    st.bestTime = Math.max(st.bestTime, this.t);
    st.bestLevel = Math.max(st.bestLevel, this.player.level);
    st.totalKills += this.kills;
    st.bossKills += this.bossKills;
    S.save();
    if (won) JJ.Audio.sfx.legendary();
    else JJ.Audio.sfx.gameover();
    this.ui.showGameOver({
      won, time: this.t, level: this.player.level, kills: this.kills,
      gold: runGold, bonus, total, newBest, legendaries: this.legendaries.slice(), bosses: this.bossKills,
    });
  }
};

JJ.FALLBACK_GOLD = { id: '_gold', name: 'Pouch of Gold', icon: '🪙', kind: 'johnny', max: 99, desc: () => 'Gain <b>25</b> gold.' };
JJ.FALLBACK_HEAL = { id: '_heal', name: 'Roast Chicken', icon: '🍗', kind: 'johnny', max: 99, desc: () => 'Heal <b>50</b> HP.' };
