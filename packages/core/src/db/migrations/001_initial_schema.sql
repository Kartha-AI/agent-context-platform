CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS context_objects (
  object_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type     TEXT NOT NULL,
  subtype         TEXT NOT NULL,
  canonical_name  TEXT NOT NULL,
  context         JSONB NOT NULL DEFAULT '{}',
  summary         TEXT,
  embedding       vector(1536),
  source_refs     JSONB NOT NULL DEFAULT '[]',
  confidence      FLOAT NOT NULL DEFAULT 1.0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objects_type ON context_objects (object_type, subtype);
CREATE INDEX IF NOT EXISTS idx_objects_name ON context_objects USING gin (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_objects_context ON context_objects USING gin (context jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_objects_updated ON context_objects (updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_objects_source_key
  ON context_objects (object_type, subtype, ((source_refs->0->>'system') || ':' || (source_refs->0->>'id')));

CREATE TABLE IF NOT EXISTS context_transactions (
  transaction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id        UUID NOT NULL REFERENCES context_objects(object_id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context          JSONB NOT NULL DEFAULT '{}',
  actors           JSONB,
  measures         JSONB,
  source_ref       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txns_object ON context_transactions (object_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_txns_type ON context_transactions (transaction_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS change_log (
  change_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id        UUID NOT NULL,
  object_type      TEXT NOT NULL,
  subtype          TEXT NOT NULL,
  change_type      TEXT NOT NULL,
  changes          JSONB,
  context_snapshot JSONB,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_poll ON change_log (changed_at DESC, object_type, subtype);
