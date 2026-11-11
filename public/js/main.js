// Boot + main loop.
'use strict';

(() => {
  const canvas = document.getElementById('game');
  const ui = new JJ.UI();
  const game = new JJ.Game(ui);
  ui.attach(game);
  const renderer = new JJ.Renderer(canvas, game);
  JJ.Input.bindCanvas(canvas);
  JJ.Audio.setEnabled(JJ.Save.data.settings.sound);

  // Exposed for debugging from the console.
  window.JJ.game = game;
  window.JJ.renderer = renderer;

  // Auto-pause when the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') ui.togglePause();
  });

  ui.openMenu();

  // If a run is clearly struggling, drop to low graphics automatically.
  let slowFor = 0, frameEMA = 1 / 60;
  function watchPerformance(rawDt) {
    if (game.state !== 'playing' || JJ.Save.data.settings.quality === 'low') {
      slowFor = 0;
      return;
    }
    frameEMA = frameEMA * 0.95 + Math.min(rawDt, 0.2) * 0.05;
    slowFor = frameEMA > 0.028 ? slowFor + rawDt : 0;
    if (slowFor > 4) {
      JJ.Save.data.settings.quality = 'low';
      JJ.Save.save();
      ui.toast('Switched to Low graphics for smoother play (change it in Options).', 4);
      slowFor = 0;
    }
  }

  let last = performance.now();
  function frame(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    watchPerformance(rawDt);
    game.update(dt);
    renderer.render(now / 1000, dt);
    ui.updateHUD();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
