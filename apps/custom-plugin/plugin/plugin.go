// Package plugin implements a reading list: a per-user set of saved content
// entries. It is the smallest plugin that still exercises every part of the
// contract, so it is a working template for a new one.
package plugin

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/lyeve-labs/lyeve-core/pkg/core"
)

// Name is the plugin identifier the engine registers this under.
const Name = "reading-list"

type plugin struct {
	host    core.Host
	store   *store
	handler *handler
	logger  *slog.Logger
}

// New returns a fresh instance. The engine calls this once at boot.
func New() core.Plugin { return &plugin{} }

func (p *plugin) Name() string { return Name }

// Start wires the plugin to the host and applies its migrations.
//
// MigrationDB can be nil when the engine boots without a database, so the
// migration is guarded rather than assumed.
func (p *plugin) Start(ctx context.Context, host core.Host) error {
	p.host = host
	p.logger = host.Logger(ctx).With("plugin", Name)

	rawDB := host.MigrationDB()
	p.store = newStore(host, rawDB)
	if rawDB != nil {
		if err := p.store.Migrate(ctx); err != nil {
			return err
		}
	}
	p.handler = &handler{store: p.store, logger: p.logger}

	// Deleting a tenant has to take this table with it, and the engine can only
	// know that if the plugin says so.
	core.RegisterTenantPurgeHandler(p.store.PurgeTenantData)
	core.RegisterCoveredTable("sys_reading_list")

	return nil
}

// Stop is a no-op because the plugin holds no workers or connections of its own.
func (p *plugin) Stop(_ context.Context) error { return nil }

// Routes declares the plugin's endpoints.
//
// GroupAuth puts them on the public API router behind authentication, which is
// what a per-user feature wants: the caller is whoever holds the token, not an
// administrator acting on someone's behalf.
func (p *plugin) Routes() []core.RouteDecl {
	return []core.RouteDecl{
		{Method: "GET", Pattern: "/api/v1/reading-list", Handler: http.HandlerFunc(p.handler.List), Group: core.GroupAuth},
		{Method: "POST", Pattern: "/api/v1/reading-list", Handler: http.HandlerFunc(p.handler.Create), Group: core.GroupAuth},
		{Method: "DELETE", Pattern: "/api/v1/reading-list/{id}", Handler: http.HandlerFunc(p.handler.Delete), Group: core.GroupAuth},
	}
}
