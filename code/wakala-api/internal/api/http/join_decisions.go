package http

import (
	"context"
	"errors"
	"log/slog"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"
	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/notifyrules"
)

type commRooms interface {
	CommManager(ctx context.Context, id string) (*mwanachamacomm.CommManager, error)
}

type joinDecisionsAnnounced struct {
	mwanachamaactor.UserManager
	rooms      commRooms
	instanceID string
	rules      *notifyrules.Store
	agency     agencyMembers
}

type agencyMembers interface {
	Members(ctx context.Context, instanceID string) ([]agencies.Member, error)
}

func (m joinDecisionsAnnounced) ApproveJoinRequest(ctx context.Context, id, decidedBy string) (mwanachamaactor.GroupJoinRequest, error) {
	req, err := m.UserManager.ApproveJoinRequest(ctx, id, decidedBy)
	if err == nil {
		m.announce(ctx, req, commmodels.EventGroupJoinApproved)
	}
	return req, err
}

func (m joinDecisionsAnnounced) DeclineJoinRequest(ctx context.Context, id, decidedBy string, silent bool, reason string) (mwanachamaactor.GroupJoinRequest, error) {
	req, err := m.UserManager.DeclineJoinRequest(ctx, id, decidedBy, silent, reason)
	if err == nil && !silent {
		m.tellTheDecision(ctx, req)
	}
	return req, err
}

func (m joinDecisionsAnnounced) OperatorApproveJoinRequest(ctx context.Context, id, decidedBy string) (mwanachamaactor.GroupJoinRequest, error) {
	req, err := m.UserManager.OperatorApproveJoinRequest(ctx, id, decidedBy)
	if err == nil {
		m.announce(ctx, req, commmodels.EventGroupJoinApproved)
	}
	return req, err
}

func (m joinDecisionsAnnounced) OperatorDeclineJoinRequest(ctx context.Context, id, decidedBy string, silent bool, reason string) (mwanachamaactor.GroupJoinRequest, error) {
	req, err := m.UserManager.OperatorDeclineJoinRequest(ctx, id, decidedBy, silent, reason)
	if err == nil && !silent {
		m.tellTheDecision(ctx, req)
	}
	return req, err
}

func (m joinDecisionsAnnounced) tellTheDecision(ctx context.Context, req mwanachamaactor.GroupJoinRequest) {
	decision, err := m.toldDeclineOf(ctx, req.ID)
	if err != nil {
		slog.Default().Warn("a told decline found no decision to name",
			"instance", m.instanceID, "request", req.ID, "error", err.Error())
		return
	}
	for _, told := range m.toldOfADecision(ctx, notifyrules.JoinDeclined, req) {
		m.tellAbout(ctx, told, commmodels.SubjectGroupJoinDecision, decision.ID, commmodels.EventGroupJoinDeclined, "decision", decision.ID)
	}
}

func (m joinDecisionsAnnounced) toldDeclineOf(ctx context.Context, requestID string) (mwanachamaactor.JoinDecision, error) {
	decisions, err := m.UserManager.ListJoinDecisions(ctx, requestID)
	if err != nil {
		return mwanachamaactor.JoinDecision{}, err
	}
	for i := len(decisions) - 1; i >= 0; i-- {
		if d := decisions[i]; !d.Silent && d.State == actormodels.JoinRequestDeclined {
			return d, nil
		}
	}
	return mwanachamaactor.JoinDecision{}, mwanachamaactor.ErrJoinDecisionNotFound
}

func (m joinDecisionsAnnounced) InviteToGroup(ctx context.Context, groupID, actorID, actorCode, invitedBy, expiresAt string) (mwanachamaactor.GroupInvitation, error) {
	inv, err := m.UserManager.InviteToGroup(ctx, groupID, actorID, actorCode, invitedBy, expiresAt)
	if err == nil {
		for _, told := range m.toldOf(ctx, notifyrules.Invited, inv.ActorID, inv.GroupID) {
			m.tell(ctx, told, inv.GroupID, commmodels.EventGroupInvited, "invitation", inv.ID)
		}
	}
	return inv, err
}

func (m joinDecisionsAnnounced) announce(ctx context.Context, req mwanachamaactor.GroupJoinRequest, event commmodels.NotificationEvent) {
	for _, told := range m.toldOfADecision(ctx, notifyrules.JoinApproved, req) {
		m.tell(ctx, told, req.GroupID, event, "request", req.ID)
	}
}

func (m joinDecisionsAnnounced) toldOfADecision(ctx context.Context, e notifyrules.Event, req mwanachamaactor.GroupJoinRequest) []string {
	return m.toldOf(ctx, e, req.ActorID, req.GroupID)
}

func (m joinDecisionsAnnounced) toldOf(ctx context.Context, e notifyrules.Event, actorID, groupID string) []string {
	rule := m.ruleFor(ctx, e)
	roster := notifyrules.Roster{notifyrules.Subject: {actorID}}
	if namesAudience(rule, notifyrules.GroupLeaders) {
		m.addGroupLeaders(ctx, roster, actorID, groupID)
	}
	if namesAgencyStaff(rule) {
		m.addAgencyStaff(ctx, roster)
	}
	return notifyrules.Resolve(rule, roster)
}

func namesAudience(rule notifyrules.Rule, want notifyrules.Audience) bool {
	for _, list := range [][]notifyrules.Audience{rule.Told, rule.Fallback} {
		for _, a := range list {
			if a == want {
				return true
			}
		}
	}
	return false
}

func (m joinDecisionsAnnounced) addGroupLeaders(ctx context.Context, roster notifyrules.Roster, actorID, groupID string) {
	leaders, err := agencies.GroupLeaders(ctx, m.UserManager, groupID)
	if err != nil {
		slog.Default().Warn("a group event found no leaders to tell",
			"instance", m.instanceID, "group", groupID, "error", err.Error())
		return
	}
	for _, leader := range leaders {
		if leader != actorID {
			roster[notifyrules.GroupLeaders] = append(roster[notifyrules.GroupLeaders], leader)
		}
	}
}

func (m joinDecisionsAnnounced) tell(ctx context.Context, actorID, groupID string, event commmodels.NotificationEvent, cause, causeID string) {
	m.tellAbout(ctx, actorID, commmodels.SubjectGroup, groupID, event, cause, causeID)
}

func (m joinDecisionsAnnounced) tellAbout(ctx context.Context, actorID string, kind commmodels.NotificationSubjectKind, subjectID string, event commmodels.NotificationEvent, cause, causeID string) {
	err := m.raise(ctx, actorID, kind, subjectID, event)
	if err == nil || errors.Is(err, commmodels.ErrNotificationMuted) {
		return
	}
	slog.Default().Warn("a group membership event raised no notification",
		"instance", m.instanceID, cause, causeID, "event", string(event), "error", err.Error())
}

func (m joinDecisionsAnnounced) raise(ctx context.Context, actorID string, kind commmodels.NotificationSubjectKind, subjectID string, event commmodels.NotificationEvent) error {
	if m.rooms == nil {
		return nil
	}
	cm, err := m.rooms.CommManager(ctx, m.instanceID)
	if err != nil {
		return err
	}
	_, err = cm.Raise(ctx, mwanachamacomm.Notification{
		ActorID:     actorID,
		Category:    commmodels.CategoryMembership,
		Event:       event,
		SubjectKind: kind,
		SubjectID:   subjectID,
	})
	return err
}
