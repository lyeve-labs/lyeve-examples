IF OBJECT_ID(N'sys_reading_list', N'U') IS NULL
CREATE TABLE sys_reading_list (
    id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    tenant_id   NVARCHAR(255)    NOT NULL DEFAULT '',
    user_id     UNIQUEIDENTIFIER NOT NULL,
    schema_name NVARCHAR(255)    NOT NULL,
    entry_id    UNIQUEIDENTIFIER NOT NULL,
    note        NVARCHAR(MAX)    NOT NULL DEFAULT '',
    created_at  DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_reading_list_tenant_user')
CREATE INDEX idx_reading_list_tenant_user
    ON sys_reading_list (tenant_id, user_id, created_at DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_reading_list_unique_entry')
CREATE UNIQUE INDEX idx_reading_list_unique_entry
    ON sys_reading_list (tenant_id, user_id, schema_name, entry_id);
