// Package history searches conversations: titles and cached transcripts in
// Anchor's store, plus the Antigravity CLI's own full-text index.
package history

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"github.com/Majidul17068/anchor/internal/paths"
)

// FullTextIDs queries the CLI's conversation_summaries.db FTS5 index and
// returns matching conversation ids. It opens the database read-only and
// tolerates it being locked by a running CLI.
func FullTextIDs(ctx context.Context, query string) ([]string, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, nil
	}
	dbPath := paths.SummariesDB()
	if _, err := os.Stat(dbPath); err != nil {
		return nil, nil
	}
	dsn := fmt.Sprintf("file:%s?mode=ro&_pragma=busy_timeout(1500)&_pragma=query_only(1)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Quote each term so punctuation in user input cannot break FTS syntax.
	var terms []string
	for _, t := range strings.Fields(query) {
		t = strings.ReplaceAll(t, `"`, `""`)
		terms = append(terms, `"`+t+`"`)
	}
	match := strings.Join(terms, " ")
	rows, err := db.QueryContext(ctx, `SELECT DISTINCT conversation_id FROM conversations_fts WHERE conversations_fts MATCH ? LIMIT 200`, match)
	if err != nil {
		// Fall back to a LIKE scan over titles/previews.
		like := "%" + query + "%"
		rows, err = db.QueryContext(ctx, `SELECT conversation_id FROM conversation_summaries WHERE title LIKE ? OR preview LIKE ? LIMIT 200`, like, like)
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}
