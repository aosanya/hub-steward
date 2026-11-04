package http

import (
	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
	assetmcp "wakalaserver/modules/assetmanager/mcp"
	assetroutes "wakalaserver/modules/assetmanager/routes"
)

func (d *Deps) registerAssetMCPTools(server *mcp.Server, resolve assetmcp.ManagerResolver) {
	assetmcp.RegisterResolvedTools(server, resolve, assetManagerMount())
	tools, err := assetroutes.BuildTools(struct {
		mwanachamaassetmanager.AssetManager
	}{}, assetroutes.Mount{})
	if err != nil {
		panic(err)
	}
	actions := map[string]string{}
	for _, t := range tools {
		actions[t.Name] = t.Action
	}
	d.guardToolPermissions(server, actions)
}
