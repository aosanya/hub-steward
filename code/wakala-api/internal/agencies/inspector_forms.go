package agencies

import (
	"context"
	"fmt"

	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
	mwanachamaforms "wakalaserver/modules/forms"
)

type roleNamesHeld func(ctx context.Context, actorID string) ([]string, error)

type permitEntries func(ctx context.Context) ([]mwanachamacatalog.Entry, error)

func inspectorFormsFrom(held roleNamesHeld, permits permitEntries) mwanachamaforms.InspectorForms {
	return func(ctx context.Context, inspectorID string) ([]string, error) {
		names, err := held(ctx, inspectorID)
		if err != nil || len(names) == 0 {
			return nil, err
		}
		mine := make(map[string]bool, len(names))
		for _, name := range names {
			mine[name] = true
		}
		entries, err := permits(ctx)
		if err != nil {
			return nil, err
		}
		var formIDs []string
		for _, e := range entries {
			terms, err := mwanachamacatalog.ServiceTermsOf(e)
			if err != nil || terms.InspectorRole == "" || e.FormID == "" || !mine[terms.InspectorRole] {
				continue
			}
			formIDs = append(formIDs, e.FormID)
		}
		return formIDs, nil
	}
}

func (r *registry) inspectorFormsIn(instanceID string) mwanachamaforms.InspectorForms {
	held := func(ctx context.Context, actorID string) ([]string, error) {
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return nil, fmt.Errorf("inspectorFormsIn: %w", err)
		}
		seats, err := directory.ListRoleAssignmentsForActor(ctx, actorID, true)
		if err != nil {
			return nil, fmt.Errorf("inspectorFormsIn: %w", err)
		}
		var names []string
		for _, s := range seats {
			kind, err := directory.GetRoleKind(ctx, s.KindID)
			if err != nil {
				return nil, fmt.Errorf("inspectorFormsIn: %w", err)
			}
			names = append(names, kind.Name)
		}
		return names, nil
	}
	permits := func(ctx context.Context) ([]mwanachamacatalog.Entry, error) {
		cm, err := r.CatalogManager(ctx, instanceID, MountCatalog)
		if err != nil {
			return nil, fmt.Errorf("inspectorFormsIn: %w", err)
		}
		var out []mwanachamacatalog.Entry
		for _, kind := range []string{"permit", "licence"} {
			cards, err := cm.ListEntries(ctx, mwanachamacatalog.ListFilter{Kind: kind})
			if err != nil {
				return nil, fmt.Errorf("inspectorFormsIn: %w", err)
			}
			for _, c := range cards {
				full, err := cm.GetEntry(ctx, c.Slug)
				if err != nil {
					return nil, fmt.Errorf("inspectorFormsIn: %w", err)
				}
				out = append(out, full)
			}
		}
		return out, nil
	}
	return inspectorFormsFrom(held, permits)
}
