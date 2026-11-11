package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func sendAddress(w stepRunWalk, method, target string, as *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	if as != nil {
		req.AddCookie(as)
	}
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func wantAddressRefusal(t *testing.T, label string, rec *httptest.ResponseRecorder, part string) {
	t.Helper()
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("%s: %d %s, want 400", label, rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, "control character") || !strings.Contains(body, part) {
		t.Fatalf("%s: refusal %s does not name the %s", label, body, part)
	}
}

func TestAddress_NulByteInAPathValueAnswers400OnNamedRoutes(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	i := "/instances/" + w.instance
	for _, c := range []struct {
		name, method, path string
	}{
		{"public link key", "GET", i + "/forms/public-links/ab%00cd"},
		{"public link questions", "GET", i + "/forms/public-links/ab%00cd/questions"},
		{"form id", "GET", i + "/forms/ab%00cd"},
		{"poll id", "GET", i + "/forms/ab%00cd/results"},
		{"record id", "GET", i + "/forms/records/ab%00cd"},
		{"member id", "DELETE", i + "/members/ab%00cd"},
		{"approval id", "GET", i + "/approvals/ab%00cd"},
		{"thread id", "GET", i + "/comm/chat/threads/ab%00cd/messages"},
		{"step id", "POST", i + "/steps/ab%00cd/answers"},
		{"instance id", "GET", "/instances/ab%00cd"},
		{"account key id", "DELETE", "/auth/api-keys/ab%00cd"},
	} {
		wantAddressRefusal(t, c.name, sendAddress(w, c.method, c.path, people["owner"]), "path")
	}
}

func TestAddress_NulByteIsRefusedBeforeSignIn(t *testing.T) {
	w, _, _, _ := controlByteWalk(t)
	wantAddressRefusal(t, "anonymous", sendAddress(w, "GET", "/instances/"+w.instance+"/forms/public-links/ab%00cd", nil), "path")
}

func TestAddress_OtherControlCharactersAndBrokenUTF8AreRefused(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	for name, escaped := range map[string]string{"bell": "%07", "escape": "%1b", "unit separator": "%1f"} {
		wantAddressRefusal(t, name, sendAddress(w, "GET", "/instances/"+w.instance+"/forms/public-links/ab"+escaped+"cd", people["owner"]), "path")
	}
	for name, escaped := range map[string]string{"broken utf-8": "%ff", "lone continuation": "%c3"} {
		rec := sendAddress(w, "GET", "/instances/"+w.instance+"/forms/public-links/ab"+escaped+"cd", people["owner"])
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "UTF-8") {
			t.Fatalf("%s: %d %s, want 400 naming UTF-8", name, rec.Code, rec.Body.String())
		}
	}
}

func TestAddress_NulByteInAnyPathValueOfAnyDeclaredRouteAnswers400(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	checked := 0
	for _, op := range (&operationCatalog{}).get(w.deps) {
		parameters := pathParameter.FindAllString(op.Path, -1)
		for position := range parameters {
			seen := -1
			path := pathParameter.ReplaceAllStringFunc(op.Path, func(parameter string) string {
				seen++
				if seen == position {
					return "a%00b"
				}
				if parameter == "{instanceID}" {
					return w.instance
				}
				return "any"
			})
			rec := sendAddress(w, op.Method, path, people["owner"])
			wantAddressRefusal(t, op.Method+" "+path+" ("+op.Action+")", rec, "path")
			checked++
		}
	}
	if checked < 300 {
		t.Fatalf("only %d path values of declared routes were walked", checked)
	}
}

func TestAddress_NulByteInAQueryValueAnswers400(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	i := "/instances/" + w.instance
	for _, target := range []string{
		"/directory?q=a%00b",
		i + "/members?q=a%00b",
		i + "/approvals?status=a%00b",
		i + "/join-requests?pending_only=a%00b",
		i + "/group-roles?group_id=a%00b",
		i + "/forms/anything?scope_id=a%00b",
		i + "/members/names?id=ok&id=a%00b",
		i + "/forms/public-links/anything?q=a%00b",
		i + "/my-open-steps?available=a%00b",
		i + "/forms?" + "a%00b=1",
	} {
		wantAddressRefusal(t, target, sendAddress(w, "GET", target, people["owner"]), "query")
	}
}

func TestAddress_NulByteInAQueryValueOfAnyDeclaredGetRouteAnswers400(t *testing.T) {
	w, _, _, people := controlByteWalk(t)
	checked := 0
	for _, op := range (&operationCatalog{}).get(w.deps) {
		if op.Method != "GET" {
			continue
		}
		path := strings.ReplaceAll(op.Path, "{instanceID}", w.instance)
		path = pathParameter.ReplaceAllString(path, "any") + "?q=a%00b"
		wantAddressRefusal(t, op.Method+" "+path+" ("+op.Action+")", sendAddress(w, op.Method, path, people["owner"]), "query")
		checked++
	}
	if checked < 50 {
		t.Fatalf("only %d declared read routes were walked", checked)
	}
}

func TestAddress_OrdinaryIdsAndSearchTextStillWork(t *testing.T) {
	w, group, _, people := controlByteWalk(t)
	rec := sendAddress(w, "GET", "/instances/"+w.instance, people["owner"])
	if rec.Code != http.StatusOK {
		t.Fatalf("the instance itself: %d %s", rec.Code, rec.Body.String())
	}
	rec = sendAddress(w, "GET", "/instances/"+w.instance+"/actor/groups/"+group, people["owner"])
	if rec.Code != http.StatusOK {
		t.Fatalf("an ordinary group id: %d %s", rec.Code, rec.Body.String())
	}
	for name, target := range map[string]string{
		"accented id":        "/instances/" + w.instance + "/forms/public-links/k%C3%A1rtya",
		"accented search":    "/directory?q=%C3%A1rv%C3%ADzt%C5%B1r%C5%91",
		"emoji search":       "/directory?q=%F0%9F%8C%B3",
		"space and plus":     "/directory?q=Zold+mez%C5%91%20k%C3%B6rzet",
		"tab in search text": "/directory?q=a%09b",
	} {
		rec := sendAddress(w, "GET", target, people["owner"])
		if rec.Code == http.StatusBadRequest && strings.Contains(rec.Body.String(), "control character") {
			t.Fatalf("%s refused as a control character: %s", name, rec.Body.String())
		}
		if rec.Code >= 500 {
			t.Fatalf("%s: %d %s", name, rec.Code, rec.Body.String())
		}
	}
}
