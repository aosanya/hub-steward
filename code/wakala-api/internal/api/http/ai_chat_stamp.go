package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	aimodels "wakalaserver/modules/ai/models"
	airoutes "wakalaserver/modules/ai/routes"
)

const aiChatAction = "ai.account.chat"

func stampChat(args map[string]json.RawMessage, person string) {
	args["kind"], _ = json.Marshal(aimodels.KindChat)
	delete(args, "person")
	if person != "" {
		args["person"], _ = json.Marshal(person)
	}
}

func stampChatRequest(r *http.Request, person string) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	args, err := decodeBodyObject(body)
	if err != nil {
		return err
	}
	stampChat(args, person)
	stamped, err := json.Marshal(args)
	if err != nil {
		return err
	}
	r.Body = io.NopCloser(bytes.NewReader(stamped))
	r.ContentLength = int64(len(stamped))
	return nil
}

func aiMountFor(role, action string) airoutes.Mount {
	if action == aiChatAction && role == agencies.RoleAgent {
		return airoutes.Mount{Caller: func(context.Context) string { return "" }}
	}
	return airoutes.Mount{Caller: accounts.IDFromContext}
}
