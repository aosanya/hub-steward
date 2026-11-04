package testruns

import (
	"context"
	"log/slog"
	"strconv"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamaai "wakalaserver/modules/ai"
)

const (
	persona  = "You are the Test agent. You play one person of a test scenario inside a test copy of the agency, never a real member. You do only what you are told, through the tools you are given."
	maxMoves = 6

	noStepsReason  = "The scenario has no steps to play"
	unplayedDid    = "Nobody played this step"
	unplayedRecord = "The agency takes this step itself; nothing was checked"
)

type deriver interface {
	Derive([]agencymodels.ScenarioBlock)
}

type Agent struct {
	Model Model
	Stage Stage
	Meter Meter
	Log   *slog.Logger
}

func (a Agent) note(runID, step, msg string, attrs ...any) {
	if a.Log == nil {
		return
	}
	a.Log.Info(msg, append([]any{"run", runID, "step", step}, attrs...)...)
}

func (a Agent) Run(ctx context.Context, req mwanachamaagency.RunRequest) (mwanachamaagency.RunOutcome, error) {
	return a.RunReporting(ctx, req, func(agencymodels.RunStep) bool { return true })
}

func (a Agent) RunReporting(ctx context.Context, req mwanachamaagency.RunRequest, finished func(agencymodels.RunStep) bool) (mwanachamaagency.RunOutcome, error) {
	var out mwanachamaagency.RunOutcome
	if hasFailed(req.Done) {
		out.Result = agencymodels.TestRunFailed
		return out, nil
	}
	if ready, ok := a.Stage.(interface{ Ready() error }); ok {
		if err := ready.Ready(); err != nil {
			return stop(out, err.Error()), nil
		}
	}
	if len(req.Scenario.Blocks) == 0 {
		return stop(out, noStepsReason), nil
	}
	if d, ok := a.Stage.(interface {
		Derive([]agencymodels.ScenarioBlock)
	}); ok {
		d.Derive(req.Scenario.Blocks)
	}
	for i, block := range req.Scenario.Blocks {
		if blockDone(req.Done, block) {
			continue
		}
		a.note(req.RunID, label(i, block), "test run step start", "actor", block.Actor, "kind", string(block.Kind), "action", block.Action)
		steps, err := a.playBlock(ctx, req, label(i, block), block)
		for _, s := range steps {
			a.note(req.RunID, label(i, block), "test run step end", "actor", s.Actor, "failed", s.Failed, "did", s.Did, "recorded", truncate(s.Recorded), "expected", s.Expected, "found", s.Found, "tokens", s.Tokens)
		}
		if err != nil {
			a.note(req.RunID, label(i, block), "test run step error", "error", err.Error())
		}
		carryOn := true
		for _, s := range steps {
			out.Steps = append(out.Steps, s)
			out.Trail = append(out.Trail, s.Trail...)
			out.Tokens += s.Tokens
			carryOn = finished(s) && carryOn
		}
		if reason, stopped := stopReason(err); stopped {
			a.note(req.RunID, "", "test run end", "result", "stopped", "reason", reason)
			return stop(out, reason), nil
		}
		if err != nil {
			a.note(req.RunID, "", "test run end", "result", "stopped", "reason", err.Error())
			return stop(out, err.Error()), nil
		}
		if hasFailed(steps) {
			out.Result = agencymodels.TestRunFailed
			a.note(req.RunID, "", "test run end", "result", string(out.Result), "tokens", out.Tokens)
			return out, nil
		}
		if !carryOn {
			return stop(out, agencymodels.StoppedByDesigner), nil
		}
	}
	out.Result = agencymodels.TestRunPassed
	a.note(req.RunID, "", "test run end", "result", string(out.Result), "tokens", out.Tokens)
	return out, nil
}

func stop(out mwanachamaagency.RunOutcome, reason string) mwanachamaagency.RunOutcome {
	out.Result, out.StopReason = agencymodels.TestRunStopped, reason
	return out
}

func (a Agent) playBlock(ctx context.Context, req mwanachamaagency.RunRequest, step string, block agencymodels.ScenarioBlock) ([]agencymodels.RunStep, error) {
	var steps []agencymodels.RunStep
	if playsPerson(req.Scenario, block) {
		acted, err := a.act(ctx, req, step, block)
		if err == nil || acted.Tokens > 0 || acted.Did != "" {
			steps = append(steps, acted)
		}
		if err != nil || acted.Failed {
			return steps, err
		}
	}
	reactions, err := a.Stage.Respond(ctx, req.RunID, block)
	steps = append(steps, reactions...)
	if err != nil || hasFailed(reactions) {
		return steps, err
	}
	then := thenOf(req.Scenario, block)
	if strings.TrimSpace(then) == "" {
		return withUnplayed(steps, block), nil
	}
	held, found, err := a.judge(ctx, req, step, then, steps)
	if err != nil {
		return steps, err
	}
	if !held {
		if len(steps) == 0 {
			steps = append(steps, agencymodels.RunStep{StepID: block.StepID, Step: block.Title, Actor: block.Actor})
		}
		last := &steps[len(steps)-1]
		last.Failed, last.Expected, last.Found = true, then, found
	}
	return withUnplayed(steps, block), nil
}

func withUnplayed(steps []agencymodels.RunStep, block agencymodels.ScenarioBlock) []agencymodels.RunStep {
	if len(steps) > 0 {
		return steps
	}
	return []agencymodels.RunStep{{StepID: block.StepID, Step: block.Title, Actor: block.Actor, PlayedBy: block.Actor, Did: unplayedDid, Recorded: unplayedRecord}}
}

func thenOf(s agencymodels.Scenario, block agencymodels.ScenarioBlock) string {
	if block.Then != "" {
		return block.Then
	}
	for _, t := range s.Thens {
		if t.StepID == block.StepID {
			return t.Then
		}
	}
	return ""
}

func playsPerson(s agencymodels.Scenario, block agencymodels.ScenarioBlock) bool {
	for _, actor := range s.Actors {
		if strings.EqualFold(actor.Name, block.Actor) {
			return actor.Kind == agencymodels.ActorKindRole
		}
	}
	return true
}

func blockDone(done []agencymodels.RunStep, block agencymodels.ScenarioBlock) bool {
	for _, s := range done {
		if s.StepID == block.StepID {
			return true
		}
	}
	return false
}

func label(i int, b agencymodels.ScenarioBlock) string {
	return strings.TrimSpace(strconv.Itoa(i+1) + " " + b.Title)
}

func hasFailed(steps []agencymodels.RunStep) bool {
	for _, s := range steps {
		if s.Failed {
			return true
		}
	}
	return false
}

func (a Agent) complete(ctx context.Context, runID, step string, in mwanachamaai.ChatInput) (mwanachamaai.ChatReply, error) {
	if a.Meter != nil {
		d, err := a.Meter.Check(ctx, runID, step)
		if err != nil {
			return mwanachamaai.ChatReply{}, err
		}
		if d.BudgetReached {
			return mwanachamaai.ChatReply{}, ErrBudgetReached
		}
		if !d.Allowed {
			return mwanachamaai.ChatReply{}, &StopError{Reason: d.Reason}
		}
	}
	reply, err := a.Model.Chat(ctx, in)
	if err != nil {
		return mwanachamaai.ChatReply{}, &StopError{Reason: err.Error()}
	}
	if a.Meter != nil {
		if err := a.Meter.Record(ctx, runID, step, reply.InputTokens, reply.OutputTokens); err != nil {
			return mwanachamaai.ChatReply{}, err
		}
	}
	return reply, nil
}
