CREATE TABLE IF NOT EXISTS sys_reading_list (
    id          CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    tenant_id   VARCHAR(255) NOT NULL DEFAULT '',
    user_id     CHAR(36)     NOT NULL,
    schema_name VARCHAR(255) NOT NULL,
    entry_id    CHAR(36)     NOT NULL,
    note        LONGTEXT     NOT NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT NOW(6)
) ENGINE=InnoDB;

CREATE INDEX idx_reading_list_tenant_user
    ON sys_reading_list (tenant_id, user_id, created_at DESC);

CREATE UNIQUE INDEX idx_reading_list_unique_entry
    ON sys_reading_list (tenant_id, user_id, schema_name, entry_id);
