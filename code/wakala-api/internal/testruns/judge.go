package testruns

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamaai "wakalaserver/modules/ai"
)

const replyTokens = 16384

const (
	judgePersona  = "You are the Test agent checking what should be true after a step of a test scenario. A line that says an action was open or possible when the step began holds when the step took that action and the records show it was allowed."
	judgeContract = "Reply with one JSON object: {\"held\":true|false,\"found\":\"<one sentence on what is true instead, empty when it held>\"}."
)

func (a Agent) judge(ctx context.Context, req mwanachamaagency.RunRequest, step, then string, steps []agencymodels.RunStep) (bool, string, error) {
	stored, err := a.Stage.Stored(ctx, req.RunID)
	if err != nil {
		return false, "", err
	}
	state, _ := json.Marshal(stored)
	var done []string
	for _, s := range steps {
		line := s.Actor + ": " + s.Did + " -> " + s.Recorded
		if len(s.Sent) > 0 {
			sent, _ := json.Marshal(s.Sent)
			line += " (sent to " + s.Endpoint + ": " + string(sent) + ")"
		}
		done = append(done, line)
	}
	user := fmt.Sprintf("Should be true: %s\nWhat happened:\n%s\nStored in the test copy: %s", then, strings.Join(done, "\n"), state)
	messages := []mwanachamaai.ChatMessage{
		{Role: "system", Content: judgePersona + "\n" + judgeContract},
		{Role: "user", Content: user},
	}
	var content string
	var object string
	for attempt := 0; attempt < 2; attempt++ {
		reply, err := a.complete(ctx, req.RunID, step+" check", mwanachamaai.ChatInput{Messages: messages, MaxTokens: replyTokens})
		if err != nil {
			return false, "", err
		}
		content = reply.Message.Content
		start, end := strings.Index(content, "{"), strings.LastIndex(content, "}")
		if start >= 0 && end > start {
			object = content[start : end+1]
			break
		}
		messages = append(messages, spoken(reply.Message), mwanachamaai.ChatMessage{Role: "user", Content: "Reply with the JSON object only."})
	}
	if object == "" {
		return false, "", fmt.Errorf("testruns: the check's answer holds no JSON object: %q", truncate(content))
	}
	var verdict struct {
		Held  bool   `json:"held"`
		Found string `json:"found"`
	}
	if err := json.Unmarshal([]byte(object), &verdict); err != nil {
		return false, "", fmt.Errorf("testruns: read the check's answer: %w", err)
	}
	a.note(req.RunID, step, "test run check", "then", then, "held", verdict.Held, "found", verdict.Found, "stored", truncate(string(state)))
	if !verdict.Held && strings.TrimSpace(verdict.Found) == "" {
		verdict.Found = "It did not hold"
	}
	return verdict.Held, strings.TrimSpace(verdict.Found), nil
}
