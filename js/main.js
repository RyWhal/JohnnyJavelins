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

  // Auto-pause when the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') ui.togglePause();
  });

  ui.openMenu();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    renderer.render(now / 1000, dt);
    ui.updateHUD();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
