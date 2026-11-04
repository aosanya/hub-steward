package routes

import (
	"fmt"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"

	workspace "wakalaserver/modules/workspace"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	"workbook":  "Workbook",
	"reference": "Reference",
	"use":       "Use",
	"shortcut":  "Shortcut",
	"share":     "Share",

	"layout":        "Layout",
	"layout_change": "LayoutChange",
	"layout_choice": "LayoutChoice",
}

var storeOwned = map[string]bool{
	"Workbook.owner":     true,
	"Workbook.deleted":   true,
	"Reference.deleted":  true,
	"Shortcut.uses":      true,
	"Shortcut.last_used": true,
	"Share.key_hash":     true,
	"Share.status":       true,

	"Layout.version":           true,
	"Layout.set_aside":         true,
	"Layout.deleted":           true,
	"LayoutChange.inverse":     true,
	"LayoutChange.reverted_at": true,
}

var filterFields = map[string]dispatch.FieldDoc{
	"WorkbookFilter.search":  {Description: "Keep only workbooks whose title contains this, ignoring case."},
	"WorkbookFilter.limit":   {Description: "Cap the workbooks returned. Zero means no cap."},
	"ReferenceFilter.module": {Description: "Keep only what belongs to this capability."},
	"ReferenceFilter.item":   {Description: "Keep only this one thing."},
	"UseFilter.action":       {Description: "Keep only acts of this declared action."},
	"UseFilter.limit":        {Description: "Cap the acts returned. Zero means no cap."},
}

func Fields() (map[string]dispatch.FieldDoc, error) {
	b, err := workspace.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for _, role := range b.Roles() {
		carrier, named := carriers[role]
		if !named {
			return nil, fmt.Errorf("workspace tools: role %q has no type to describe", role)
		}
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("workspace tools: the blueprint declares no %q", role)
		}
		for _, f := range o.Fields {
			key := carrier + "." + f.Name
			out[key] = dispatch.FieldDoc{
				Description: f.Description,
				Required:    f.Required,
				ReadOnly:    f.Primary || f.Type == spec.TypeTimestamp || storeOwned[key],
				Values:      f.Values,
			}
		}
	}
	for key, doc := range filterFields {
		out[key] = doc
	}
	return out, nil
}

func BuildTools(wm workspace.WorkspaceManager) ([]Tool, error) { return BuildToolsWith(wm, nil) }

func BuildToolsWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) ([]Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	tools, err := dispatch.Tools(s, dispatch.Deps{
		Manager: wm, Errors: sentinels, Fields: fields, Authorize: authorize,
	})
	if err != nil {
		return nil, err
	}
	return ownerOnly(tools), nil
}

func Tools(wm workspace.WorkspaceManager) []Tool { return ToolsWith(wm, nil) }

func ToolsWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) []Tool {
	out, err := BuildToolsWith(wm, authorize)
	if err != nil {
		panic(fmt.Sprintf("workspace tools: %v", err))
	}
	return out
}

func ownerOnly(tools []Tool) []Tool {
	anonymous := map[string]bool{}
	for _, action := range AnonymousActions {
		anonymous[action] = true
	}
	out := make([]Tool, 0, len(tools))
	for _, t := range tools {
		if anonymous[t.Action] {
			continue
		}
		out = append(out, t)
	}
	return out
}
