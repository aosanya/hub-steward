package testruns

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	agencymodels "wakalaserver/modules/agency/models"
	formsmodels "wakalaserver/modules/forms/models"
)

const (
	endpointFormCreate   = "forms_form_create"
	endpointFormPublish  = "forms_form_publish"
	endpointQuestionAdd  = "forms_question_create"
	endpointAnswerSubmit = "forms_answer_submit"
	endpointAnswerList   = "forms_answer_list_all"
	endpointThreadCreate = "comm_chat_thread_create"
	endpointMessagePost  = "comm_chat_message_post"
	systemStructure      = "agency"
	formWindow           = 24 * time.Hour
)

func (s *RunStage) playSystemStep(ctx context.Context, runID string, block agencymodels.ScenarioBlock, step agencymodels.RunStep) agencymodels.RunStep {
	switch block.Kind {
	case agencymodels.StepKindSendForm:
		return s.sendForm(ctx, runID, block, step)
	case agencymodels.StepKindRoute:
		return s.routeAnswers(ctx, runID, block, step)
	case agencymodels.StepKindNotify:
		return s.notify(ctx, runID, block, step)
	}
	return failed(step, block.Action, "The test copy cannot play this step yet")
}

func (s *RunStage) through(ctx context.Context, runID string, block agencymodels.ScenarioBlock, endpoint string, args map[string]any) (Outcome, error) {
	module, ok := s.Modules[moduleOf(endpoint)]
	if !ok {
		return Outcome{}, ErrNoTestCopy{Module: moduleOf(endpoint)}
	}
	return module.Play(WithRun(ctx, runID), Call{StepID: block.StepID, StepName: block.Title, Kind: string(block.Kind), Role: block.Actor, Endpoint: endpoint, Args: args})
}

func (s *RunStage) finish(step agencymodels.RunStep, block agencymodels.ScenarioBlock, endpoint string, sent map[string]any, last Outcome, lines []TrailLine, did string) agencymodels.RunStep {
	step.Module, step.Endpoint, step.Sent, step.Answer = moduleOf(endpoint), endpoint, sent, last.Answer
	step.Trail = modelLines(lines, block.Title)
	step.Did, step.Recorded = did, did
	return step
}

func (s *RunStage) sendForm(ctx context.Context, runID string, block agencymodels.ScenarioBlock, step agencymodels.RunStep) agencymodels.RunStep {
	made, err := s.through(ctx, runID, block, endpointFormCreate, map[string]any{"title": block.Title, "closes_at": time.Now().Add(formWindow).UTC().Format(time.RFC3339)})
	if err != nil {
		return failed(step, block.Action, err.Error())
	}
	id := idOf(made.Answer)
	lines := made.Trail
	var prompts []string
	for _, f := range block.Fields {
		asked, err := s.addQuestion(ctx, runID, block, id, f.Prompt)
		if err != nil {
			return failed(step, block.Action, err.Error())
		}
		lines = append(lines, asked)
		prompts = append(prompts, f.Prompt)
	}
	published, err := s.through(ctx, runID, block, endpointFormPublish, map[string]any{"form_id": id})
	if err != nil {
		return failed(step, block.Action, err.Error())
	}
	s.mu.Lock()
	s.sent[runID] = id
	s.mu.Unlock()
	sent := map[string]any{"form_id": id, "title": block.Title, "questions": prompts, "answer_type": answerTypeOf(block), "open_to": "every member of the group"}
	did := "Sent the form " + block.Title + " (" + id + ")"
	if len(prompts) > 0 {
		did += " asking: " + strings.Join(prompts, "; ") + " (answered " + strings.ReplaceAll(answerTypeOf(block), "_", " or ") + ")"
	}
	did += ", open to every member of the group for " + formWindow.String()
	return s.finish(step, block, endpointFormPublish, sent, published, append(lines, published.Trail...), did)
}

func (s *RunStage) routeAnswers(ctx context.Context, runID string, block agencymodels.ScenarioBlock, step agencymodels.RunStep) agencymodels.RunStep {
	s.mu.Lock()
	id := s.sent[runID]
	s.mu.Unlock()
	if id == "" {
		return failed(step, block.Action, "No form was sent earlier in this run, so there are no answers to sort")
	}
	read, err := s.through(ctx, runID, block, endpointAnswerList, map[string]any{"form_id": id})
	if err != nil {
		return failed(step, block.Action, err.Error())
	}
	yes, other := tally(read.Answer)
	did := fmt.Sprintf("Read the answers to %s: %d yes go on, %d other answers would be thanked at once", id, yes, other)
	return s.finish(step, block, endpointAnswerList, map[string]any{"form_id": id}, read, read.Trail, did)
}

func (s *RunStage) notify(ctx context.Context, runID string, block agencymodels.ScenarioBlock, step agencymodels.RunStep) agencymodels.RunStep {
	thread, lines, err := s.ensureThread(ctx, runID, Call{StepID: block.StepID, StepName: block.Title, Kind: string(block.Kind), Role: block.Actor})
	if err != nil {
		return failed(step, block.Action, err.Error())
	}
	sent := map[string]any{"structure_id": systemStructure, "thread_id": thread, "body": messageOf(block)}
	posted, err := s.through(ctx, runID, block, endpointMessagePost, sent)
	if err != nil {
		return failed(step, block.Action, err.Error())
	}
	return s.finish(step, block, endpointMessagePost, sent, posted, append(lines, posted.Trail...), "Posted "+block.Title)
}

func messageOf(block agencymodels.ScenarioBlock) string {
	for _, f := range block.Fields {
		if strings.TrimSpace(f.Value) != "" {
			return f.Value
		}
	}
	return block.Title
}

func idOf(answer map[string]any) string {
	if id, ok := answer["id"].(string); ok {
		return id
	}
	for _, v := range answer {
		if inner, ok := v.(map[string]any); ok {
			if id := idOf(inner); id != "" {
				return id
			}
		}
	}
	return ""
}

func answerTypeOf(block agencymodels.ScenarioBlock) string {
	if strings.Contains(strings.ToLower(block.Then), "yes or no") {
		return "yes_no"
	}
	return "free_text"
}

func (s *RunStage) addQuestion(ctx context.Context, runID string, block agencymodels.ScenarioBlock, formID, prompt string) (TrailLine, error) {
	source, ok := s.copy.(FormsSource)
	if !ok {
		return TrailLine{}, ErrNoTestCopy{Module: moduleForms}
	}
	forms, err := source.Forms(ctx, runID)
	if err != nil {
		return TrailLine{}, err
	}
	question, _, err := forms.AddQuestion(ctx, formsmodels.QuestionDraft{Question: formsmodels.Question{FormID: formID, AnswerType: formsmodels.AnswerType(answerTypeOf(block)), Prompt: prompt, Required: true}})
	if err != nil {
		return TrailLine{}, err
	}
	body, _ := json.Marshal(question)
	return TrailLine{StepID: block.StepID, Module: moduleForms, Endpoint: endpointQuestionAdd, Text: string(body), At: time.Now()}, nil
}

func (s *RunStage) ensureThread(ctx context.Context, runID string, call Call) (string, []TrailLine, error) {
	s.mu.Lock()
	thread := s.threads[runID]
	s.mu.Unlock()
	if thread != "" {
		return thread, nil, nil
	}
	module, ok := s.Modules[moduleComm]
	if !ok {
		return "", nil, ErrNoTestCopy{Module: moduleComm}
	}
	call.Endpoint, call.Args = endpointThreadCreate, map[string]any{"structure_id": systemStructure, "label": "Notifications"}
	made, err := module.Play(WithRun(ctx, runID), call)
	if err != nil {
		return "", nil, err
	}
	thread = idOf(made.Answer)
	s.mu.Lock()
	s.threads[runID] = thread
	s.mu.Unlock()
	return thread, made.Trail, nil
}

func tally(answer map[string]any) (yes, other int) {
	for _, item := range answersIn(answer) {
		if saysYes(item) {
			yes++
		} else {
			other++
		}
	}
	return yes, other
}

func saysYes(value any) bool {
	switch v := value.(type) {
	case string:
		return strings.EqualFold(strings.TrimSpace(v), "yes")
	case bool:
		return v
	case map[string]any:
		if yes, ok := v["value_bool"].(bool); ok {
			return yes
		}
		for _, inner := range v {
			if saysYes(inner) {
				return true
			}
		}
	case []any:
		for _, inner := range v {
			if saysYes(inner) {
				return true
			}
		}
	}
	return false
}

func answersIn(answer map[string]any) []any {
	if items, ok := answer["items"].([]any); ok {
		return items
	}
	if raw, ok := answer["result"].(json.RawMessage); ok {
		var items []any
		if json.Unmarshal(raw, &items) == nil {
			return items
		}
	}
	return nil
}
