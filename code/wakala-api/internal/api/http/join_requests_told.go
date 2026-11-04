package http

import (
	"context"
	"log/slog"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"
	commmodels "wakalaserver/modules/comm/models"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/notifyrules"
)

func (m joinDecisionsAnnounced) JoinGroupByCode(ctx context.Context, code, actorID, message string) (mwanachamaactor.JoinOutcome, error) {
	waiting := m.pendingRequestsOf(ctx, actorID)
	out, err := m.UserManager.JoinGroupByCode(ctx, code, actorID, message)
	if err == nil {
		m.tellLeadersOfAFreshRequest(ctx, out, waiting)
	}
	return out, err
}

func (m joinDecisionsAnnounced) pendingRequestsOf(ctx context.Context, actorID string) map[string]bool {
	held, err := m.UserManager.ListJoinRequestsForActor(ctx, actorID)
	if err != nil {
		slog.Default().Warn("a join request's earlier state could not be read",
			"instance", m.instanceID, "actor", actorID, "error", err.Error())
		return nil
	}
	waiting := map[string]bool{}
	for _, req := range held {
		if req.State == actormodels.JoinRequestPending {
			waiting[req.ID] = true
		}
	}
	return waiting
}

func (m joinDecisionsAnnounced) tellLeadersOfAFreshRequest(ctx context.Context, out mwanachamaactor.JoinOutcome, waiting map[string]bool) {
	if out.Status != actormodels.JoinRequested || out.Request == nil || waiting[out.Request.ID] {
		return
	}
	req := *out.Request
	leaders, err := agencies.GroupLeaders(ctx, m.UserManager, req.GroupID)
	if err != nil {
		slog.Default().Warn("a join request found no leaders to tell",
			"instance", m.instanceID, "request", req.ID, "error", err.Error())
		return
	}
	for _, told := range m.toldOfAFreshRequest(ctx, req.ActorID, leaders) {
		m.tellAbout(ctx, told, commmodels.SubjectGroupJoinRequest, req.ID, commmodels.EventJoinRequested, "request", req.ID)
	}
}

func (m joinDecisionsAnnounced) toldOfAFreshRequest(ctx context.Context, asker string, leaders []string) []string {
	rule := m.ruleFor(ctx, notifyrules.JoinAsked)
	roster := notifyrules.Roster{notifyrules.Subject: {asker}}
	for _, leader := range leaders {
		if leader != asker {
			roster[notifyrules.GroupLeaders] = append(roster[notifyrules.GroupLeaders], leader)
		}
	}
	if namesAgencyStaff(rule) {
		m.addAgencyStaff(ctx, roster)
	}
	return notifyrules.Resolve(rule, roster)
}

func (m joinDecisionsAnnounced) ruleFor(ctx context.Context, e notifyrules.Event) notifyrules.Rule {
	if m.rules != nil {
		rule, err := m.rules.Rule(ctx, m.instanceID, e)
		if err == nil {
			return rule
		}
		slog.Default().Warn("a notification rule could not be read; its default is used",
			"instance", m.instanceID, "event", string(e), "error", err.Error())
	}
	rule, _ := notifyrules.Default(e)
	return rule
}

func namesAgencyStaff(rule notifyrules.Rule) bool {
	for _, list := range [][]notifyrules.Audience{rule.Told, rule.Fallback} {
		for _, a := range list {
			if a == notifyrules.Owners || a == notifyrules.Agents {
				return true
			}
		}
	}
	return false
}

func (m joinDecisionsAnnounced) addAgencyStaff(ctx context.Context, roster notifyrules.Roster) {
	if m.agency == nil {
		return
	}
	members, err := m.agency.Members(ctx, m.instanceID)
	if err != nil {
		slog.Default().Warn("an agency's owners and agents could not be read for a notice",
			"instance", m.instanceID, "error", err.Error())
		return
	}
	for _, member := range members {
		switch member.Role {
		case agencies.RoleOwner:
			roster[notifyrules.Owners] = append(roster[notifyrules.Owners], member.UserID)
		case agencies.RoleAgent:
			roster[notifyrules.Agents] = append(roster[notifyrules.Agents], member.UserID)
		}
	}
}
