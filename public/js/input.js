// Keyboard, mouse and touch (virtual joystick) input.
'use strict';

JJ.Input = (() => {
  const keys = new Set();
  const mouse = { x: 0, y: 0, active: false };
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const pressedHandlers = [];

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = e.key.toLowerCase();
    if (!keys.has(k)) for (const h of pressedHandlers) h(k, e);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  function bindCanvas(canvas) {
    canvas.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });
    const touchStart = (e) => {
      for (const t of e.changedTouches) {
        if (!stick.active) {
          stick.active = true;
          stick.id = t.identifier;
          stick.ox = stick.x = t.clientX;
          stick.oy = stick.y = t.clientY;
        }
      }
      e.preventDefault();
    };
    const touchMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          stick.x = t.clientX;
          stick.y = t.clientY;
        }
      }
      e.preventDefault();
    };
    const touchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          stick.active = false;
          stick.id = null;
        }
      }
    };
    canvas.addEventListener('touchstart', touchStart, { passive: false });
    canvas.addEventListener('touchmove', touchMove, { passive: false });
    canvas.addEventListener('touchend', touchEnd);
    canvas.addEventListener('touchcancel', touchEnd);
  }

  // Returns a movement vector with length <= 1.
  function moveVector() {
    let x = 0, y = 0;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (stick.active) {
      const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        const m = Math.min(1, len / 50);
        x += (dx / len) * m;
        y += (dy / len) * m;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  return {
    keys,
    mouse,
    stick,
    bindCanvas,
    moveVector,
    onPress(fn) {
      pressedHandlers.push(fn);
    },
  };
})();
