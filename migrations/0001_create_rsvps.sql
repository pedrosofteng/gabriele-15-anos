CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('sim', 'nao')),
  phone TEXT NOT NULL DEFAULT '',
  normalized_phone TEXT NOT NULL DEFAULT '',
  companions_json TEXT NOT NULL DEFAULT '[]',
  dietary TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rsvps_normalized_name ON rsvps (normalized_name);
CREATE INDEX IF NOT EXISTS idx_rsvps_normalized_phone ON rsvps (normalized_phone);
CREATE INDEX IF NOT EXISTS idx_rsvps_updated_at ON rsvps (updated_at DESC);
