package agencies

import (
	"context"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacatalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/geo"
)

func wardAreaResolver(um mwanachamaactor.UserManager) mwanachamacatalog.AreaResolver {
	return func(ctx context.Context, pin *geo.Position, _ string) (string, error) {
		if pin == nil {
			return "", nil
		}
		groups, err := um.GroupsAtPoint(ctx, pin.Lon(), pin.Lat())
		if err != nil || len(groups) == 0 {
			return "", err
		}
		return innermost(groups).Name, nil
	}
}

func innermost(groups []mwanachamaactor.Group) mwanachamaactor.Group {
	best := groups[0]
	for _, g := range groups[1:] {
		if boxArea(g) < boxArea(best) {
			best = g
		}
	}
	return best
}

func boxArea(g mwanachamaactor.Group) float64 {
	b := geo.BoundingBox(*g.Boundary)
	return (b.MaxLon - b.MinLon) * (b.MaxLat - b.MinLat)
}
