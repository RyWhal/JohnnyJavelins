-- Leaderboard runs. Every entry is "Johnny"; the name is not stored.
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  time_s     INTEGER NOT NULL,           -- seconds survived
  kills      INTEGER NOT NULL,
  level      INTEGER NOT NULL,
  won        INTEGER NOT NULL DEFAULT 0, -- 1 if the dragon was slain
  bosses     INTEGER NOT NULL DEFAULT 0,
  ip_hash    TEXT    NOT NULL,           -- salted hash, only for rate limiting
  created_at INTEGER NOT NULL            -- unix ms
);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (won DESC, time_s DESC, kills DESC);
CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores (ip_hash, created_at);
