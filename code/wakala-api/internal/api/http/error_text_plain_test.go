package http

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
)

func TestRecordRowRefusalsAnswerWithoutPackageOrFunctionNames(t *testing.T) {
	rec := httptest.NewRecorder()
	writeRecordErr(rec, fmt.Errorf("CreateRecordRow: %w", mwanachamaagency.ErrDuplicateRecordRow))
	if rec.Code != http.StatusConflict {
		t.Fatalf("status %d, want 409", rec.Code)
	}
	body := rec.Body.String()
	for _, leak := range []string{"mwanachama", "CreateRecordRow"} {
		if strings.Contains(body, leak) {
			t.Fatalf("%s names %q", body, leak)
		}
	}
	if !strings.Contains(body, "the same answers were saved a moment ago") {
		t.Fatalf("%s lost the reason", body)
	}
}
