package routes

import (
	"fmt"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"

	council "wakalaserver/modules/council"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	"meeting": "Meeting",
}

var storeOwned = map[string]bool{
	"Meeting.created_at": true,
}

var requestFields = map[string]dispatch.FieldDoc{
	"MeetingFilter.instance_id": {
		Description: "The agency whose council meetings to list.",
		Required:    true,
	},
	"MeetingFilter.committee": {
		Description: "Only this committee's meetings. Leave out for every meeting.",
	},
	"MeetingKey.instance_id": {
		Description: "The agency whose council the meeting belongs to.",
		Required:    true,
	},
	"MeetingKey.id": {
		Description: "The meeting to read.",
		Required:    true,
	},
}

func Fields() (map[string]dispatch.FieldDoc, error) {
	b, err := council.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for _, role := range b.Roles() {
		carrier, named := carriers[role]
		if !named {
			return nil, fmt.Errorf("council tools: role %q has no type to describe", role)
		}
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("council tools: the blueprint declares no %q", role)
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
	for key, doc := range requestFields {
		out[key] = doc
	}
	return out, nil
}

func BuildTools(cm council.CouncilManager) ([]Tool, error) { return BuildToolsFor(cm, Mount{}) }

func BuildToolsFor(cm council.CouncilManager, m Mount) ([]Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: cm, Errors: sentinels, Fields: fields, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func Tools(cm council.CouncilManager) []Tool { return ToolsFor(cm, Mount{}) }

func ToolsFor(cm council.CouncilManager, m Mount) []Tool {
	out, err := BuildToolsFor(cm, m)
	if err != nil {
		panic(fmt.Sprintf("council tools: %v", err))
	}
	return out
}
