// Pixel-art sprite atlas (16x16 cells, see assets/sprites-credits.txt).
// Loads one PNG and pre-builds tinted silhouettes (hit flash, elite glow,
// frozen) using canvas compositing only, so it also works from file://.
'use strict';

JJ.Sprites = (() => {
  const img = new Image();
  const tints = {};
  let ready = false;
  const listeners = [];

  function silhouette(color) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  img.onload = () => {
    tints.white = silhouette('#ffffff');
    tints.gold = silhouette('#ffd34d');
    tints.ice = silhouette('rgba(150,220,255,0.75)');
    tints.dark = silhouette('#000000');
    ready = true;
    for (const fn of listeners) fn();
  };
  img.src = 'assets/sprites.png';

  // Draw sprite `name` with its feet (bottom of the opaque area) at x,y.
  // `size` is the world size of the full 16px cell. opts: flip, sx, sy
  // (extra scale), rot, tint ('white'|'gold'|'ice'|'dark'), alpha, center.
  function draw(ctx, name, x, y, size, opts) {
    const s = JJ.SPRITE_INDEX[name];
    if (!s || !ready) return false;
    const o = opts || {};
    const k = size / 16;
    const sx = (o.sx || 1) * (o.flip ? -1 : 1);
    const sy = o.sy || 1;
    // Anchor: horizontal centre of the cell, bottom of the opaque bounds
    // (or the visual centre when o.center is set).
    const ax = 8;
    const ay = o.center ? (s[3] + s[5]) / 2 : s[5];
    const src = o.tint ? tints[o.tint] : img;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(sx * k, sy * k);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(src, s[0] * 16, s[1] * 16, 16, 16, -ax, -ay, 16, 16);
    ctx.restore();
    return true;
  }

  // Opaque height of a sprite in world units at a given cell size.
  function height(name, size) {
    const s = JJ.SPRITE_INDEX[name];
    return s ? ((s[5] - s[3]) * size) / 16 : size;
  }

  return {
    draw,
    height,
    get ready() {
      return ready;
    },
    onReady(fn) {
      if (ready) fn();
      else listeners.push(fn);
    },
  };
})();

// ---------------------------------------------------------------- DOM icons
// Pixel-art icons for menus/HUD as CSS sprites cut from the same atlas.
JJ.ATLAS_ROWS = Math.max(...Object.values(JJ.SPRITE_INDEX).map((s) => s[1])) + 1;

JJ.iconStyle = (name, size) => {
  const s = JJ.SPRITE_INDEX[name];
  if (!s) return '';
  return `width:${size}px;height:${size}px;background-size:${16 * size}px ${JJ.ATLAS_ROWS * size}px;background-position:${-s[0] * size}px ${-s[1] * size}px`;
};

// HTML for an inline icon.
JJ.icon = (name, size = 24, cls = '') =>
  JJ.SPRITE_INDEX[name] ? `<i class="px ${cls}" style="${JJ.iconStyle(name, size)}" aria-hidden="true"></i>` : '';

// Upgrade / Armory item -> sprite name.
JJ.upgradeIconName = (id) =>
  ({ magnet: 'magnet', _gold: 'i_gold', _heal: 'i_heal' })[id] || `i_${id}`;

JJ.META_ICONS = {
  toughness: 'heart', might: 'i_might', haste: 'i_haste', fleet: 'i_fleet', magnet: 'magnet', recovery: 'i_regen',
  armor: 'i_armor', growth: 'i_growth', greed: 'i_greed', reroll: 'i_crit', insight: 'i_insight', phoenix: 'i_phoenix',
  extraArm: 'i_extraArm',
};

// Fill <i class="px" data-icon="name" data-size="24"> placeholders.
JJ.hydrateIcons = (root = document) => {
  root.querySelectorAll('i.px[data-icon]').forEach((el) => {
    el.setAttribute('style', JJ.iconStyle(el.dataset.icon, +(el.dataset.size || 24)));
    el.setAttribute('aria-hidden', 'true');
  });
};
