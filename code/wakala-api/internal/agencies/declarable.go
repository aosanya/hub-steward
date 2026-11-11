package agencies

import (
	"context"
	"fmt"

	mwanachamaforms "wakalaserver/modules/forms"
)

func (r *registry) declarableIn(instanceID string) mwanachamaforms.Declarable {
	return func(ctx context.Context, _ string) ([]string, error) {
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return nil, fmt.Errorf("declarableIn: %w", err)
		}
		held, err := directory.ListGroups(ctx, "")
		if err != nil {
			return nil, fmt.Errorf("declarableIn: %w", err)
		}
		out := make([]string, 0, len(held))
		for _, g := range held {
			out = append(out, g.ID)
		}
		return out, nil
	}
}
