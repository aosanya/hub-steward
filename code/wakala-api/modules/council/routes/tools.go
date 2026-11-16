package routes

import (
	"fmt"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"

	council "wakalaserver/modules/council"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	"bylaw":      "Bylaw",
	"meeting":    "Meeting",
	"agenda":     "Agenda",
	"minutes":    "Minutes",
	"resolution": "Resolution",
}

var storeOwned = map[string]bool{
	"Bylaw.created_at":      true,
	"Meeting.created_at":    true,
	"Agenda.created_at":     true,
	"Agenda.updated_at":     true,
	"Minutes.created_at":    true,
	"Minutes.updated_at":    true,
	"Resolution.created_at": true,
}

var requestFields = map[string]dispatch.FieldDoc{
	"BylawFilter.instance_id": {
		Description: "The agency whose council bylaws to list.",
		Required:    true,
	},
	"BylawFilter.year": {
		Description: "Only the bylaws of this year. Leave out for every bylaw.",
	},
	"BylawKey.instance_id": {
		Description: "The agency whose council the bylaw belongs to.",
		Required:    true,
	},
	"BylawKey.id": {
		Description: "The bylaw to read.",
		Required:    true,
	},
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
	"AgendaKey.instance_id": {
		Description: "The agency whose council the agenda belongs to.",
		Required:    true,
	},
	"AgendaKey.meeting_id": {
		Description: "The meeting whose agenda to read.",
		Required:    true,
	},
	"MinutesKey.instance_id": {
		Description: "The agency whose council the minutes belong to.",
		Required:    true,
	},
	"MinutesKey.meeting_id": {
		Description: "The meeting whose minutes to read.",
		Required:    true,
	},
	"ResolutionFilter.instance_id": {
		Description: "The agency whose council resolutions to list.",
		Required:    true,
	},
	"ResolutionFilter.meeting_id": {
		Description: "Only the resolutions taken at this meeting. Leave out for every resolution.",
	},
	"ResolutionFilter.outcome": {
		Description: "Only resolutions with this outcome: adopted, rejected or deferred. Leave out for every outcome.",
	},
	"ResolutionKey.instance_id": {
		Description: "The agency whose council the resolution belongs to.",
		Required:    true,
	},
	"ResolutionKey.id": {
		Description: "The resolution to read.",
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
