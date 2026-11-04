package routes

import (
	"fmt"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"

	insights "wakalaserver/modules/insights"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	"insight": "Insight",
	"note":    "InsightNote",
}

var storeOwned = map[string]bool{
	"Insight.created_at":     true,
	"InsightNote.created_at": true,
}

var filterFields = map[string]dispatch.FieldDoc{
	"InsightFilter.repo": {
		Description: "Keep only insights recorded for this body of work.",
	},
	"InsightFilter.subject_id": {
		Description: "Keep only insights recorded about this subject.",
	},
}

func Fields() (map[string]dispatch.FieldDoc, error) {
	b, err := insights.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for _, role := range b.Roles() {
		carrier, named := carriers[role]
		if !named {
			return nil, fmt.Errorf("insights tools: role %q has no type to describe", role)
		}
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("insights tools: the blueprint declares no %q", role)
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

func BuildTools(im insights.InsightManager) ([]Tool, error) { return BuildToolsFor(im, Mount{}) }

func BuildToolsFor(im insights.InsightManager, m Mount) ([]Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: im, Errors: sentinels, Fields: fields, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func Tools(im insights.InsightManager) []Tool { return ToolsFor(im, Mount{}) }

func ToolsFor(im insights.InsightManager, m Mount) []Tool {
	out, err := BuildToolsFor(im, m)
	if err != nil {
		panic(fmt.Sprintf("insights tools: %v", err))
	}
	return out
}
