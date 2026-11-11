package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"wakalaserver/modules/shared/dispatch"
)

const createPostAction = "engage.post.create"

var createPostActionByKind = map[string]string{
	"notice":         "engage.post.create_notice",
	"event":          "engage.post.create_event",
	"volunteer_call": "engage.post.create_volunteer_call",
}

type postKindKey struct{}

func withPostKind(r *http.Request) *http.Request {
	raw, err := io.ReadAll(r.Body)
	r.Body.Close()
	r.Body = io.NopCloser(bytes.NewReader(raw))
	var body struct {
		Kind string `json:"kind"`
	}
	if err != nil || json.Unmarshal(raw, &body) != nil {
		return r
	}
	return r.WithContext(context.WithValue(r.Context(), postKindKey{}, body.Kind))
}

func postKindGated(authorize dispatch.Authorizer) dispatch.Authorizer {
	if authorize == nil {
		return nil
	}
	return func(ctx context.Context, action string) error {
		if action == createPostAction {
			kind, _ := ctx.Value(postKindKey{}).(string)
			if kindAction, ok := createPostActionByKind[kind]; ok {
				action = kindAction
			}
		}
		return authorize(ctx, action)
	}
}
