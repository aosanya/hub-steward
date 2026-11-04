package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

type namedBy struct {
	within    string
	idField   string
	nameField string
}

var screenNamedLists = map[string]namedBy{
	"comm.chat_message.list":            {idField: "author_id", nameField: "author_name"},
	"comm.chat_thread.list":             {within: "last_message", idField: "author_id", nameField: "author_name"},
	"actor.join_request.list_for_group": {idField: "actor_id", nameField: "actor_name"},
}

type bufferedResponse struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (b *bufferedResponse) Header() http.Header { return b.header }

func (b *bufferedResponse) WriteHeader(status int) {
	if b.status == 0 {
		b.status = status
	}
}

func (b *bufferedResponse) Write(p []byte) (int, error) {
	b.WriteHeader(http.StatusOK)
	return b.body.Write(p)
}

func withScreenNames(reg agencies.Registry, action string, serve http.HandlerFunc) http.HandlerFunc {
	return rewrittenBy(screenNamesRewrite(reg, action), serve)
}

func screenNamesRewrite(reg agencies.Registry, action string) rowRewrite {
	field, named := screenNamedLists[action]
	if !named {
		return nil
	}
	return func(r *http.Request, rows []map[string]json.RawMessage) ([]map[string]json.RawMessage, error) {
		return field.nameEach(r.Context(), reg, r.PathValue("instanceID"), rows)
	}
}

func rewrittenBy(rewrite rowRewrite, serve http.HandlerFunc) http.HandlerFunc {
	if rewrite == nil {
		return serve
	}
	return rewritingRows(serve, rewrite)
}

type rowRewrite func(r *http.Request, rows []map[string]json.RawMessage) ([]map[string]json.RawMessage, error)

func rewritingRows(serve http.HandlerFunc, rewrite rowRewrite) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		held := &bufferedResponse{header: http.Header{}}
		serve(held, r)
		for k, v := range held.header {
			w.Header()[k] = v
		}
		if held.status == 0 {
			held.status = http.StatusOK
		}
		if held.status != http.StatusOK {
			w.WriteHeader(held.status)
			_, _ = w.Write(held.body.Bytes())
			return
		}
		var rows []map[string]json.RawMessage
		if err := json.Unmarshal(held.body.Bytes(), &rows); err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		rewritten, err := rewrite(r, rows)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, rewritten)
	}
}

func (f namedBy) nameEach(ctx context.Context, reg agencies.Registry, instanceID string, rows []map[string]json.RawMessage) ([]map[string]json.RawMessage, error) {
	if rows == nil {
		return []map[string]json.RawMessage{}, nil
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		if id := f.idOf(row); id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return rows, nil
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	held, err := directory.GetActors(ctx, ids)
	if err != nil {
		return nil, err
	}
	return f.withNames(rows, screenNamesByID(held)), nil
}

func (f namedBy) signed(row map[string]json.RawMessage) map[string]json.RawMessage {
	if f.within == "" {
		return row
	}
	var inner map[string]json.RawMessage
	if json.Unmarshal(row[f.within], &inner) != nil {
		return nil
	}
	return inner
}

func (f namedBy) idOf(row map[string]json.RawMessage) string {
	var id string
	_ = json.Unmarshal(f.signed(row)[f.idField], &id)
	return id
}

func (f namedBy) withNames(rows []map[string]json.RawMessage, names map[string]string) []map[string]json.RawMessage {
	for _, row := range rows {
		inner := f.signed(row)
		if inner == nil {
			continue
		}
		inner[f.nameField], _ = json.Marshal(names[f.idOf(row)])
		if f.within != "" {
			row[f.within], _ = json.Marshal(inner)
		}
	}
	return rows
}

func screenNamesByID(held []mwanachamaactor.Actor) map[string]string {
	out := make(map[string]string, len(held))
	for _, a := range held {
		out[a.ID] = a.DisplayName
	}
	return out
}
