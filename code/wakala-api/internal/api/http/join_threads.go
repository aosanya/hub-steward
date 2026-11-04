package http

import (
	"context"
	"errors"
	"log/slog"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"
	commmodels "wakalaserver/modules/comm/models"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const roleApplicant = "applicant"

var joinThreadActions = []string{
	"comm.subject_thread.open",
	"comm.subject_thread.list",
	"comm.subject_message.list",
	"comm.subject_message.post",
}

var ownInboxActions = []string{
	"comm.notification.list",
	"comm.notification.unread",
	"comm.notification.mark_read",
}

var applicantCommActions = append(append([]string{}, joinThreadActions...), ownInboxActions...)

func applicantMay(action string) bool {
	for _, held := range applicantCommActions {
		if action == held {
			return true
		}
	}
	return false
}

func authorizeApplicant(_ context.Context, action string) error {
	if !applicantMay(action) {
		return dispatch.ErrForbidden
	}
	return nil
}

func commAdmittedRole(ctx context.Context, reg agencies.Registry, instanceID, action string) (string, error) {
	role, err := admittedRole(ctx, reg, instanceID)
	if !errors.Is(err, agencies.ErrInstanceNotFound) || !applicantMay(action) {
		return role, err
	}
	applying, lookupErr := reg.HasPendingJoinRequest(ctx, instanceID, accounts.IDFromContext(ctx))
	if lookupErr != nil {
		return "", lookupErr
	}
	if !applying {
		return "", err
	}
	return roleApplicant, nil
}

func openJoinThread(ctx context.Context, rooms commRooms, instanceID, kind, subjectID, applicantID string) {
	if rooms == nil {
		return
	}
	cm, err := rooms.CommManager(ctx, instanceID)
	if err == nil {
		_, err = cm.OpenSubjectThreadFor(ctx, kind, subjectID, applicantID, commmodels.AudiencePrivate)
	}
	if err != nil {
		slog.Default().Warn("a join request opened no private thread",
			"instance", instanceID, "kind", kind, "subject", subjectID, "error", err.Error())
	}
}

func (m joinDecisionsAnnounced) JoinGroup(ctx context.Context, groupID, actorID, message string) (mwanachamaactor.JoinOutcome, error) {
	waiting := m.pendingRequestsOf(ctx, actorID)
	out, err := m.UserManager.JoinGroup(ctx, groupID, actorID, message)
	if err == nil && out.Status == actormodels.JoinRequested && out.Request != nil {
		openJoinThread(ctx, m.rooms, m.instanceID, agencies.SubjectGroupJoinRequest, out.Request.ID, out.Request.ActorID)
	}
	if err == nil {
		m.tellLeadersOfAFreshRequest(ctx, out, waiting)
	}
	return out, err
}
