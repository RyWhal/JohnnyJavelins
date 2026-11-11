// Johnny Javelins Worker: serves the static game and a tiny leaderboard API
// backed by Cloudflare D1. Every leaderboard entry is named "Johnny".

const NAME = 'Johnny';
const TOP_N = 25;
const MIN_SECONDS_BETWEEN_SUBMITS = 20;

// Ranking: dragon slayers first, then longest survival, then most kills.
const ORDER = 'won DESC, time_s DESC, kills DESC, id ASC';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

async function hashIp(ip) {
  const data = new TextEncoder().encode(`johnny-javelins:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

async function leaderboard(env) {
  const { results } = await env.DB.prepare(
    `SELECT time_s, kills, javelins, level, won, bosses, created_at FROM scores ORDER BY ${ORDER} LIMIT ?`,
  ).bind(TOP_N).all();
  const totals = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(javelins), 0) AS j FROM scores').first();
  return json({
    entries: results.map((r, i) => ({ rank: i + 1, name: NAME, ...r, won: !!r.won })),
    total: totals.n,
    totalJavelins: totals.j,
  });
}

async function submit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  // Any name the client sends is ignored. It's always Johnny.
  const time_s = Math.floor(Number(body.time));
  const kills = Math.floor(Number(body.kills));
  const javelins = Math.floor(Number(body.javelins || 0));
  const level = Math.floor(Number(body.level));
  const bosses = Math.floor(Number(body.bosses || 0));
  const won = body.won ? 1 : 0;

  // Sanity checks against obviously impossible runs.
  if (!intIn(time_s, 30, 3600) || !intIn(kills, 0, 200000) || !intIn(level, 1, 400) || !intIn(bosses, 0, 40) ||
      !intIn(javelins, 0, 100000000) || javelins > time_s * 20000) {
    return json({ error: 'Implausible run' }, 400);
  }
  if (won && time_s < 900) return json({ error: 'Implausible run' }, 400);
  if (kills > time_s * 150) return json({ error: 'Implausible run' }, 400);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipHash = await hashIp(ip);
  const now = Date.now();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - MIN_SECONDS_BETWEEN_SUBMITS * 1000)
    .first('n');
  if (recent > 0) return json({ error: 'Slow down, Johnny' }, 429);

  const row = await env.DB.prepare(
    'INSERT INTO scores (time_s, kills, javelins, level, won, bosses, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
  ).bind(time_s, kills, javelins, level, won, bosses, ipHash, now).first();

  // Rank = number of runs strictly better than this one, plus one.
  const better = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM scores
     WHERE won > ?1
        OR (won = ?1 AND time_s > ?2)
        OR (won = ?1 AND time_s = ?2 AND kills > ?3)
        OR (won = ?1 AND time_s = ?2 AND kills = ?3 AND id < ?4)`,
  ).bind(won, time_s, kills, row.id).first('n');
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores').first('n');
  return json({ ok: true, name: NAME, rank: better + 1, total }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/leaderboard' && request.method === 'GET') return leaderboard(env);
    if (url.pathname === '/api/score' && request.method === 'POST') return submit(request, env);
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
