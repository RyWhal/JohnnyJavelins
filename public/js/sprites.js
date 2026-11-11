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
