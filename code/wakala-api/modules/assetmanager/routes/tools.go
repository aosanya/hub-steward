package routes

import (
	"wakalaserver/modules/shared/dispatch"

	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
)

type Tool = dispatch.Tool

func BuildTools(am mwanachamaassetmanager.AssetManager, m Mount) ([]Tool, error) {
	s, err := table.Spec()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: am, Errors: sentinels, Authorize: m.Authorize, Caller: m.Caller,
	})
}
