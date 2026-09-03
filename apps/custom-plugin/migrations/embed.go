// Package migrations exposes this plugin's SQL as an embedded filesystem.
//
// Filenames follow {version}_{title}.{up,down}.sql so they sort
// lexicographically, which is the order they are applied in.
package migrations

import "embed"

// Files is consumed by the store's Migrate through core.PluginMigrate, which
// picks the subdirectory matching the running dialect.
//
//go:embed psql/*.up.sql psql/*.down.sql mysql/*.up.sql mysql/*.down.sql mssql/*.up.sql mssql/*.down.sql
var Files embed.FS
