package http

import (
	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaassetmanager "github.com/aosanya/mwanachama-backend-assetmanager"
	assetmcp "github.com/aosanya/mwanachama-backend-assetmanager/mcp"
	assetroutes "github.com/aosanya/mwanachama-backend-assetmanager/routes"
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
	d.guardChangeTools(server)
}
