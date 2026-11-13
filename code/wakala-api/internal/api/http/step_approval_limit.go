package http

import (
	"context"

	mwanachamaactor "wakalaserver/modules/actor"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
)

type stepApprovalLimit struct {
	Amount *int `json:"amount,omitempty"`
}

func checksApprovalLimit(questions []agencymodels.StepQuestion) bool {
	for _, q := range questions {
		if q.ChecksApprovalLimit {
			return true
		}
	}
	return false
}

func largestLimitOf(seats []mwanachamaactor.ActorRoleAssignment) *stepApprovalLimit {
	var largest *int
	for _, seat := range seats {
		if !seat.Active {
			continue
		}
		if seat.ApprovalLimit == nil {
			return &stepApprovalLimit{}
		}
		if largest == nil || *seat.ApprovalLimit > *largest {
			largest = seat.ApprovalLimit
		}
	}
	return &stepApprovalLimit{Amount: largest}
}

func (d *Deps) callerApprovalLimit(ctx context.Context, instanceID string) (*stepApprovalLimit, error) {
	directory, err := d.Registry.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	seats, err := directory.ListRoleAssignmentsForActor(ctx, accounts.IDFromContext(ctx), true)
	if err != nil {
		return nil, err
	}
	return largestLimitOf(seats), nil
}

func (d *Deps) showApprovalLimits(ctx context.Context, instanceID string, items []openStep) error {
	var limit *stepApprovalLimit
	for i := range items {
		if !checksApprovalLimit(items[i].Questions) {
			continue
		}
		if limit == nil {
			var err error
			limit, err = d.callerApprovalLimit(ctx, instanceID)
			if err != nil {
				return err
			}
		}
		shown := *limit
		items[i].ApprovalLimit = &shown
	}
	return nil
}
