package http

import (
	"context"
	"log/slog"
	"net/http"

	permissions "wakalaserver/modules/permissions"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func recordScope(module, object, id string) string {
	return "record:" + recordIdentity(module, object, id)
}

func RecordGrants(pm permissions.PermissionsManager) agencies.RecordGrantOf {
	if pm == nil {
		return nil
	}
	return func(ctx context.Context, instanceID, actorID, module, object, id, action string) (bool, error) {
		if actorID == "" || id == "" {
			return false, nil
		}
		return pm.MayPerformIn(ctx, actorID, instanceID, recordScope(module, object, id), action)
	}
}

func (d *Deps) mayOnRecord(ctx context.Context, module, object, id, action string) bool {
	if d.Permissions == nil {
		return false
	}
	subject := accounts.IDFromContext(ctx)
	if subject == "" || id == "" {
		return false
	}
	ok, err := d.Permissions.MayPerformIn(ctx, subject, partitionOf(ctx), recordScope(module, object, id), action)
	return err == nil && ok
}

func (d *Deps) endRecordGrants(ctx context.Context, module, object, id string) ([]permissions.Grant, error) {
	if d.Permissions == nil || id == "" {
		return nil, nil
	}
	partition := partitionOf(ctx)
	grants, err := d.Permissions.ListGrants(ctx, permissions.GrantFilter{Scope: recordScope(module, object, id)})
	if err != nil {
		return nil, err
	}
	ended := make([]permissions.Grant, 0, len(grants))
	for _, g := range grants {
		if g.Partition != partition {
			continue
		}
		if err := d.Permissions.WithdrawGrantIn(ctx, g.Subject, g.Partition, g.Scope, g.RoleCode); err != nil {
			return ended, err
		}
		ended = append(ended, g)
	}
	return ended, nil
}

func (d *Deps) endRecordGrantsOf(r *http.Request, module, object, id string) error {
	ended, err := d.endRecordGrants(r.Context(), module, object, id)
	d.tellRecordAccessEnded(r.Context(), recordIdentity(module, object, id), ended)
	return err
}

func recordIdentity(module, object, id string) string {
	return module + "/" + object + "/" + id
}

func (d *Deps) tellRecordAccessEnded(ctx context.Context, record string, ended []permissions.Grant) {
	if d.Registry == nil {
		return
	}
	for _, g := range ended {
		cm, err := d.Registry.CommManager(ctx, g.Partition)
		if err == nil {
			_, err = cm.EndRecordAccess(ctx, record, g.Subject)
		}
		if err != nil {
			slog.Default().Warn("an ended record grant raised no notification", "partition", g.Partition, "record", record, "error", err.Error())
		}
	}
}
