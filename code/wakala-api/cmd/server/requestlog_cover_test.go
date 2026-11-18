package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSafeToolName(t *testing.T) {
	cases := map[string]string{
		"agency_create_goal":                     "agency_create_goal",
		"Tool-1.v2":                              "Tool-1.v2",
		"":                                       "(unnamed)",
		"has space":                              "(unnamed)",
		"semi;colon":                             "(unnamed)",
		"new\nline":                              "(unnamed)",
		strings.Repeat("a", requestLogToolLimit): strings.Repeat("a", requestLogToolLimit),
		strings.Repeat("a", requestLogToolLimit+1): "(unnamed)",
	}
	for in, want := range cases {
		if got := safeToolName(in); got != want {
			t.Errorf("safeToolName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestToolFailedReadsPlainAndStreamedReplies(t *testing.T) {
	cases := []struct {
		name   string
		reply  string
		failed bool
		known  bool
	}{
		{"plain success", `{"result":{"isError":false}}`, false, true},
		{"plain tool error", `{"result":{"isError":true}}`, true, true},
		{"rpc error", `{"error":{"code":-32602,"message":"bad"}}`, true, true},
		{"null error is not a failure", `{"error":null}`, false, false},
		{"streamed success", "event: message\r\ndata: {\"result\":{\"isError\":false}}\r\n\r\n", false, true},
		{"streamed tool error", "event: message\ndata: {\"result\":{\"isError\":true}}\n\n", true, true},
		{"streamed skips unparsable lines", "data: not json\ndata: {\"result\":{\"isError\":true}}\n", true, true},
		{"empty", ``, false, false},
		{"unrelated body", `<html></html>`, false, false},
	}
	for _, c := range cases {
		failed, known := toolFailed([]byte(c.reply))
		if failed != c.failed || known != c.known {
			t.Errorf("%s: toolFailed = (%v, %v), want (%v, %v)", c.name, failed, known, c.failed, c.known)
		}
	}
}

func TestToolNamedByRequestRestoresTheBody(t *testing.T) {
	body := `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"agency_list_goals"}}`
	r := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(body))
	if got := toolNamedByRequest(r); got != "agency_list_goals" {
		t.Fatalf("tool = %q", got)
	}
	again, _ := io.ReadAll(r.Body)
	if string(again) != body {
		t.Fatalf("body after reading = %q, want it replayed intact", again)
	}
}

func TestToolNamedByRequestIgnoresOtherCallsAndBadBodies(t *testing.T) {
	cases := map[string]string{
		"not a tool call": `{"method":"tools/list"}`,
		"not json":        `hello`,
		"oversized":       `{"method":"tools/call","params":{"name":"x"},"pad":"` + strings.Repeat("a", requestLogBodyLimit) + `"}`,
	}
	for name, body := range cases {
		r := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(body))
		if got := toolNamedByRequest(r); got != "" {
			t.Errorf("%s: tool = %q, want none", name, got)
		}
		replayed, _ := io.ReadAll(r.Body)
		if string(replayed) != body {
			t.Errorf("%s: the body was not replayed whole", name)
		}
	}
}

func TestToolNamedByRequestHidesAnUnsafeName(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(`{"method":"tools/call","params":{"name":"evil\nINJECT"}}`))
	if got := toolNamedByRequest(r); got != "(unnamed)" {
		t.Fatalf("tool = %q", got)
	}
}

func logRecords(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("log line %q: %v", line, err)
		}
		out = append(out, rec)
	}
	return out
}

func jsonLogger(buf *bytes.Buffer) *slog.Logger {
	return slog.New(slog.NewJSONHandler(buf, nil))
}

func TestWithRequestLogIsPassThroughUnlessSwitchedOn(t *testing.T) {
	t.Setenv(requestLogVariable, "")
	var buf bytes.Buffer
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTeapot) })
	h := withRequestLog(next, jsonLogger(&buf))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusTeapot || buf.Len() != 0 {
		t.Fatalf("code %d, log %q: must pass through silently", rec.Code, buf.String())
	}
}

func TestWithRequestLogRecordsStatusAndLevel(t *testing.T) {
	t.Setenv(requestLogVariable, "true")
	var buf bytes.Buffer
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/boom":
			w.WriteHeader(http.StatusInternalServerError)
		case "/missing":
			w.WriteHeader(http.StatusNotFound)
		}
	})
	h := withRequestLog(next, jsonLogger(&buf))
	for _, p := range []string{"/ok", "/missing", "/boom"} {
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, p, nil))
	}
	recs := logRecords(t, &buf)
	if len(recs) != 3 {
		t.Fatalf("records = %d", len(recs))
	}
	want := []struct {
		path   string
		status float64
		level  string
	}{{"/ok", 200, "INFO"}, {"/missing", 404, "INFO"}, {"/boom", 500, "ERROR"}}
	for i, w := range want {
		if recs[i]["path"] != w.path || recs[i]["status"] != w.status || recs[i]["level"] != w.level {
			t.Errorf("record %d = %v, want %+v", i, recs[i], w)
		}
		if _, hasTool := recs[i]["tool"]; hasTool {
			t.Errorf("record %d names a tool on a non-mcp path", i)
		}
	}
}

func TestWithRequestLogNamesTheToolAndItsFailure(t *testing.T) {
	t.Setenv(requestLogVariable, "true")
	cases := []struct {
		name      string
		reply     string
		wantError any
	}{
		{"tool error", `{"result":{"isError":true}}`, true},
		{"tool success", `{"result":{"isError":false}}`, false},
		{"unreadable reply", `not json`, nil},
	}
	for _, c := range cases {
		var buf bytes.Buffer
		var seen string
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			b, _ := io.ReadAll(r.Body)
			seen = string(b)
			_, _ = w.Write([]byte(c.reply))
		})
		body := `{"method":"tools/call","params":{"name":"agency_get_goal"}}`
		h := withRequestLog(next, jsonLogger(&buf))
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(body)))
		if seen != body {
			t.Errorf("%s: the handler saw %q, want the body intact", c.name, seen)
		}
		recs := logRecords(t, &buf)
		if len(recs) != 1 || recs[0]["tool"] != "agency_get_goal" {
			t.Fatalf("%s: records = %v", c.name, recs)
		}
		got, present := recs[0]["tool_error"]
		if c.wantError == nil && present {
			t.Errorf("%s: tool_error = %v, want absent", c.name, got)
		}
		if c.wantError != nil && got != c.wantError {
			t.Errorf("%s: tool_error = %v, want %v", c.name, got, c.wantError)
		}
	}
}

func TestWithRequestLogSkipsToolParsingForGetsAndOtherPaths(t *testing.T) {
	t.Setenv(requestLogVariable, "true")
	var buf bytes.Buffer
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	h := withRequestLog(next, jsonLogger(&buf))
	body := `{"method":"tools/call","params":{"name":"agency_get_goal"}}`
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/mcp", strings.NewReader(body)))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/other", strings.NewReader(body)))
	for _, rec := range logRecords(t, &buf) {
		if _, has := rec["tool"]; has {
			t.Errorf("record %v names a tool", rec)
		}
	}
}

func TestLoggedWriterStopsCapturingPastTheReplyLimit(t *testing.T) {
	rec := httptest.NewRecorder()
	lw := &loggedWriter{ResponseWriter: rec, status: http.StatusOK, captured: &bytes.Buffer{}}
	chunk := bytes.Repeat([]byte("a"), requestLogReplyLimit/2+1)
	if _, err := lw.Write(chunk); err != nil || lw.overflow {
		t.Fatalf("first write: err %v overflow %v", err, lw.overflow)
	}
	if _, err := lw.Write(chunk); err != nil {
		t.Fatal(err)
	}
	if !lw.overflow || lw.captured != nil {
		t.Fatalf("overflow %v captured %v: capture must stop past the limit", lw.overflow, lw.captured)
	}
	if rec.Body.Len() != 2*len(chunk) {
		t.Fatalf("client received %d bytes, want all %d", rec.Body.Len(), 2*len(chunk))
	}
}

func TestLoggedWriterRecordsStatusFlushesAndUnwraps(t *testing.T) {
	rec := httptest.NewRecorder()
	lw := &loggedWriter{ResponseWriter: rec, status: http.StatusOK}
	lw.WriteHeader(http.StatusCreated)
	lw.Flush()
	if lw.status != http.StatusCreated || rec.Code != http.StatusCreated || !rec.Flushed {
		t.Fatalf("status %d code %d flushed %v", lw.status, rec.Code, rec.Flushed)
	}
	if lw.Unwrap() != http.ResponseWriter(rec) {
		t.Fatal("Unwrap must return the wrapped writer")
	}
}
