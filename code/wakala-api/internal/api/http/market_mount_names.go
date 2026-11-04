package http

import (
	"context"
	"net/http"
	"strings"

	mwanachamamarket "wakalaserver/modules/market"

	"wakalaserver/internal/agencies"
)

const marketModule = "market"

func marketKeyFor(ctx context.Context, reg agencies.Registry, instanceID, name string) (string, error) {
	set, err := mountedSetOf(ctx, reg, instanceID)
	if err != nil {
		return "", err
	}
	mounts := set.mountsOf(marketModule)
	if name == "" {
		switch len(mounts) {
		case 0:
			return "", agencies.ErrInstanceNotFound
		case 1:
			return mounts[0].Key, nil
		}
		return "", agencies.ErrMarketNameRequired
	}
	for _, m := range mounts {
		if m.Key == name || strings.EqualFold(m.Name, name) {
			return m.Key, nil
		}
	}
	return "", agencies.ErrInstanceNotFound
}

func marketManagerNamed(ctx context.Context, reg agencies.Registry, instanceID, name string) (mwanachamamarket.MarketManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, marketModule); err != nil {
		return nil, err
	}
	if err := mustBeMarketParticipant(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	key, err := marketKeyFor(ctx, reg, instanceID, name)
	if err != nil {
		return nil, err
	}
	return reg.MarketManager(ctx, instanceID, key)
}

func writeMarketErr(w http.ResponseWriter, err error) {
	if err == agencies.ErrMarketNameRequired {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeInstanceErr(w, err)
}
