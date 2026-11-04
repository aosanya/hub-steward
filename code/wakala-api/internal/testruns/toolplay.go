package testruns

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"wakalaserver/modules/shared/dispatch"
)

func playTool(ctx context.Context, module string, tools []dispatch.Tool, call Call) (Outcome, error) {
	raw, err := json.Marshal(call.Args)
	if err != nil {
		return Outcome{}, err
	}
	for _, t := range tools {
		if t.Name != call.Endpoint {
			continue
		}
		out, err := t.Invoke(ctx, raw)
		if err != nil {
			return Outcome{}, fmt.Errorf("%s refused %s: %w", module, call.Endpoint, err)
		}
		body, err := json.Marshal(out)
		if err != nil {
			return Outcome{}, err
		}
		answer := map[string]any{}
		if json.Unmarshal(body, &answer) != nil {
			answer = map[string]any{"result": json.RawMessage(body)}
		}
		line := TrailLine{StepID: call.StepID, Module: module, Endpoint: call.Endpoint, Text: string(body), At: time.Now()}
		return Outcome{Answer: answer, Trail: []TrailLine{line}}, nil
	}
	return Outcome{}, fmt.Errorf("%s is not an endpoint of the %s test copy", call.Endpoint, module)
}

func gate(allowed map[string]bool) dispatch.Authorizer {
	return func(_ context.Context, action string) error {
		if allowed[action] {
			return nil
		}
		return dispatch.ErrForbidden
	}
}
