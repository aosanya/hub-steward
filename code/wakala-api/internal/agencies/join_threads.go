package agencies

import (
	"context"
	"errors"
	"fmt"
	"strings"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"
	commmodels "wakalaserver/modules/comm/models"
)

const (
	SubjectAgencyJoinRequest = "agency_join_request"
	SubjectGroupJoinRequest  = "group_join_request"
)

func (r *registry) HasPendingJoinRequest(ctx context.Context, instanceID, userID string) (bool, error) {
	instanceID, userID = strings.TrimSpace(instanceID), strings.TrimSpace(userID)
	if instanceID == "" || userID == "" {
		return false, nil
	}
	var n int64
	if err := r.db.WithContext(ctx).Model(&joinRequestRow{}).
		Where("instance_id = ? AND user_id = ? AND status = ?", instanceID, userID, RequestPending).
		Count(&n).Error; err != nil {
		return false, err
	}
	return n > 0, nil
}

func (r *registry) agencyRequestStanding(ctx context.Context, instanceID, actorID, applicantID string) (commmodels.SubjectStanding, error) {
	open, err := r.HasPendingJoinRequest(ctx, instanceID, applicantID)
	if err != nil || !open {
		return commmodels.StandingNone, err
	}
	if actorID == applicantID {
		return commmodels.StandingAudience, nil
	}
	return r.answererWhen(r.IsMember(ctx, instanceID, actorID))
}

func (r *registry) groupRequestStanding(ctx context.Context, instanceID, actorID, requestID string) (commmodels.SubjectStanding, error) {
	req, open, err := r.openGroupRequest(ctx, instanceID, requestID)
	if err != nil || !open {
		return commmodels.StandingNone, err
	}
	if actorID == req.ActorID {
		return commmodels.StandingAudience, nil
	}
	return r.answererWhen(r.decidesGroupRequest(ctx, instanceID, actorID, req))
}

func (r *registry) openGroupRequest(ctx context.Context, instanceID, requestID string) (mwanachamaactor.GroupJoinRequest, bool, error) {
	if strings.TrimSpace(requestID) == "" {
		return mwanachamaactor.GroupJoinRequest{}, false, nil
	}
	directory, err := r.ActorManager(ctx, instanceID)
	if err != nil {
		return mwanachamaactor.GroupJoinRequest{}, false, fmt.Errorf("group join request standing: %w", err)
	}
	req, err := directory.GetJoinRequest(ctx, requestID)
	if errors.Is(err, mwanachamaactor.ErrJoinRequestNotFound) {
		return mwanachamaactor.GroupJoinRequest{}, false, nil
	}
	if err != nil {
		return mwanachamaactor.GroupJoinRequest{}, false, fmt.Errorf("group join request standing: %w", err)
	}
	return req, req.Pending() || quietlyDeclined(req), nil
}

func quietlyDeclined(req mwanachamaactor.GroupJoinRequest) bool {
	return req.State == actormodels.JoinRequestDeclined && req.Silent
}

func (r *registry) decidesGroupRequest(ctx context.Context, instanceID, actorID string, req mwanachamaactor.GroupJoinRequest) (bool, error) {
	directory, err := r.ActorManager(ctx, instanceID)
	if err != nil {
		return false, fmt.Errorf("group join request decider: %w", err)
	}
	return directory.IsGroupLeader(ctx, req.GroupID, actorID)
}

func (r *registry) groupRequestDeciders(ctx context.Context, instanceID, requestID string) ([]string, error) {
	req, open, err := r.openGroupRequest(ctx, instanceID, requestID)
	if err != nil || !open {
		return nil, err
	}
	return r.groupLeadersOf(ctx, instanceID, req.GroupID)
}

func (r *registry) answererWhen(decides bool, err error) (commmodels.SubjectStanding, error) {
	if err != nil || !decides {
		return commmodels.StandingNone, err
	}
	return commmodels.StandingAnswerer, nil
}

func (r *registry) operatorsOf(ctx context.Context, instanceID string) ([]string, error) {
	var ids []string
	if err := r.db.WithContext(ctx).Model(&memberRow{}).
		Where("instance_id = ? AND role IN ?", instanceID, operatorRoles).
		Order("created_at").Pluck("user_id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}
