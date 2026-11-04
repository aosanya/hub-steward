package http

import (
	"context"

	commmodels "wakalaserver/modules/comm/models"
	mwanachamamarket "wakalaserver/modules/market"

	"wakalaserver/internal/notifyrules"
)

func (m marketAnnounced) CallOffGroupOrder(ctx context.Context, caller, id string) (mwanachamamarket.GroupOrder, error) {
	g, err := m.MarketManager.CallOffGroupOrder(ctx, caller, id)
	if err != nil {
		return g, err
	}
	view, err := m.MarketManager.GetGroupOrder(ctx, caller, id)
	if err != nil {
		return g, nil
	}
	names := map[string]string{"product": g.Product}
	seen := map[string]bool{caller: true, "": true}
	people := []string{g.Coordinator}
	for _, l := range view.Lines {
		people = append(people, l.Picker)
	}
	for _, person := range people {
		if seen[person] {
			continue
		}
		seen[person] = true
		for _, told := range m.toldOf(ctx, notifyrules.GroupOrderCalledOff, person) {
			m.raiseNamed(ctx, told, commmodels.SubjectGroupOrder, g.ID, commmodels.EventGroupOrderCalledOff, names)
		}
	}
	return g, nil
}
