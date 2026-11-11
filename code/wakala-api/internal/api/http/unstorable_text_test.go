package http

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestWriteInternalErr_APostgresNulRefusalAnswers400(t *testing.T) {
	rec := httptest.NewRecorder()
	writeInternalErr(rec, fmt.Errorf("insert: %w", &pgconn.PgError{Code: "22021"}))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("%d %s, want 400", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	writeInternalErr(rec, fmt.Errorf("insert: connection reset"))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("%d %s, want 500 for an unrelated failure", rec.Code, rec.Body.String())
	}
}
