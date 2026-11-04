package main

import (
	"context"
	"errors"
	"log/slog"
	"time"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	ai "wakalaserver/modules/ai"
	mwanachamamarket "wakalaserver/modules/market"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/testruns"
)

const posterPermission = "market.poster"

var errNoTestModel = errors.New("the Test agent has no AI backend: set AI_MASTER_KEY")

type testRunSeat struct {
	logger   *slog.Logger
	registry agencies.Registry
	ai       func(ctx context.Context, instanceID string) (ai.Manager, error)
}

func (s *testRunSeat) options() []agencies.Option {
	return []agencies.Option{
		agencies.WithScenarioRunner(s.runnerOf),
		agencies.WithTokensPerTest(agencies.TokensPerTestFrom(s.managerOf)),
	}
}

func (s *testRunSeat) attach(registry agencies.Registry, resolve func(ctx context.Context, instanceID string) (ai.Manager, error)) {
	s.registry, s.ai = registry, resolve
}

func (s *testRunSeat) managerOf(ctx context.Context, instanceID string) (ai.Manager, error) {
	if s.ai == nil {
		return nil, errNoTestModel
	}
	return s.ai(ctx, instanceID)
}

func (s *testRunSeat) runnerOf(instanceID string) mwanachamaagency.ScenarioRunner {
	return testruns.NewRunner(instanceID, s.build)
}

func (s *testRunSeat) build(ctx context.Context, instanceID string, req mwanachamaagency.RunRequest) (testruns.Agent, error) {
	manager, err := s.managerOf(ctx, instanceID)
	if err != nil {
		return testruns.Agent{}, err
	}
	model, meter, err := testruns.NewAI(manager, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return testruns.Agent{}, err
	}
	agency, err := s.registry.AgencyManager(ctx, instanceID)
	if err != nil {
		return testruns.Agent{}, err
	}
	touched, err := agencies.ModulesTouched(ctx, agency, req.Scenario.ID)
	if err != nil {
		return testruns.Agent{}, err
	}
	actors, err := actorsOfScenario(ctx, agency, req.Scenario.DraftID, req.Scenario.Actors)
	if err != nil {
		return testruns.Agent{}, err
	}
	copy, err := s.registry.TestCopy(ctx, instanceID)
	if err != nil {
		return testruns.Agent{}, err
	}
	if err := s.seedShops(ctx, instanceID, copy, req.RunID, actors, testruns.ActorsActingAsShops(req.Scenario.Blocks)); err != nil {
		return testruns.Agent{}, err
	}
	return testruns.Agent{Model: s.logged(model, instanceID, req.RunID), Stage: copy.Stage(touched, actors), Meter: meter, Log: s.runLog(instanceID)}, nil
}

func (s *testRunSeat) seedShops(ctx context.Context, instanceID string, copy agencies.TestCopy, runID string, actors []testruns.Actor, acting map[string]bool) error {
	var shops []string
	for _, a := range actors {
		if acting[a.Name] || holds(a.Permissions, posterPermission) {
			shops = append(shops, a.Name)
		}
	}
	if len(shops) == 0 {
		return nil
	}
	host, err := s.owner(ctx, instanceID)
	if err != nil {
		return err
	}
	market, err := copy.Market(ctx, runID)
	if err != nil {
		return err
	}
	for _, name := range shops {
		poster, err := market.ApplyPoster(ctx, name, mwanachamamarket.Poster{Name: name})
		if err != nil {
			return err
		}
		if _, err := market.ApprovePoster(ctx, host, poster.ID); err != nil {
			return err
		}
	}
	return nil
}

func (s *testRunSeat) owner(ctx context.Context, instanceID string) (string, error) {
	members, err := s.registry.Members(ctx, instanceID)
	if err != nil {
		return "", err
	}
	for _, m := range members {
		if m.Role == agencies.RoleOwner {
			return m.UserID, nil
		}
	}
	return "", errors.New("the agency has no owner to approve the test shops")
}

func actorsOfScenario(ctx context.Context, agency mwanachamaagency.AgencyManager, draftID string, actors []agencymodels.ScenarioActor) ([]testruns.Actor, error) {
	roles, err := agency.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		return nil, err
	}
	permissions := map[string][]string{}
	for _, r := range roles {
		permissions[r.ID] = r.Permissions
	}
	out := make([]testruns.Actor, 0, len(actors))
	for _, a := range actors {
		out = append(out, testruns.Actor{Name: a.Name, Kind: a.Kind, Permissions: permissions[a.RoleID]})
	}
	return out, nil
}

func holds(permissions []string, code string) bool {
	for _, p := range permissions {
		if p == code {
			return true
		}
	}
	return false
}

type loggedModel struct {
	testruns.Model
	logger     *slog.Logger
	instanceID string
	runID      string
}

func (s *testRunSeat) runLog(instanceID string) *slog.Logger {
	if s.logger == nil {
		return nil
	}
	return s.logger.With("instance", instanceID)
}

func (s *testRunSeat) logged(model testruns.Model, instanceID, runID string) testruns.Model {
	if s.logger == nil {
		return model
	}
	return loggedModel{Model: model, logger: s.logger, instanceID: instanceID, runID: runID}
}

func (m loggedModel) Chat(ctx context.Context, in ai.ChatInput) (ai.ChatReply, error) {
	started := time.Now()
	reply, err := m.Model.Chat(ctx, in)
	status := "ok"
	if err != nil {
		status = "error"
	}
	m.logger.Info("test run model call", "instance", m.instanceID, "run", m.runID, "status", status, "tokens_in", reply.InputTokens, "tokens_out", reply.OutputTokens, "finish", reply.FinishReason, "tool_calls", len(reply.Message.ToolCalls), "content", firstChars(reply.Message.Content, 600), "ms", time.Since(started).Milliseconds())
	return reply, err
}

func firstChars(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
