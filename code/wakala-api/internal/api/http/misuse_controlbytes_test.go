package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"wakalaserver/internal/apikeys"
)

type controlByteCase struct {
	name   string
	method string
	path   string
	body   string
	field  string
	as     string
}

func controlByteCases(instance, group, actor string) []controlByteCase {
	i := "/instances/" + instance
	return []controlByteCase{
		{"actor display name", "PATCH", i + "/actor/actors/" + actor + "/display-name", `{"display_name":"a\u0000b"}`, "display_name", "owner"},
		{"join message", "POST", i + "/actor/groups/" + group + "/join", `{"message":"a\u0000b"}`, "message", "resident"},
		{"hierarchy name", "POST", i + "/actor/hierarchies", `{"name":"a\u0000b"}`, "name", "owner"},
		{"role kind name", "POST", i + "/actor/role-kinds", `{"name":"a\u0000b"}`, "name", "owner"},
		{"actor create", "POST", i + "/actor/actors", `{"display_name":"a\u0000b"}`, "display_name", "owner"},
		{"group name translation", "PUT", i + "/actor/groups/" + group + "/names/hu", `{"name":"a\u0000b"}`, "name", "owner"},
		{"population source", "POST", i + "/actor/groups/" + group + "/population", `{"population":5,"as_of":"2026-01-01","source":"a\u0000b"}`, "source", "owner"},
		{"consent language", "POST", i + "/custody/consent/agree", `{"language":"a\u0000b"}`, "language", "resident"},
		{"consent version", "POST", i + "/custody/consent/versions", `{"version":"a\u0000b"}`, "version", "owner"},
		{"agent user id", "POST", i + "/agents", `{"user_id":"a\u0000b"}`, "user_id", "owner"},
		{"instance api key name", "POST", i + "/api-keys", `{"name":"a\u0000b"}`, "name", "owner"},
		{"reports setting value", "PUT", "/reports/settings/anything", `{"value":"a\u0000b"}`, "value", "owner"},
		{"account api key name", "POST", "/auth/api-keys", `{"name":"a\u0000b"}`, "name", "resident"},
	}
}

func sendRaw(w stepRunWalk, method, path, body, contentType string, as *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	req.AddCookie(as)
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func controlByteWalk(t *testing.T) (stepRunWalk, string, string, map[string]*http.Cookie) {
	t.Helper()
	w := newStepRunWalk(t, nil)
	keys, err := apikeys.NewManager(w.db)
	if err != nil {
		t.Fatalf("apikeys.NewManager: %v", err)
	}
	w.deps.APIKeys = keys
	w.handler = NewRouter(w.deps)
	rec := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Kertváros körzet"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner creates a group: %d %s", rec.Code, rec.Body.String())
	}
	group, _ := decodeObject(t, rec)["id"].(string)
	rec = w.call(t, "POST", "/instances/"+w.instance+"/actor/actors", map[string]any{"display_name": "Kovács Anna"}, w.owner)
	actor, _ := decodeObject(t, rec)["id"].(string)
	if actor == "" {
		t.Fatalf("owner creates an actor: %d %s", rec.Code, rec.Body.String())
	}
	people := map[string]*http.Cookie{"owner": w.owner, "resident": w.cookieFor(t, "res-a")}
	return w, group, actor, people
}

func TestRequestBody_NulByteInAnyListedFieldAnswers400NamingTheField(t *testing.T) {
	w, group, actor, people := controlByteWalk(t)
	for _, c := range controlByteCases(w.instance, group, actor) {
		t.Run(c.name, func(t *testing.T) {
			rec := sendRaw(w, c.method, c.path, c.body, "application/json", people[c.as])
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("%s %s: %d %s, want 400", c.method, c.path, rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), c.field) {
				t.Fatalf("%s: refusal %s does not name %q", c.name, rec.Body.String(), c.field)
			}
		})
	}
}

func TestRequestBody_NulByteIsRefusedWhateverTheContentTypeClaims(t *testing.T) {
	w, group, actor, people := controlByteWalk(t)
	for _, contentType := range []string{"", "text/plain", "application/json; charset=utf-8", "application/vnd.api+json"} {
		for _, c := range controlByteCases(w.instance, group, actor) {
			rec := sendRaw(w, c.method, c.path, c.body, contentType, people[c.as])
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("%s as %q: %d %s, want 400", c.name, contentType, rec.Code, rec.Body.String())
			}
		}
	}
}

func TestRequestBody_OtherControlCharactersAndNestedStringsAreRefusedToo(t *testing.T) {
	w, group, _, people := controlByteWalk(t)
	path := "/instances/" + w.instance + "/actor/groups/" + group + "/join"
	for name, body := range map[string]string{
		"bell":           `{"message":"a\u0007b"}`,
		"escape":         `{"message":"a\u001bb"}`,
		"unit separator": `{"message":"a\u001fb"}`,
		"literal nul":    "{\"message\":\"a\x00b\"}",
		"nested":         `{"message":"ok","extra":{"deep":[1,{"x":"a\u0000b"}]}}`,
		"object key":     `{"me\u0000ssage":"x"}`,
	} {
		rec := sendRaw(w, "POST", path, body, "application/json", people["resident"])
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: %d %s, want 400", name, rec.Code, rec.Body.String())
		}
	}
}

func TestRequestBody_OrdinaryTextStaysAccepted(t *testing.T) {
	w, group, _, people := controlByteWalk(t)
	path := "/instances/" + w.instance + "/actor/groups/" + group + "/join"
	for name, message := range map[string]string{
		"accents":  "Szeretnék csatlakozni a körzethez: árvíztűrő tükörfúrógép",
		"newlines": "első sor\nmásodik sor\r\nharmadik sor",
		"tabs":     "oszlop\tmásik oszlop",
		"emoji":    "Köszönöm 🌳🙂",
	} {
		rec := sendRaw(w, "POST", path, `{"message":`+jsonString(message)+`}`, "application/json", people["resident"])
		if rec.Code == http.StatusBadRequest && strings.Contains(rec.Body.String(), "control character") {
			t.Fatalf("%s refused as a control character: %s", name, rec.Body.String())
		}
	}
	rec := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Zöldmező 🌳"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("a group name with accents and an emoji: %d %s", rec.Code, rec.Body.String())
	}
}

func TestRequestBody_BinaryAndMultipartBodiesAreNotRead(t *testing.T) {
	w, group, _, people := controlByteWalk(t)
	path := "/instances/" + w.instance + "/actor/groups/" + group + "/join"
	for _, contentType := range []string{"application/octet-stream", "multipart/form-data; boundary=x", "application/x-git-upload-pack-request", "image/png"} {
		rec := sendRaw(w, "POST", path, "{\"message\":\"a\x00b\"}", contentType, people["resident"])
		if strings.Contains(rec.Body.String(), "control character") {
			t.Fatalf("%s body was scanned: %d %s", contentType, rec.Code, rec.Body.String())
		}
	}
	rec := sendRaw(w, "POST", path, "\x89PNG\r\n\x1a\n\x00\x00\x00", "", people["resident"])
	if strings.Contains(rec.Body.String(), "control character") {
		t.Fatalf("a body that is not JSON was scanned: %d %s", rec.Code, rec.Body.String())
	}
}

func TestRequestBody_TheBodyCapStillAnswers413(t *testing.T) {
	w, group, _, people := controlByteWalk(t)
	path := "/instances/" + w.instance + "/actor/groups/" + group + "/join"
	big := `{"message":"` + strings.Repeat("a", maxRequestBody+10) + `"}`
	rec := sendRaw(w, "POST", path, big, "application/json", people["resident"])
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("an oversized body: %d, want 413", rec.Code)
	}
}

func TestRequestBody_EveryMCPToolArgumentGetsTheSameRefusal(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	body := `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"actor_create_hierarchy","arguments":{"instance_id":"` + w.instance + `","name":"a\u0000b"}}}`
	rec := sendRaw(w, "POST", "/mcp", body, "application/json", people["owner"])
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "name") {
		t.Fatalf("an MCP tool call with a NUL byte: %d %s, want 400 naming the field", rec.Code, rec.Body.String())
	}
}

func jsonString(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

var pathParameter = regexp.MustCompile(`\{[^}]+\}`)

func TestRequestBody_NulByteInAStringOfAnyDeclaredWriteRouteAnswers400(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	checked := 0
	for _, op := range (&operationCatalog{}).get(w.deps) {
		if op.Method != "POST" && op.Method != "PUT" && op.Method != "PATCH" {
			continue
		}
		path := strings.ReplaceAll(op.Path, "{instanceID}", w.instance)
		path = pathParameter.ReplaceAllString(path, "any")
		for _, body := range []string{`{"text":"a\u0000b"}`, `{"list":[{"inner":"a\u0000b"}]}`} {
			rec := sendRaw(w, op.Method, path, body, "application/json", people["owner"])
			if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "control character") {
				t.Fatalf("%s %s (%s): %d %s, want 400 for a NUL byte", op.Method, path, op.Action, rec.Code, rec.Body.String())
			}
		}
		checked++
	}
	if checked < 100 {
		t.Fatalf("only %d declared write routes were walked", checked)
	}
}
