package http

import (
	"net/http"
	"strings"
	"testing"
)

func TestPublicFormDoor_StrangerDeclaredTextWithControlBytesIsRefusedNamingTheField(t *testing.T) {
	p := newDeclaredGroupProbe(t)
	registered := p.stranger(t, p.door+"/respondents", map[string]any{})
	if registered.Code != http.StatusOK {
		t.Fatalf("stranger registering: %d %s", registered.Code, registered.Body.String())
	}
	respondent := decodeObject(t, registered)
	declare := func(text string) (int, string) {
		rec := p.stranger(t, p.door+"/declarations", map[string]any{
			"respondent_id": respondent["id"], "public_key": respondent["public_key"], "declared_text": text,
		})
		return rec.Code, rec.Body.String()
	}

	for label, text := range map[string]string{
		"nul":    "a\u0000b",
		"bell":   "Mill\u0007Street",
		"escape": "Mill\u001bStreet",
		"delete": "Mill\u007fStreet",
	} {
		code, body := declare(text)
		if code != http.StatusBadRequest {
			t.Errorf("%s: declared_text %q answered %d %s, want 400", label, text, code, body)
		}
		if !strings.Contains(body, "declared_text") {
			t.Errorf("%s: the refusal %s does not name declared_text", label, body)
		}
	}

	for label, text := range map[string]string{
		"plain":             "Mill Street",
		"hungarian":         "Árvíztűrő tükörfúrógép utca",
		"several lines":     "Kertváros\nMalom utca 4.\r\nBelváros",
		"tab":               "Malom utca\t4.",
		"markup":            "<script>alert(1)</script>",
		"empty":             "",
		"zero width joiner": "क्‍ष",
	} {
		if code, body := declare(text); code != http.StatusCreated {
			t.Errorf("control %s: declared_text %q answered %d %s, want 201", label, text, code, body)
		}
	}
}
