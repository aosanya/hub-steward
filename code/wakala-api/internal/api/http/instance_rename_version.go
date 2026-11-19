package http

import (
	"context"

	"github.com/aosanya/mwanachama-backend-shared/versioncheck"
	"wakalaserver/internal/agencies"
)

func refuseStaleRename(ctx context.Context, reg agencies.Registry, instanceID, version, name string) error {
	if version == "" {
		return nil
	}
	inst, err := reg.GetInstance(ctx, instanceID)
	if err != nil {
		return err
	}
	return versioncheck.Stale(version, inst.UpdatedAt, []versioncheck.Field{{Name: "name", Sent: name, Stored: inst.Name}})
}
