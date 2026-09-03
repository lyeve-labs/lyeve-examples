package plugin

import (
	"errors"
	"strings"
	"testing"
)

func TestCreateBookmark_Validate(t *testing.T) {
	const validEntry = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"

	tests := []struct {
		name    string
		input   CreateBookmark
		wantErr error
	}{
		{
			name:  "accepts a complete request",
			input: CreateBookmark{Schema: "blog_posts", EntryID: validEntry, Note: "worth rereading"},
		},
		{
			name:  "accepts an empty note",
			input: CreateBookmark{Schema: "blog_posts", EntryID: validEntry},
		},
		{
			name:    "rejects a missing schema",
			input:   CreateBookmark{EntryID: validEntry},
			wantErr: errSchemaRequired,
		},
		{
			name:    "rejects a schema of only spaces",
			input:   CreateBookmark{Schema: "   ", EntryID: validEntry},
			wantErr: errSchemaRequired,
		},
		{
			name:    "rejects a missing entry",
			input:   CreateBookmark{Schema: "blog_posts"},
			wantErr: errEntryRequired,
		},
		{
			name:    "rejects an entry that is not a uuid",
			input:   CreateBookmark{Schema: "blog_posts", EntryID: "not-a-uuid"},
			wantErr: errEntryInvalid,
		},
		{
			name:    "rejects a note over the limit",
			input:   CreateBookmark{Schema: "blog_posts", EntryID: validEntry, Note: strings.Repeat("a", maxNoteLength+1)},
			wantErr: errNoteTooLong,
		},
		{
			name:  "counts characters rather than bytes",
			input: CreateBookmark{Schema: "blog_posts", EntryID: validEntry, Note: strings.Repeat("é", maxNoteLength)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := tt.input
			entryID, err := input.Validate()

			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("got error %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if entryID.String() != validEntry {
				t.Fatalf("got entry id %s, want %s", entryID, validEntry)
			}
		})
	}
}

func TestCreateBookmark_ValidateTrimsInput(t *testing.T) {
	input := CreateBookmark{
		Schema:  "  blog_posts  ",
		EntryID: "  3f2504e0-4f89-11d3-9a0c-0305e82c3301  ",
		Note:    "  saved for later  ",
	}

	if _, err := input.Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if input.Schema != "blog_posts" {
		t.Errorf("schema was not trimmed: %q", input.Schema)
	}
	if input.Note != "saved for later" {
		t.Errorf("note was not trimmed: %q", input.Note)
	}
}
