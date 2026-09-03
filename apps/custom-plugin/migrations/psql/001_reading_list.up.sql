CREATE TABLE IF NOT EXISTS sys_reading_list (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT        NOT NULL DEFAULT '',
    user_id     UUID        NOT NULL,
    schema_name TEXT        NOT NULL,
    entry_id    UUID        NOT NULL,
    note        TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every query filters by tenant and user together, so the index leads with both.
CREATE INDEX IF NOT EXISTS idx_reading_list_tenant_user
    ON sys_reading_list (tenant_id, user_id, created_at DESC);

-- One user saves a given entry once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_list_unique_entry
    ON sys_reading_list (tenant_id, user_id, schema_name, entry_id);
