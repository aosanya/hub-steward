package agencies

import (
	"context"
	"errors"

	mwanachamaactor "wakalaserver/modules/actor"
	"wakalaserver/modules/shared/identity"
)

const actorObject = "actor"

type actorOwners struct {
	actors func(ctx context.Context) (mwanachamaactor.UserManager, error)
}

func (a actorOwners) StableIdentity(ctx context.Context, object, id string) (string, error) {
	if object != actorObject {
		return "", identity.ErrNotOwned
	}
	if _, _, err := a.Resolve(ctx, id); err != nil {
		return "", err
	}
	return id, nil
}

func (a actorOwners) Resolve(ctx context.Context, raw string) (string, string, error) {
	if raw == "" {
		return "", "", identity.ErrInvalidRaw
	}
	um, err := a.actors(ctx)
	if err != nil {
		return "", "", err
	}
	if _, err := um.GetActor(ctx, raw); err != nil {
		if errors.Is(err, mwanachamaactor.ErrActorNotFound) {
			return "", "", identity.ErrNotFound
		}
		return "", "", err
	}
	return actorObject, raw, nil
}
