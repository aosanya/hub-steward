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

func refuseControlCharacters(auth callers, next http.Handler) http.Handler {
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
		raw, ok := readScannedBody(w, r, peeked, rememberedRecognition(auth, r))
		if !ok {
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

func readScannedBody(w http.ResponseWriter, r *http.Request, body io.Reader, recognised func() bool) ([]byte, bool) {
	if r.ContentLength > anonymousJSONBodyBytes && !recognised() {
		writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
		return nil, false
	}
	limit := int64(anonymousJSONBodyBytes)
	if r.ContentLength > limit {
		limit = maxRequestBody
	}
	if r.ContentLength > limit {
		writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
		return nil, false
	}
	raw, err := io.ReadAll(io.LimitReader(body, limit+1))
	if err != nil {
		writeReadErr(w, err)
		return nil, false
	}
	if int64(len(raw)) > limit && limit < maxRequestBody && recognised() {
		more, err := io.ReadAll(io.LimitReader(body, maxRequestBody-int64(len(raw))+1))
		if err != nil {
			writeReadErr(w, err)
			return nil, false
		}
		raw = append(raw, more...)
		limit = maxRequestBody
	}
	if int64(len(raw)) > limit {
		writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
		return nil, false
	}
	return raw, true
}

func rememberedRecognition(auth callers, r *http.Request) func() bool {
	var asked, answer bool
	return func() bool {
		if !asked {
			asked, answer = true, auth.recognises(r)
		}
		return answer
	}
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
