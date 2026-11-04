package agencies

import (
	"context"

	"wakalaserver/internal/notifyrules"
	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
)

const (
	SubjectForm     = "form"
	SubjectQuestion = "question"
)

func (r *registry) subjectStandingIn(instanceID string) mwanachamacomm.Standing {
	return func(ctx context.Context, actorID, kind, id string) (commmodels.SubjectStanding, error) {
		switch kind {
		case SubjectAgencyJoinRequest:
			return r.agencyRequestStanding(ctx, instanceID, actorID, id)
		case SubjectGroupJoinRequest:
			return r.groupRequestStanding(ctx, instanceID, actorID, id)
		case SubjectForm, SubjectQuestion:
			return r.formSubjectStanding(ctx, instanceID, actorID, id)
		case SubjectCase:
			return r.caseSubjectStanding(ctx, instanceID, actorID, id)
		}
		return commmodels.StandingNone, nil
	}
}

func (r *registry) subjectAnswerersIn(instanceID string) mwanachamacomm.Answerers {
	return func(ctx context.Context, kind, id string) ([]string, error) {
		switch kind {
		case SubjectAgencyJoinRequest:
			return r.operatorsOf(ctx, instanceID)
		case SubjectGroupJoinRequest:
			return r.groupRequestDeciders(ctx, instanceID, id)
		case SubjectForm, SubjectQuestion:
			return r.formSubjectAnswerers(ctx, instanceID, id)
		case SubjectCase:
			return r.caseSubjectAnswerers(ctx, instanceID, id)
		}
		return nil, nil
	}
}

func (r *registry) formSubjectStanding(ctx context.Context, instanceID, actorID, subjectID string) (commmodels.SubjectStanding, error) {
	if subjectID == "" {
		return commmodels.StandingNone, nil
	}
	return r.answererWhen(r.IsMember(ctx, instanceID, actorID))
}

func (r *registry) formSubjectAnswerers(ctx context.Context, instanceID, subjectID string) ([]string, error) {
	if subjectID == "" {
		return nil, nil
	}
	roster := notifyrules.Roster{}
	if err := r.addStaff(ctx, instanceID, roster); err != nil {
		return nil, err
	}
	return notifyrules.Resolve(r.ruleIn(ctx, instanceID, notifyrules.FormPrivateChat), roster), nil
}
