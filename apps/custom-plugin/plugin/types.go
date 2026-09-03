package plugin

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Bookmark is one saved content entry belonging to one user.
type Bookmark struct {
	ID        uuid.UUID `json:"id"`
	TenantID  string    `json:"tenant_id"`
	UserID    uuid.UUID `json:"user_id"`
	Schema    string    `json:"schema"`
	EntryID   uuid.UUID `json:"entry_id"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateBookmark is the accepted request body for saving an entry.
type CreateBookmark struct {
	Schema  string `json:"schema"`
	EntryID string `json:"entry_id"`
	Note    string `json:"note"`
}

const maxNoteLength = 500

var (
	errSchemaRequired = errors.New("schema is required")
	errEntryRequired  = errors.New("entry_id is required")
	errEntryInvalid   = errors.New("entry_id must be a uuid")
	errNoteTooLong    = errors.New("note must be 500 characters or fewer")
)

// Validate normalizes the request and reports the first problem with it.
//
// Trimming happens before the empty checks so that a field of spaces is
// rejected rather than stored.
func (c *CreateBookmark) Validate() (uuid.UUID, error) {
	c.Schema = strings.TrimSpace(c.Schema)
	c.Note = strings.TrimSpace(c.Note)

	if c.Schema == "" {
		return uuid.Nil, errSchemaRequired
	}
	if strings.TrimSpace(c.EntryID) == "" {
		return uuid.Nil, errEntryRequired
	}
	entryID, err := uuid.Parse(strings.TrimSpace(c.EntryID))
	if err != nil {
		return uuid.Nil, errEntryInvalid
	}
	if len([]rune(c.Note)) > maxNoteLength {
		return uuid.Nil, errNoteTooLong
	}
	return entryID, nil
}
