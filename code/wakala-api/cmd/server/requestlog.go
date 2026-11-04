package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"
)

const (
	requestLogVariable   = "WAKALA_REQUEST_LOG"
	requestLogMCPPath    = "/mcp"
	requestLogBodyLimit  = 256 << 10
	requestLogReplyLimit = 1 << 20
	requestLogToolLimit  = 64
)

type loggedWriter struct {
	http.ResponseWriter
	status   int
	captured *bytes.Buffer
	overflow bool
}

func (w *loggedWriter) Write(p []byte) (int, error) {
	if w.captured != nil && !w.overflow {
		if w.captured.Len()+len(p) > requestLogReplyLimit {
			w.overflow = true
			w.captured = nil
		} else {
			w.captured.Write(p)
		}
	}
	return w.ResponseWriter.Write(p)
}

func (w *loggedWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *loggedWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (w *loggedWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return w.ResponseWriter.(http.Hijacker).Hijack()
}

func (w *loggedWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func withRequestLog(next http.Handler, logger *slog.Logger) http.Handler {
	if os.Getenv(requestLogVariable) != "true" {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		lw := &loggedWriter{ResponseWriter: w, status: http.StatusOK}
		tool := ""
		if r.Method == http.MethodPost && r.URL.Path == requestLogMCPPath && r.Body != nil {
			tool = toolNamedByRequest(r)
			if tool != "" {
				lw.captured = &bytes.Buffer{}
			}
		}
		next.ServeHTTP(lw, r)
		attrs := []any{"method", r.Method, "path", r.URL.Path, "status", lw.status, "ms", time.Since(started).Milliseconds()}
		if tool != "" {
			attrs = append(attrs, "tool", tool)
			if lw.captured != nil {
				if failed, known := toolFailed(lw.captured.Bytes()); known {
					attrs = append(attrs, "tool_error", failed)
				}
			}
		}
		logger.Info("request", attrs...)
	})
}

type rpcCall struct {
	Method string `json:"method"`
	Params struct {
		Name string `json:"name"`
	} `json:"params"`
}

type rpcReply struct {
	Result *struct {
		IsError bool `json:"isError"`
	} `json:"result"`
	Error json.RawMessage `json:"error"`
}

func toolNamedByRequest(r *http.Request) string {
	head, err := io.ReadAll(io.LimitReader(r.Body, requestLogBodyLimit+1))
	r.Body = struct {
		io.Reader
		io.Closer
	}{io.MultiReader(bytes.NewReader(head), r.Body), r.Body}
	if err != nil || len(head) > requestLogBodyLimit {
		return ""
	}
	var call rpcCall
	if json.Unmarshal(head, &call) != nil || call.Method != "tools/call" {
		return ""
	}
	return safeToolName(call.Params.Name)
}

func safeToolName(name string) string {
	if name == "" || len(name) > requestLogToolLimit {
		return "(unnamed)"
	}
	for _, c := range name {
		letter := c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
		if !letter && !(c >= '0' && c <= '9') && c != '_' && c != '-' && c != '.' {
			return "(unnamed)"
		}
	}
	return name
}

func toolFailed(reply []byte) (failed bool, known bool) {
	for _, candidate := range replyCandidates(reply) {
		var parsed rpcReply
		if json.Unmarshal(candidate, &parsed) != nil {
			continue
		}
		if parsed.Result != nil {
			return parsed.Result.IsError, true
		}
		if len(parsed.Error) > 0 && string(parsed.Error) != "null" {
			return true, true
		}
	}
	return false, false
}

func replyCandidates(reply []byte) [][]byte {
	trimmed := bytes.TrimSpace(reply)
	if bytes.HasPrefix(trimmed, []byte("{")) {
		return [][]byte{trimmed}
	}
	var out [][]byte
	for _, line := range bytes.Split(reply, []byte("\n")) {
		if data, ok := bytes.CutPrefix(bytes.TrimRight(line, "\r"), []byte("data:")); ok {
			out = append(out, bytes.TrimSpace(data))
		}
	}
	return out
}
