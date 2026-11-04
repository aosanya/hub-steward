package http

import (
	"bytes"
	"io"
	"net/http"
)

type jsonShape struct {
	depth         int
	topLevelItems int
	startsAsArray bool
}

func measureJSON(body []byte) jsonShape {
	var shape jsonShape
	depth, inString, escaped, itemOpen := 0, false, false, false
	startItem := func() {
		if depth == 1 && shape.startsAsArray && !itemOpen {
			itemOpen = true
			shape.topLevelItems++
		}
	}
	for _, c := range body {
		if inString {
			switch {
			case escaped:
				escaped = false
			case c == '\\':
				escaped = true
			case c == '"':
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			startItem()
			inString = true
		case '[', '{':
			if depth == 0 {
				shape.startsAsArray = c == '['
			}
			startItem()
			depth++
			if depth > shape.depth {
				shape.depth = depth
			}
		case ']', '}':
			depth--
		case ',':
			if depth == 1 {
				itemOpen = false
			}
		case ' ', '\t', '\r', '\n':
		default:
			startItem()
		}
	}
	return shape
}

func guardMCPBody(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Body == nil {
			next(w, r)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		shape := measureJSON(body)
		if shape.depth > maxMCPNesting {
			writeErr(w, http.StatusBadRequest, "request is nested too deeply")
			return
		}
		if shape.startsAsArray && shape.topLevelItems > maxMCPBatchElements {
			writeErr(w, http.StatusBadRequest, "batch carries too many messages")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		next(w, r)
	}
}
