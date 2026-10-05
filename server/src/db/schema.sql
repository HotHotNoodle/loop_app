-- Loop database schema (SQLite). Deliberately small: 8 tables.

-- A student. Identity comes from university SSO (sso_sub is the IdP's stable subject id).
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  sso_sub       TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  zid           TEXT UNIQUE,
  name          TEXT NOT NULL,
  degree        TEXT NOT NULL DEFAULT 'Undeclared',
  year          TEXT NOT NULL DEFAULT '1st yr',
  interests     TEXT NOT NULL DEFAULT '[]',           -- JSON array of strings
  mode          TEXT NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo', 'group')),
  tone          TEXT NOT NULL DEFAULT 'lilac' CHECK (tone IN ('teal', 'orange', 'lilac')),
  is_demo       INTEGER NOT NULL DEFAULT 0,           -- seeded students who auto-accept squads
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- A friend group registered together. A student belongs to at most one group.
CREATE TABLE IF NOT EXISTS groups (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  looking_for  TEXT NOT NULL DEFAULT 'group' CHECK (looking_for IN ('group', 'plusOne')),
  created_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- Something to do together: a study session, a boba run, a hackathon...
CREATE TABLE IF NOT EXISTS events (
  id               TEXT PRIMARY KEY,                  -- slug
  title            TEXT NOT NULL,
  cohort           TEXT NOT NULL,
  emoji            TEXT NOT NULL,
  accent           TEXT NOT NULL,
  gradient         TEXT NOT NULL,
  duration         TEXT NOT NULL,
  tags             TEXT NOT NULL DEFAULT '[]',        -- JSON array
  open_to          TEXT NOT NULL DEFAULT 'both' CHECK (open_to IN ('solo', 'group', 'both')),
  starts_at        TEXT NOT NULL,                     -- ISO 8601 with offset
  ends_at          TEXT NOT NULL,
  location         TEXT NOT NULL,
  location_detail  TEXT NOT NULL,
  focus            TEXT NOT NULL,
  focus_detail     TEXT NOT NULL,
  interest_tag     TEXT NOT NULL                      -- the interest this event is "about"
);

-- Every swipe. Right swipes are what the matcher looks at.
CREATE TABLE IF NOT EXISTS swipes (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, event_id)
);

-- A matched squad for one event.
CREATE TABLE IF NOT EXISTS squads (
  id          INTEGER PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fit         INTEGER NOT NULL,
  reasons     TEXT NOT NULL DEFAULT '[]',             -- JSON [{title, detail}]
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS squad_members (
  squad_id  INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  PRIMARY KEY (squad_id, user_id)
);

-- Refresh tokens are stored hashed. Rotated on every use; `family` lets us revoke a whole
-- chain if an old (already-rotated) token is ever replayed — a sign it was stolen.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  family      TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_swipes_event ON swipes(event_id, direction);
CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family);
