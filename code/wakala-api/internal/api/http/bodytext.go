package http

import (
	"bufio"
	"bytes"
	"io"
	"mime"
	"net/http"
	"strings"

	"wakalaserver/modules/shared/plaintext"
)

const bodySniffBytes = 512

func refuseControlCharacters(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body == nil || r.Body == http.NoBody || !mayCarryJSON(r.Header.Get("Content-Type")) {
			next.ServeHTTP(w, r)
			return
		}
		original := r.Body
		peeked := bufio.NewReaderSize(original, bodySniffBytes)
		if !startsLikeJSON(peeked) {
			r.Body = readCloser{Reader: peeked, Closer: original}
			next.ServeHTTP(w, r)
			return
		}
		raw, err := io.ReadAll(peeked)
		if err != nil {
			writeReadErr(w, err)
			return
		}
		if err := plaintext.CheckJSONStrings(raw); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		r.Body = readCloser{Reader: bytes.NewReader(raw), Closer: original}
		next.ServeHTTP(w, r)
	})
}

type readCloser struct {
	io.Reader
	io.Closer
}

func mayCarryJSON(contentType string) bool {
	if contentType == "" {
		return true
	}
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return false
	}
	return mediaType == "application/json" || mediaType == "text/plain" || strings.HasSuffix(mediaType, "+json")
}

func startsLikeJSON(body *bufio.Reader) bool {
	for size := 1; size <= bodySniffBytes; size++ {
		head, err := body.Peek(size)
		if err != nil {
			return false
		}
		switch head[size-1] {
		case ' ', '\t', '\r', '\n':
			continue
		case '{', '[':
			return true
		default:
			return false
		}
	}
	return false
}
