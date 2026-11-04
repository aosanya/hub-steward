package agencies

import (
	"context"
	"fmt"

	mwanachamaforms "wakalaserver/modules/forms"
)

func (r *registry) membersIn(instanceID string) mwanachamaforms.Members {
	return func(ctx context.Context, groupID string, includesDescendants bool) ([]string, error) {
		if groupID == "" {
			return nil, nil
		}
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return nil, fmt.Errorf("membersIn: %w", err)
		}
		groups := []string{groupID}
		visited := map[string]bool{groupID: true}
		for i := 0; includesDescendants && i < len(groups); i++ {
			children, err := directory.ListGroupChildren(ctx, groups[i])
			if err != nil {
				return nil, fmt.Errorf("membersIn: %w", err)
			}
			for _, c := range children {
				if !visited[c.ID] {
					visited[c.ID] = true
					groups = append(groups, c.ID)
				}
			}
		}
		seen := map[string]bool{}
		var out []string
		for _, g := range groups {
			held, err := directory.ListActorsForGroup(ctx, g)
			if err != nil {
				return nil, fmt.Errorf("membersIn: %w", err)
			}
			for _, a := range held {
				if a.Deleted || a.ActorID == "" || seen[a.ActorID] {
					continue
				}
				seen[a.ActorID] = true
				out = append(out, a.ActorID)
			}
		}
		return out, nil
	}
}
