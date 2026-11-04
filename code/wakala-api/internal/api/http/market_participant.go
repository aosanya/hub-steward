package http

import (
	"context"

	"wakalaserver/internal/agencies"
)

func mustBeMarketParticipant(ctx context.Context, reg agencies.Registry, instanceID string) error {
	_, err := admittedRole(ctx, reg, instanceID)
	return err
}
