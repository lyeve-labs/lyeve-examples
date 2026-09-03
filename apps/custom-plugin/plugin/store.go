package plugin

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/lyeve-labs/lyeve-core/pkg/core"

	"github.com/lyeve-labs/lyeve-examples/custom-plugin/migrations"
)

type store struct {
	host core.Host
	db   *sql.DB // migrations only. Every query goes through the host's querier
}

func newStore(host core.Host, db *sql.DB) *store {
	return &store{host: host, db: db}
}

const readingListMigrationsTable = "plugin_reading_list_schema_migrations"

func (s *store) Migrate(ctx context.Context) error {
	return core.PluginMigrate(ctx, s.db, s.host.Dialect(), migrations.Files, readingListMigrationsTable)
}

// List returns one user's bookmarks, newest first.
//
// The tenant is filtered explicitly. sys_* tables live in the default schema
// and are not replicated per tenant, so the search_path or USE that scopes a
// connection isolates nothing here: the tenant_id predicate is the boundary.
func (s *store) List(ctx context.Context, userID uuid.UUID) ([]Bookmark, error) {
	tenantID := core.TenantIDFromCtx(ctx)

	rows, err := s.host.Querier(ctx).Query(ctx, `
		SELECT id, tenant_id, user_id, schema_name, entry_id, note, created_at
		FROM sys_reading_list
		WHERE tenant_id = $1 AND user_id = $2
		ORDER BY created_at DESC`, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("list reading list: %w", err)
	}
	defer rows.Close()

	var out []Bookmark
	for rows.Next() {
		var b Bookmark
		if err := rows.Scan(&b.ID, &b.TenantID, &b.UserID, &b.Schema, &b.EntryID, &b.Note, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan reading list row: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *store) Create(ctx context.Context, userID uuid.UUID, schema string, entryID uuid.UUID, note string) (*Bookmark, error) {
	tenantID := core.TenantIDFromCtx(ctx)
	b := Bookmark{
		ID: uuid.New(), TenantID: tenantID, UserID: userID,
		Schema: schema, EntryID: entryID, Note: note,
	}

	row, err := s.host.Querier(ctx).QueryRow(ctx, `
		INSERT INTO sys_reading_list (id, tenant_id, user_id, schema_name, entry_id, note)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at`,
		b.ID, b.TenantID, b.UserID, b.Schema, b.EntryID, b.Note)
	if err != nil {
		return nil, fmt.Errorf("create bookmark: %w", err)
	}
	if err := row.Scan(&b.CreatedAt); err != nil {
		return nil, fmt.Errorf("scan created bookmark: %w", err)
	}
	return &b, nil
}

// Delete removes a bookmark, scoped to its owner so one user cannot delete
// another's row by guessing an id.
func (s *store) Delete(ctx context.Context, userID, id uuid.UUID) (bool, error) {
	tenantID := core.TenantIDFromCtx(ctx)

	tag, err := s.host.Querier(ctx).Exec(ctx,
		`DELETE FROM sys_reading_list WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
		id, userID, tenantID)
	if err != nil {
		return false, fmt.Errorf("delete bookmark: %w", err)
	}
	return tag.RowsAffected > 0, nil
}

// PurgeTenantData is called by the engine when a tenant is deleted. The engine
// supplies the querier so the delete joins whatever transaction it is running.
func (s *store) PurgeTenantData(ctx context.Context, q core.Querier, tenantID string) error {
	if _, err := q.Exec(ctx,
		`DELETE FROM sys_reading_list WHERE tenant_id = $1`, tenantID); err != nil {
		return fmt.Errorf("purge reading list for tenant: %w", err)
	}
	return nil
}
