package testruns

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamaai "wakalaserver/modules/ai"
)

const refusedPrefix = "refused: "

const notDoneNudge = "That is not the finished JSON. If the action is not done yet, call the tool that does it now; if it is done, reply with the JSON object only."

const actContract = "Do the action with the tools. When it is done, reply with one JSON object: {\"did\":\"<what the person did, in one sentence>\",\"recorded\":\"<what the agency recorded, in one sentence>\"}."

func (a Agent) act(ctx context.Context, req mwanachamaagency.RunRequest, step string, block agencymodels.ScenarioBlock) (agencymodels.RunStep, error) {
	out := agencymodels.RunStep{StepID: block.StepID, Step: block.Title, Actor: block.Actor, PlayedBy: "Test agent · " + kindLabel(block.Kind)}
	tools, problem := namedTool(a.Stage.Tools(block.Actor), block)
	if problem != "" {
		a.note(req.RunID, step, "test run tools refused", "actor", block.Actor, "named", block.Tool, "problem", problem)
		return failed(out, block.Action, problem), nil
	}
	allowed := map[string]bool{}
	for _, t := range tools {
		allowed[t.Name] = true
	}
	caller := a.Stage.Caller(req.RunID, block.Actor)
	known := knownTo(ctx, a.Stage, req.RunID)
	if hint := supplierHint(req.Scenario.Blocks, block); hint != "" {
		known = append(known, hint)
	}
	messages := []mwanachamaai.ChatMessage{
		{Role: "system", Content: persona + "\n" + actContract},
		{Role: "user", Content: briefing(block, thenOf(req.Scenario, block), known)},
	}
	var lastResult string
	nudged := false
	for move := 0; move < maxMoves; move++ {
		reply, err := a.complete(ctx, req.RunID, step, mwanachamaai.ChatInput{Messages: messages, Tools: tools, MaxTokens: replyTokens})
		out.Tokens += reply.InputTokens + reply.OutputTokens
		if err != nil {
			return out, err
		}
		if len(reply.Message.ToolCalls) == 0 {
			if lastResult == "" {
				return failed(out, block.Action, block.Actor+" made no move: the Test agent called no tool"), nil
			}
			if strings.HasPrefix(lastResult, refusedPrefix) {
				return failed(out, block.Action, strings.TrimPrefix(lastResult, refusedPrefix)), nil
			}
			a.note(req.RunID, step, "test run agent reply", "actor", block.Actor, "content", truncate(reply.Message.Content))
			did, recorded, done := readDone(reply.Message.Content, lastResult)
			if !done && !nudged {
				nudged = true
				messages = append(messages, spoken(reply.Message), mwanachamaai.ChatMessage{Role: "user", Content: notDoneNudge})
				continue
			}
			if !done {
				return failed(out, block.Action, block.Actor+" stopped before finishing; the last thing the market returned was "+truncate(lastResult)), nil
			}
			out.Did, out.Recorded = did, recorded
			return out, nil
		}
		messages = append(messages, reply.Message)
		for _, call := range reply.Message.ToolCalls {
			if !allowed[call.Name] {
				return failed(out, "The Test agent acts only through "+block.Actor+"'s tools in the test copy", "It tried "+call.Name+", which is outside the test copy"), nil
			}
			args := map[string]any{}
			if len(call.Arguments) > 0 {
				if err := json.Unmarshal(call.Arguments, &args); err != nil {
					messages = append(messages, mwanachamaai.ChatMessage{Role: "tool", ToolCallID: call.ID, Content: "refused: the arguments are not a JSON object"})
					continue
				}
			}
			started := time.Now()
			result, err := a.play(ctx, caller, req.RunID, block, call.Name, args, &out)
			if err != nil {
				result = refusedPrefix + err.Error()
			}
			a.note(req.RunID, step, "test run tool call", "actor", block.Actor, "tool", call.Name, "arguments", truncate(string(call.Arguments)), "result", truncate(result), "refused", strings.HasPrefix(result, refusedPrefix), "ms", time.Since(started).Milliseconds())
			lastResult = result
			messages = append(messages, mwanachamaai.ChatMessage{Role: "tool", ToolCallID: call.ID, Content: result})
		}
	}
	return failed(out, block.Action, fmt.Sprintf("%s did not finish within %d moves; the last thing the market returned was %s", block.Actor, maxMoves, truncate(lastResult))), nil
}

func spoken(m mwanachamaai.ChatMessage) mwanachamaai.ChatMessage {
	if strings.TrimSpace(m.Content) == "" && len(m.ToolCalls) == 0 {
		m.Content = "(no answer)"
	}
	return m
}

func truncate(s string) string {
	if len(s) > 600 {
		return s[:600]
	}
	return s
}

func namedTool(available []mwanachamaai.ChatTool, block agencymodels.ScenarioBlock) ([]mwanachamaai.ChatTool, string) {
	named := endpointOf(block)
	if named == "" {
		return nil, "The step \"" + block.Title + "\" names no tool, so the Test agent has nothing to use. Name the one tool " + block.Actor + " uses on the step"
	}
	for _, t := range available {
		if t.Name == named {
			return []mwanachamaai.ChatTool{t}, ""
		}
	}
	return nil, "The step \"" + block.Title + "\" names the tool " + named + ", which " + block.Actor + "'s role cannot use or which does not exist"
}

func failed(s agencymodels.RunStep, expected, found string) agencymodels.RunStep {
	s.Failed, s.Expected, s.Found = true, expected, found
	if s.Did == "" {
		s.Did = found
	}
	return s
}

func briefing(b agencymodels.ScenarioBlock, aim string, known []string) string {
	lines := []string{"You play " + b.Actor + ".", "Action: " + b.Action + " (" + kindLabel(b.Kind) + ").", "You do this with one tool, " + endpointOf(b) + ", and nothing else is open to you. Call it once with the values below."}
	if strings.TrimSpace(aim) != "" {
		lines = append(lines, "What the person is after: "+aim+".")
		if endpointOf(b) == "market_ask" {
			lines = append(lines, "Put those words, unchanged, in the ask's detail.")
		}
	}
	if len(known) > 0 {
		lines = append(lines, "Already in the test copy, use these exact ids when a tool asks for one:")
		lines = append(lines, known...)
	}
	for _, f := range b.Fields {
		if f.Free {
			lines = append(lines, "Field \""+f.Prompt+"\": free, choose a plausible value.")
			continue
		}
		lines = append(lines, "Field \""+f.Prompt+"\": exactly \""+f.Value+"\".")
	}
	return strings.Join(lines, "\n")
}

func kindLabel(kind agencymodels.StepKind) string {
	switch kind {
	case agencymodels.StepKindFillForm:
		return "Fill a form"
	case agencymodels.StepKindNotify:
		return "Send a text"
	case agencymodels.StepKindYesNo:
		return "Say yes or no"
	}
	return string(kind)
}

func readDone(content, fallbackRecorded string) (did, recorded string, done bool) {
	start, end := strings.Index(content, "{"), strings.LastIndex(content, "}")
	if start >= 0 && end > start {
		var out struct {
			Did      string `json:"did"`
			Recorded string `json:"recorded"`
		}
		if json.Unmarshal([]byte(content[start:end+1]), &out) == nil && (out.Did != "" || out.Recorded != "") {
			return out.Did, out.Recorded, true
		}
	}
	if len(fallbackRecorded) > 300 {
		fallbackRecorded = fallbackRecorded[:300]
	}
	return strings.TrimSpace(content), fallbackRecorded, false
}

func (a Agent) play(ctx context.Context, caller Caller, runID string, block agencymodels.ScenarioBlock, endpoint string, args map[string]any, out *agencymodels.RunStep) (string, error) {
	modules, ok := a.Stage.(Modules)
	if !ok {
		return a.callDirect(ctx, caller, endpoint, args, out)
	}
	module, ok := modules.Module(moduleOf(endpoint))
	if !ok {
		return a.callDirect(ctx, caller, endpoint, args, out)
	}
	outcome, err := module.Play(WithRun(ctx, runID), Call{StepID: block.StepID, StepName: block.Title, Kind: string(block.Kind), Role: block.Actor, Endpoint: endpoint, Args: args})
	if err != nil {
		return "", err
	}
	out.Module, out.Endpoint, out.Sent, out.Answer = module.Name(), endpoint, args, outcome.Answer
	out.Trail = append(out.Trail, modelLines(outcome.Trail, block.Title)...)
	body, err := json.Marshal(outcome.Answer)
	return string(body), err
}

func (a Agent) callDirect(ctx context.Context, caller Caller, endpoint string, args map[string]any, out *agencymodels.RunStep) (string, error) {
	out.Endpoint, out.Sent = endpoint, args
	return caller.Call(ctx, endpoint, args)
}

type knower interface {
	Known(ctx context.Context, runID string) []string
}

func knownTo(ctx context.Context, stage Stage, runID string) []string {
	if k, ok := stage.(knower); ok {
		return k.Known(ctx, runID)
	}
	return nil
}
