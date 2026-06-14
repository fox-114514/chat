CREATE TABLE IF NOT EXISTS files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id     UUID NOT NULL REFERENCES users(id),
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  storage_path    TEXT NOT NULL,
  original_name   TEXT,
  size_bytes      BIGINT NOT NULL,
  mime_type       VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_uploader ON files(uploader_id);
