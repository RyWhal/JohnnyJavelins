// Client for the leaderboard API (Cloudflare Worker + D1).
// There is no name entry: every run on the board belongs to "Johnny".
'use strict';

JJ.Leaderboard = (() => {
  const online = () => location.protocol === 'http:' || location.protocol === 'https:';

  async function top() {
    if (!online()) throw new Error('offline');
    const res = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function submit(run) {
    if (!online()) throw new Error('offline');
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        time: Math.floor(run.time),
        kills: run.kills,
        level: run.level,
        bosses: run.bosses,
        won: !!run.won,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return { top, submit, online };
})();
