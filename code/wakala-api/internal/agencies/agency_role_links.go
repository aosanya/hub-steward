package agencies

import "context"

type AgencyRoleLinks interface {
	SetAgencyRole(ctx context.Context, instanceID, userID, agencyRoleID string) error
	AgencyRoleOf(ctx context.Context, instanceID, userID string) (string, error)
}
