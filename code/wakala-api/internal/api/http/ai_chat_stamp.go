package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	aimodels "wakalaserver/modules/ai/models"
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
	args := map[string]json.RawMessage{}
	if len(bytes.TrimSpace(body)) > 0 {
		if err := json.Unmarshal(body, &args); err != nil {
			return err
		}
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
