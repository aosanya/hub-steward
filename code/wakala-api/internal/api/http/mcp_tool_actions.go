package http

import (
	"fmt"

	actorroutes "wakalaserver/modules/actor/routes"
	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
	assetroutes "wakalaserver/modules/assetmanager/routes"
	catalogroutes "wakalaserver/modules/catalog/routes"
	mwanachamacomm "wakalaserver/modules/comm"
	commroutes "wakalaserver/modules/comm/routes"
	formsroutes "wakalaserver/modules/forms/routes"
	mwanachamainsights "wakalaserver/modules/insights"
	insightsroutes "wakalaserver/modules/insights/routes"
	"wakalaserver/modules/shared/dispatch"
	mwanachamasources "wakalaserver/modules/sources"
	sourcesroutes "wakalaserver/modules/sources/routes"
	taskmanagerroutes "wakalaserver/modules/taskmanager/routes"
)

func sameToolName(name string) string { return name }

func addToolActions(into map[string]string, nameOf func(string) string, tools []dispatch.Tool) {
	for _, t := range tools {
		into[nameOf(t.Name)] = t.Action
	}
}

func mustBuildTools(family string, tools []dispatch.Tool, err error) []dispatch.Tool {
	if err != nil {
		panic(fmt.Sprintf("%s tool actions: %v", family, err))
	}
	return tools
}

func routePackageToolActions() map[string]string {
	out := map[string]string{}
	addToolActions(out, sameToolName, actorroutes.ToolsFor(actorToolShape{}, actorroutes.Mount{}))
	chat, err := commroutes.BuildChatTools((*mwanachamacomm.CommManager)(nil), commroutes.Mount{})
	addToolActions(out, sameToolName, mustBuildTools("comm", chat, err))
	gated, err := formsroutes.BuildGatedTools(formsToolShape{}, formsroutes.Mount{})
	addToolActions(out, sameToolName, mustBuildTools("forms", gated, err))
	addToolActions(out, formsCatalogToolName, catalogroutes.ToolsFor(formsCatalogShape{}, formsCatalogRouteMount))
	repository, err := formsGitTools(formsGitShape{})
	addToolActions(out, formsGitToolName, mustBuildTools("forms git", repository, err))
	addToolActions(out, sameToolName, taskmanagerroutes.ToolShape())
	addToolActions(out, sameToolName, sourcesroutes.Tools(struct {
		mwanachamasources.SourceManager
	}{}, sourcesroutes.Mount{}))
	assets, err := assetroutes.BuildTools(struct {
		mwanachamaassetmanager.AssetManager
	}{}, assetroutes.Mount{})
	addToolActions(out, sameToolName, mustBuildTools("asset manager", assets, err))
	addToolActions(out, sameToolName, insightsroutes.Tools(struct {
		mwanachamainsights.InsightManager
	}{}))
	return out
}

func hostToolActions() map[string]string {
	return map[string]string{
		"agency_propose_write":   "instance.approval.propose",
		"agency_list_approvals":  "instance.approval.list",
		"agency_get_approval":    "instance.approval.read",
		"agency_decide_approval": "instance.approval.decide",
		"agency_amend_approval":  "instance.approval.amend",
		"agency_run_review":      "agency.review.start",
		"instance_get_join_mode": "instance.join_mode.read",
		"instance_set_join_mode": "instance.join_mode.set",
		"instance_rename":        "instance.instance.rename",
		"instance_get_languages": "instance.languages.read",
		"instance_set_languages": "instance.languages.set",
	}
}
