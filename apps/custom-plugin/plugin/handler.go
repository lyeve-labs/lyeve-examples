package plugin

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/lyeve-labs/lyeve-core/pkg/core"
)

type handler struct {
	store  *store
	logger *slog.Logger
}

func (h *handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}

	items, err := h.store.List(r.Context(), userID)
	if err != nil {
		h.logger.Error("list reading list", "err", err)
		// A store failure is the database being unreachable, not the caller's
		// fault, and the raw driver text never reaches the response.
		respondErr(w, http.StatusServiceUnavailable, "could not load the reading list")
		return
	}
	if items == nil {
		items = []Bookmark{}
	}
	respond(w, http.StatusOK, items)
}

func (h *handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}

	var req CreateBookmark
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	entryID, err := req.Validate()
	if err != nil {
		// Validation messages are the caller's own words reflected back, so
		// they are safe to relay verbatim.
		respondErr(w, http.StatusUnprocessableEntity, err.Error()) //nolint:raw-error-text
		return
	}

	bookmark, err := h.store.Create(r.Context(), userID, req.Schema, entryID, req.Note)
	if err != nil {
		h.logger.Error("create bookmark", "err", err)
		respondErr(w, http.StatusServiceUnavailable, "could not save the bookmark")
		return
	}
	respond(w, http.StatusCreated, bookmark)
}

func (h *handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := callerID(w, r)
	if !ok {
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid id")
		return
	}

	deleted, err := h.store.Delete(r.Context(), userID, id)
	if err != nil {
		h.logger.Error("delete bookmark", "err", err)
		respondErr(w, http.StatusServiceUnavailable, "could not remove the bookmark")
		return
	}
	if !deleted {
		respondErr(w, http.StatusNotFound, "no such bookmark")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// callerID reads the authenticated user from the request context. The route is
// declared GroupAuth so the middleware has already rejected anonymous callers.
// This guards against the plugin being remounted somewhere less strict.
func callerID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	claims := core.GetClaims(r.Context())
	if claims == nil {
		respondErr(w, http.StatusUnauthorized, "authentication required")
		return uuid.Nil, false
	}
	id, err := uuid.Parse(claims.UserID)
	if err != nil {
		respondErr(w, http.StatusUnauthorized, "authentication required")
		return uuid.Nil, false
	}
	return id, true
}

func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func respondErr(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}

