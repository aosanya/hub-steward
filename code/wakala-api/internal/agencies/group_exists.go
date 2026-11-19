package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"
	mwanachamaactor "wakalaserver/modules/actor"
)

func (r *registry) groupExistsIn(instanceID string) mwanachamataskmanager.GroupExists {
	return func(ctx context.Context, groupID string) (bool, error) {
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return false, fmt.Errorf("groupExistsIn: %w", err)
		}
		_, err = directory.GetGroup(ctx, groupID)
		if errors.Is(err, mwanachamaactor.ErrGroupNotFound) {
			return false, nil
		}
		if err != nil {
			return false, fmt.Errorf("groupExistsIn: %w", err)
		}
		return true, nil
	}
}
