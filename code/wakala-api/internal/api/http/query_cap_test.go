package http

import (
	"net/http"
	"strings"
	"testing"
)

const queryCapSegments = 10000

func queryOf(segments int) string {
	return strings.TrimSuffix(strings.Repeat("status=x&", segments), "&")
}

func queryRoutes(instance string) map[string]string {
	return map[string]string{
		"module route":       "/instances/" + instance + "/actor/groups?",
		"hand-written route": "/instances/" + instance + "/approvals?",
		"git route":          "/git/agency/repo/info/refs?",
	}
}

func TestQueryCap_OverTheCapIsRefusedWith400OnEveryKindOfRoute(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	for name, prefix := range queryRoutes(w.instance) {
		rec := sendAddress(w, "GET", prefix+queryOf(queryCapSegments+1), people["owner"])
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: %d %s, want 400", name, rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "too many parameters") {
			t.Fatalf("%s: refusal %s does not name the parameter cap", name, rec.Body.String())
		}
	}
}

func TestQueryCap_ExactlyTheCapIsStillAnswered(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	for name, prefix := range queryRoutes(w.instance) {
		plain := sendAddress(w, "GET", prefix+queryOf(1), people["owner"])
		full := sendAddress(w, "GET", prefix+queryOf(queryCapSegments), people["owner"])
		if full.Code == http.StatusBadRequest || full.Code != plain.Code {
			t.Fatalf("%s: %d %s, want the %d a one-parameter query gets", name, full.Code, full.Body.String(), plain.Code)
		}
	}
}

func TestQueryCap_ABadEscapeAndASemicolonAreStillAnswered(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	plain := sendAddress(w, "GET", "/instances/"+w.instance+"/approvals?status=x", people["owner"])
	for cause, query := range map[string]string{
		"bad escape": "status=%zz&status=x",
		"semicolon":  "status=x;y=z",
	} {
		rec := sendAddress(w, "GET", "/instances/"+w.instance+"/approvals?"+query, people["owner"])
		if rec.Code != plain.Code {
			t.Fatalf("%s: %d %s, want the %d a plain query gets", cause, rec.Code, rec.Body.String(), plain.Code)
		}
	}
}
