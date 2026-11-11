// DOM menus, HUD and modal screens.
'use strict';

JJ.UI = class UI {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.screens = ['menu', 'howto', 'options', 'shop', 'levelup', 'chest', 'pause', 'gameover', 'designer', 'leaderboard'];
    this.returnTo = 'menu';
    this.shopTab = 'training';
    this.choices = [];
    this.hudCache = {};
    this.lastBuildKey = '';
    this.bindButtons();
  }

  attach(game) {
    this.game = game;
  }

  show(id) {
    for (const s of this.screens) this.$(s).classList.toggle('hidden', s !== id);
  }

  hideAll() {
    for (const s of this.screens) this.$(s).classList.add('hidden');
  }

  click(id, fn) {
    this.$(id).addEventListener('click', () => {
      JJ.Audio.resume();
      JJ.Audio.sfx.click();
      fn();
    });
  }

  bindButtons() {
    this.click('btn-play', () => this.startRun());
    this.click('btn-shop', () => this.openShop('menu'));
    this.click('btn-designer', () => this.openDesigner());
    this.click('btn-leaderboard', () => this.openLeaderboard('menu'));
    this.click('btn-go-lb', () => this.openLeaderboard('gameover'));
    this.click('btn-lb-refresh', () => this.renderLeaderboard());
    this.click('btn-random-look', () => {
      Object.assign(JJ.Save.data.johnny, JJ.randomLook());
      JJ.Save.save();
      this.renderDesigner();
    });
    this.click('btn-reset-look', () => {
      const name = JJ.Save.data.johnny.name;
      Object.assign(JJ.Save.data.johnny, JJ.defaultLook(), { name });
      JJ.Save.save();
      this.renderDesigner();
    });
    this.$('johnny-name').addEventListener('input', (ev) => {
      JJ.Save.data.johnny.name = ev.target.value.slice(0, 16);
      JJ.Save.save();
    });
    // Typing a name must not trigger game hotkeys.
    this.$('johnny-name').addEventListener('keydown', (ev) => ev.stopPropagation());
    this.click('btn-howto', () => { this.returnTo = 'menu'; this.show('howto'); });
    this.click('btn-options', () => this.openOptions('menu'));
    document.querySelectorAll('[data-back]').forEach((b) =>
      b.addEventListener('click', () => {
        JJ.Audio.sfx.click();
        this.back();
      }),
    );
    this.click('opt-aim', () => this.toggleSetting('aim'));
    this.click('opt-sound', () => this.toggleSetting('sound'));
    this.click('opt-quality', () => this.toggleSetting('quality'));
    this.click('opt-dmg', () => this.toggleSetting('damageNumbers'));
    this.click('opt-shake', () => this.toggleSetting('shake'));
    document.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        JJ.Audio.sfx.click();
        this.shopTab = t.dataset.tab;
        this.renderShop();
      }),
    );
    this.click('btn-refund', () => {
      if (!confirm('Refund all Training ranks for their full gold cost?')) return;
      const n = JJ.Save.refundMeta();
      this.toast(`Refunded ${n} gold`, 2.2, 'coin');
      this.renderShop();
    });
    this.click('btn-reroll', () => this.doReroll());
    this.click('btn-skip', () => {
      this.game.skipLevel();
      this.hideAll();
    });
    this.click('btn-chest', () => {
      this.game.closeChest();
      this.hideAll();
    });
    this.click('pausebtn', () => this.togglePause());
    this.click('btn-resume', () => this.togglePause());
    this.click('btn-pause-options', () => this.openOptions('pause'));
    this.click('btn-quit', () => {
      this.hideAll();
      this.game.state = 'playing';
      this.game.endRun(false);
    });
    this.click('btn-again', () => this.startRun());
    this.click('btn-go-shop', () => this.openShop('gameover-menu'));
    this.click('btn-go-menu', () => this.openMenu());

    JJ.Input.onPress((k) => {
      const g = this.game;
      if (!g) return;
      if ((k === 'escape' || k === 'p') && (g.state === 'playing' || g.state === 'paused')) {
        if (!this.$('options').classList.contains('hidden')) return this.back();
        this.togglePause();
      } else if (g.state === 'levelup') {
        const n = parseInt(k, 10);
        if (n >= 1 && n <= this.choices.length) this.pick(n - 1);
        if (k === 'r') this.doReroll();
      } else if (g.state === 'chest' && (k === 'enter' || k === ' ')) {
        this.$('btn-chest').click();
      } else if (g.state === 'idle' && k === 'enter' && !this.$('menu').classList.contains('hidden')) {
        this.startRun();
      }
    });
  }

  back() {
    this.previewing = false;
    const look = JJ.Save.data.johnny;
    if (!look.name || !look.name.trim()) {
      look.name = 'Johnny';
      JJ.Save.save();
    }
    if (this.returnTo === 'pause') this.show('pause');
    else if (this.returnTo === 'gameover') this.show('gameover');
    else if (this.returnTo === 'gameover-menu') this.openMenu();
    else this.openMenu();
  }

  openMenu() {
    if (this.game) this.game.state = 'idle';
    this.$('hud').classList.add('hidden');
    this.show('menu');
    this.refreshGold();
    const st = JJ.Save.data.stats;
    this.$('records').innerHTML = st.runs
      ? `Best survival: <b>${JJ.formatTime(st.bestTime)}</b> · Runs: <b>${st.runs}</b> · Dragons slain: <b>${st.wins}</b>`
      : 'The monsters are coming. Johnny has javelins.';
  }

  refreshGold() {
    document.querySelectorAll('.gold-amt').forEach((el) => (el.textContent = JJ.formatNum(JJ.Save.data.gold)));
  }

  startRun() {
    JJ.Audio.resume();
    JJ.Audio.setEnabled(JJ.Save.data.settings.sound);
    this.hideAll();
    this.$('hud').classList.remove('hidden');
    this.$('toasts').innerHTML = '';
    this.lastBuildKey = '';
    this.hudCache = {};
    this.game.start();
    this.toast(`Survive, ${JJ.Save.data.johnny.name}! Javelins are thrown automatically.`, 3);
  }

  // ------------------------------------------------------------ leaderboard
  openLeaderboard(from) {
    this.returnTo = from;
    this.show('leaderboard');
    this.renderLeaderboard();
  }

  async renderLeaderboard() {
    const body = this.$('lb-body');
    if (!JJ.Leaderboard.online()) {
      body.innerHTML = '<div class="lb-msg">The leaderboard lives online. Play at the hosted site to join the Hall of Johnnys.</div>';
      return;
    }
    body.innerHTML = '<div class="lb-msg">Summoning the Johnnys…</div>';
    try {
      const { entries, total, totalJavelins } = await JJ.Leaderboard.top();
      if (!entries.length) {
        body.innerHTML = '<div class="lb-msg">No runs yet. Be the first Johnny!</div>';
        return;
      }
      const medal = ['i_medal1', 'i_medal2', 'i_medal3'].map((m) => JJ.icon(m, 26));
      body.innerHTML = `<table class="lb-table">
        <thead><tr><th>#</th><th>Name</th><th>Survived</th><th>Kills</th><th>Javelins</th><th>Level</th></tr></thead>
        <tbody>${entries
          .map((e) => `<tr class="${e.rank <= 3 ? 'top' + e.rank : ''} ${e.rank === this.myRank ? 'me' : ''}">
            <td>${medal[e.rank - 1] || e.rank}</td>
            <td>Johnny${e.won ? ' ' + JJ.icon('dragon', 22, 'inl') : ''}</td>
            <td>${JJ.formatTime(e.time_s)}</td>
            <td>${JJ.formatNum(e.kills)}</td>
            <td>${e.javelins ? JJ.formatNum(e.javelins) : '—'}</td>
            <td>${e.level}</td>
          </tr>`)
          .join('')}</tbody></table>
        <div class="lb-msg" style="padding:10px 0 0">${total} run${total === 1 ? '' : 's'} recorded · <b>${(totalJavelins || 0).toLocaleString()}</b> javelins thrown by all Johnnys · ${JJ.icon('dragon', 18, 'inl')} = slew the dragon</div>`;
    } catch (err) {
      body.innerHTML = '<div class="lb-msg">Couldn\'t reach the leaderboard right now. Try again in a moment.</div>';
    }
  }

  async submitRun(r) {
    const el = this.$('go-rank');
    el.className = 'go-rank muted';
    this.myRank = null;
    if (!JJ.Leaderboard.online()) {
      el.textContent = 'Leaderboard is only available on the hosted site.';
      return;
    }
    if (r.time < 30) {
      el.textContent = 'Survive at least 30 seconds to make the leaderboard.';
      return;
    }
    el.textContent = 'Submitting your run as… Johnny.';
    try {
      const res = await JJ.Leaderboard.submit(r);
      this.myRank = res.rank;
      el.className = 'go-rank';
      el.textContent = res.rank <= 25
        ? `${JJ.icon('i_trophy', 22, 'inl')} Johnny placed #${res.rank} of ${res.total} on the leaderboard!`
        : `Johnny placed #${res.rank} of ${res.total}.`;
    } catch (err) {
      el.textContent = `Couldn't submit to the leaderboard (${err.message}).`;
    }
  }

  // ------------------------------------------------------------ designer
  openDesigner() {
    this.returnTo = 'menu';
    this.show('designer');
    this.$('johnny-name').value = JJ.Save.data.johnny.name;
    this.renderDesigner();
    this.previewing = true;
    const canvas = this.$('johnny-preview');
    const ctx = canvas.getContext('2d');
    const start = performance.now();
    const loop = (now) => {
      if (!this.previewing) return;
      this.drawPreview(ctx, canvas, (now - start) / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  drawPreview(ctx, canvas, t) {
    const look = JJ.Save.data.johnny;
    const W = canvas.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, W / 2, 10, W / 2, W / 2, W / 2);
    bg.addColorStop(0, '#5a8f48');
    bg.addColorStop(1, '#2f5528');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, W);
    const scale = W / 60;
    ctx.setTransform(scale, 0, 0, scale, W / 2, W / 2 + scale * 2);
    // Walk in place, glancing around, with a throw every couple of seconds.
    const cycle = t % 3;
    const face = cycle < 1.5 ? 0.35 : Math.PI - 0.35;
    const moving = cycle % 1.5 < 1.1;
    const throwK = Math.max(0, 1 - ((t * 1.3) % 2) * 4);
    const pull = -6 * throwK;
    const walk = t * 12;
    const gr = JJ.johnnyGrip(0, moving ? Math.sin(walk) * 1.5 : 0, face, pull);
    JJ.drawJavelin(ctx, gr.jx, gr.jy, face, 0.9, '#dfe6ee', false, false, look);
    JJ.drawJohnny(ctx, look, 0, 0, { face, walk, moving, time: t, hand: { x: gr.gx, y: gr.gy } });
    JJ.drawJohnnyHand(ctx, look, gr.gx, gr.gy);
  }

  renderDesigner() {
    const L = JJ.LOOK, look = JJ.Save.data.johnny;
    const swatches = (key, list) =>
      `<div class="opt-row">${list
        .map((c) => `<button class="swatch ${c === 'none' ? 'none' : ''} ${look[key] === c ? 'sel' : ''}" data-key="${key}" data-val="${c}" ${c === 'none' ? 'title="None"' : `style="background:${c}"`}></button>`)
        .join('')}</div>`;
    const chips = (key, list, dot) =>
      `<div class="opt-row">${list
        .map((o) => `<button class="chip ${look[key] === o.id ? 'sel' : ''}" data-key="${key}" data-val="${o.id}">${dot ? `<span class="dot" style="background:${o.id}"></span>` : ''}${o.name}</button>`)
        .join('')}</div>`;
    const group = (title, html) => `<div class="opt-group"><h3>${title}</h3>${html}</div>`;
    this.$('designer-opts').innerHTML = [
      group('Skin', swatches('skin', L.skin)),
      group('Hairstyle', chips('hair', L.hair)),
      group('Hair colour', swatches('hairColor', L.hairColor)),
      group('Headgear', chips('hat', L.hat)),
      group('Headgear colour', swatches('hatColor', L.hatColor)),
      group('Face', chips('face', L.face)),
      group('Tunic', swatches('tunic', L.tunic)),
      group('Trousers', swatches('pants', L.pants)),
      group('Cape', swatches('cape', L.cape)),
      group('Javelin shaft', chips('shaft', L.shaft, true)),
      group('Javelin fletching', swatches('fletch', L.fletch)),
    ].join('');
    this.$('designer-opts').querySelectorAll('[data-key]').forEach((b) =>
      b.addEventListener('click', () => {
        JJ.Audio.resume();
        JJ.Audio.sfx.click();
        look[b.dataset.key] = b.dataset.val;
        JJ.Save.save();
        this.renderDesigner();
      }),
    );
  }

  // ------------------------------------------------------------ options
  openOptions(from) {
    this.returnTo = from;
    this.renderOptions();
    this.show('options');
  }

  toggleSetting(key) {
    const s = JJ.Save.data.settings;
    if (key === 'aim') s.aim = s.aim === 'auto' ? 'mouse' : 'auto';
    else if (key === 'quality') s.quality = s.quality === 'low' ? 'high' : 'low';
    else s[key] = !s[key];
    JJ.Audio.setEnabled(s.sound);
    JJ.Save.save();
    this.renderOptions();
  }

  renderOptions() {
    const s = JJ.Save.data.settings;
    this.$('opt-aim').textContent = s.aim === 'auto' ? 'Auto' : 'Mouse';
    this.$('opt-sound').textContent = s.sound ? 'On' : 'Off';
    this.$('opt-quality').textContent = s.quality === 'low' ? 'Low' : 'High';
    this.$('opt-dmg').textContent = s.damageNumbers ? 'On' : 'Off';
    this.$('opt-shake').textContent = s.shake ? 'On' : 'Off';
  }

  // ------------------------------------------------------------ shop
  openShop(from) {
    this.returnTo = from;
    this.show('shop');
    this.renderShop();
  }

  renderShop() {
    this.refreshGold();
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === this.shopTab));
    const body = this.$('shop-body');
    const S = JJ.Save;
    const gold = S.data.gold;
    this.$('btn-refund').classList.toggle('hidden', this.shopTab !== 'training');

    if (this.shopTab === 'training') {
      body.innerHTML = JJ.META.map((m) => {
        const lvl = S.metaLevel(m.id);
        const maxed = lvl >= m.max;
        const cost = S.metaCost(m);
        const pips = Array.from({ length: m.max }, (_, i) => `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('');
        return `<div class="shop-item ${maxed ? 'maxed' : ''}">
          <div class="si-top"><span class="si-icon">${JJ.icon(JJ.META_ICONS[m.id], 40)}</span><div><div class="si-name">${m.name}</div><div class="pips">${pips}</div></div></div>
          <div class="si-desc">${m.desc}</div>
          <button class="btn small" data-buy="${m.id}" ${maxed || gold < cost ? 'disabled' : ''}>${maxed ? 'MAXED' : `Train · ${JJ.icon('coin', 16, 'inl')} ${cost}`}</button>
        </div>`;
      }).join('');
    } else if (this.shopTab === 'techniques') {
      body.innerHTML = JJ.UNLOCKS.map((un) => {
        const u = JJ.UPGRADES_BY_ID[un.id];
        const owned = S.isUnlocked(un.id);
        return `<div class="shop-item ${owned ? 'maxed' : ''}">
          <div class="si-top"><span class="si-icon">${JJ.icon(JJ.upgradeIconName(u.id), 40)}</span><div class="si-name">${u.name}</div></div>
          <div class="si-desc">${u.desc(1)}<br><i>Adds this card to the level-up pool.</i></div>
          <button class="btn small" data-unlock="${un.id}" ${owned || gold < un.cost ? 'disabled' : ''}>${owned ? 'LEARNED' : `Learn · ${JJ.icon('coin', 16, 'inl')} ${un.cost}`}</button>
        </div>`;
      }).join('');
    } else {
      const st = S.data.stats;
      const legends = JJ.UPGRADES.filter((u) => u.kind === 'legendary');
      body.innerHTML = `<div class="records-grid" style="grid-column:1/-1">
        <div>Runs</div><div>${st.runs}</div>
        <div>Dragons slain</div><div>${st.wins}</div>
        <div>Best survival time</div><div>${JJ.formatTime(st.bestTime)}</div>
        <div>Highest level</div><div>${st.bestLevel}</div>
        <div>Monsters skewered</div><div>${JJ.formatNum(st.totalKills)}</div>
        <div>Javelins thrown</div><div>${JJ.formatNum(st.totalJavelins || 0)}</div>
        <div>Bosses felled</div><div>${st.bossKills}</div>
        <div class="legend-list"><h3>Legendary Evolutions discovered</h3>${legends
          .map((u) => {
            const found = st.legendaries[u.id];
            const req = Object.entries(u.requires)
              .map(([k, v]) => `${JJ.UPGRADES_BY_ID[k].name} ${v}`)
              .join(' + ');
            return found
              ? `<span class="lg found" title="${req}">${JJ.icon(JJ.upgradeIconName(u.id), 20, 'inl')} ${u.name}</span>`
              : `<span class="lg unknown" title="Hint: ${req}">??? </span>`;
          })
          .join('')}<p class="si-desc">Hover an undiscovered legendary for a hint.</p></div>
      </div>`;
    }

    body.querySelectorAll('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        if (S.buyMeta(b.dataset.buy)) JJ.Audio.sfx.coin();
        this.renderShop();
      }),
    );
    body.querySelectorAll('[data-unlock]').forEach((b) =>
      b.addEventListener('click', () => {
        if (S.buyUnlock(b.dataset.unlock)) JJ.Audio.sfx.chest();
        this.renderShop();
      }),
    );
  }

  // ------------------------------------------------------------ in-run modals
  cardHtml(u, i) {
    const g = this.game;
    const cur = u.id.startsWith('_') ? 0 : g.levelOf(u.id);
    const next = cur + 1;
    const legendary = u.kind === 'legendary';
    const lvlText = legendary ? '★ Legendary Evolution ★' : cur === 0 ? 'New!' : `Lv ${cur} → ${next}${next === u.max ? ' (MAX)' : ''}`;
    return `<button class="card ${legendary ? 'legendary' : ''}" data-idx="${i}">
      <kbd>${i + 1}</kbd>
      <div class="card-icon">${JJ.icon(JJ.upgradeIconName(u.id), 48)}</div>
      <div>
        <div class="card-name">${u.name}</div>
        <div class="card-lvl">${lvlText}</div>
      </div>
      <div class="card-desc">${u.desc(next)}</div>
    </button>`;
  }

  showLevelUp(choices) {
    this.choices = choices;
    const cards = this.$('cards');
    cards.innerHTML = choices.map((u, i) => this.cardHtml(u, i)).join('');
    cards.querySelectorAll('.card').forEach((c) =>
      c.addEventListener('click', () => this.pick(parseInt(c.dataset.idx, 10))),
    );
    this.$('reroll-n').textContent = this.game.rerolls;
    this.$('btn-reroll').disabled = this.game.rerolls <= 0;
    this.show('levelup');
    if (choices.some((u) => u.kind === 'legendary')) JJ.Audio.sfx.legendary();
  }

  pick(i) {
    const u = this.choices[i];
    if (!u || this.game.state !== 'levelup') return;
    JJ.Audio.sfx.click();
    this.game.chooseUpgrade(u);
    this.hideAll();
    if (u.kind === 'legendary') this.toast(`${u.name} unleashed!`, 3, JJ.upgradeIconName(u.id));
  }

  doReroll() {
    const c = this.game.reroll();
    if (c) this.showLevelUp(c);
  }

  showChest(granted, gold) {
    const items = this.$('chest-items');
    items.innerHTML =
      granted
        .map(({ u, level }, i) => `<div class="chest-item ${u.kind === 'legendary' ? 'legendary' : ''}" style="animation-delay:${i * 0.25}s">
          <span class="ci-icon">${JJ.icon(JJ.upgradeIconName(u.id), 36)}</span>
          <div><div class="ci-name">${u.name}</div><div class="ci-lvl">${u.kind === 'legendary' ? '★ LEGENDARY ★' : `Level ${level}`}</div></div>
        </div>`)
        .join('') + `<div class="chest-item" style="animation-delay:${granted.length * 0.25}s"><span class="ci-icon">${JJ.icon('i_gold', 36)}</span><div class="ci-name">+${gold} gold</div></div>`;
    this.show('chest');
  }

  togglePause() {
    const g = this.game;
    if (g.state === 'playing') {
      g.state = 'paused';
      this.renderPause();
      this.show('pause');
    } else if (g.state === 'paused') {
      g.state = 'playing';
      this.hideAll();
    }
  }

  renderPause() {
    const g = this.game, s = g.stats;
    const perVolley = s.count * (s.thousand ? 2 : 1) * s.dirs;
    const rows = [
      ['Damage', s.dmg.toFixed(1)],
      ['Javelins per volley', perVolley],
      ['Volleys per second', (1 / s.interval).toFixed(2)],
      ['Pierce', s.pierce === Infinity ? '∞' : s.pierce],
      ['Ricochets', s.bounce],
      ['Javelin size', `${Math.round(s.size * 100)}%`],
      ['Crit chance', `${Math.round(s.crit * 100)}%`],
      ['Crit damage', `x${s.critMult.toFixed(2)}`],
      ['Move speed', Math.round(s.speed)],
      ['Armor', s.armor],
      ['Regen', `${s.regen.toFixed(1)}/s`],
      ['Javelins thrown', JJ.formatNum(g.javelins)],
      ['Rerolls left', g.rerolls],
      ['Phoenix Feather', g.revive ? 'Ready' : '—'],
    ];
    this.$('pause-stats').innerHTML = rows.map(([a, b]) => `<div>${a}</div><div>${b}</div>`).join('');
    this.$('pause-build').innerHTML = g.order.length
      ? g.order
          .map((id) => {
            const u = JJ.UPGRADES_BY_ID[id];
            const l = g.levelOf(id);
            return `<div class="pb-row ${u.kind === 'legendary' ? 'legendary' : ''}"><span class="pb-icon">${JJ.icon(JJ.upgradeIconName(u.id), 24)}</span><span class="pb-name">${u.name}</span><span class="pb-lvl">${u.kind === 'legendary' ? '★' : `${l}/${u.max}`}</span></div>`;
          })
          .join('')
      : '<i>Nothing yet. Go collect some XP!</i>';
  }

  showGameOver(r) {
    this.$('hud').classList.add('hidden');
    const name = JJ.Save.data.johnny.name || 'Johnny';
    this.$('go-title').innerHTML = r.won
      ? `${JJ.icon('i_trophy', 36, 'inl')} VICTORY! ${JJ.esc(name)} slew the Dragon!`
      : `${JJ.icon('i_skull', 36, 'inl')} ${JJ.esc(name)} has fallen`;
    const legends = r.legendaries.map((id) => JJ.icon(JJ.upgradeIconName(id), 20, 'inl') + ' ' + JJ.UPGRADES_BY_ID[id].name).join(', ');
    this.$('go-stats').innerHTML = `
      <div>Survived</div><div>${JJ.formatTime(r.time)}</div>
      <div>Level reached</div><div>${r.level}</div>
      <div>Monsters skewered</div><div>${JJ.formatNum(r.kills)}</div>
      <div>Javelins thrown</div><div>${JJ.formatNum(r.javelins)}</div>
      ${legends ? `<div>Legendaries</div><div>${legends}</div>` : ''}
      <div>Gold collected</div><div>${JJ.icon('coin', 16, 'inl')} ${r.gold}</div>
      <div>Survival bonus</div><div>${JJ.icon('coin', 16, 'inl')} ${r.bonus}</div>
      <div class="total">Total banked</div><div class="total">${JJ.icon('coin', 16, 'inl')} ${r.total}</div>
      ${r.newBest ? '<div class="new-best" style="grid-column:1/-1">New best survival time!</div>' : ''}`;
    this.submitRun(r);
    setTimeout(() => this.show('gameover'), r.won ? 200 : 900);
  }

  toast(msg, dur = 2.2, icon) {
    const box = this.$('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    if (icon) el.innerHTML = JJ.icon(icon, 28, 'inl');
    const text = document.createElement('span');
    text.textContent = msg;
    el.appendChild(text);
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), dur * 1000);
  }


  // ------------------------------------------------------------ HUD
  set(id, val, prop = 'textContent') {
    if (this.hudCache[id + prop] === val) return;
    this.hudCache[id + prop] = val;
    if (prop === 'width') this.$(id).style.width = val;
    else this.$(id)[prop] = val;
  }

  updateHUD() {
    const g = this.game;
    if (!g || !g.player || g.state === 'idle' || g.state === 'over') return;
    const p = g.player, s = g.stats;
    this.set('xpfill', `${Math.min(100, (p.xp / p.xpNext) * 100).toFixed(1)}%`, 'width');
    this.set('lvl', `LV ${p.level}`);
    this.set('hpfill', `${JJ.clamp((p.hp / s.maxHp) * 100, 0, 100).toFixed(1)}%`, 'width');
    this.set('hptext', `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(s.maxHp)}`);
    this.set('timer', JJ.formatTime(g.t));
    this.set('kills', JJ.formatNum(g.kills));
    this.set('gold', JJ.formatNum(g.gold));

    const buildKey = g.order.map((id) => id + g.levelOf(id)).join();
    if (buildKey !== this.lastBuildKey) {
      this.lastBuildKey = buildKey;
      this.$('build').innerHTML = g.order
        .map((id) => {
          const u = JJ.UPGRADES_BY_ID[id];
          const l = g.levelOf(id);
          return `<div class="bicon ${u.kind === 'legendary' ? 'legendary' : ''}" title="${u.name}">${JJ.icon(JJ.upgradeIconName(u.id), 24)}${u.kind === 'legendary' ? '' : `<small>${l}</small>`}</div>`;
        })
        .join('');
    }

    const boss = g.bosses[0];
    this.$('bossbar').classList.toggle('hidden', !boss);
    if (boss) {
      this.set('bossname', JJ.ENEMIES[boss.type].name);
      this.set('bossfill', `${Math.max(0, (boss.hp / boss.maxHp) * 100).toFixed(1)}%`, 'width');
    }
  }
};
