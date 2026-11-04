package agencies

import (
	"context"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/reviewruns"
)

func (r *registry) reviewAreasOf(id string) mwanachamaagency.ReviewAreasFunc {
	return func(ctx context.Context, _ string) []agencymodels.ReviewAreaName {
		kind := ""
		if inst, err := r.GetInstance(ctx, id); err == nil {
			kind = inst.Kind
		}
		areas := reviewruns.AreasFor(kind)
		names := make([]agencymodels.ReviewAreaName, len(areas))
		for i, area := range areas {
			names[i] = agencymodels.ReviewAreaName(area)
		}
		return names
	}
}
