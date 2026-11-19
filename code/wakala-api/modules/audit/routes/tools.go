package routes

import (
	"fmt"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"
	"github.com/aosanya/mwanachama-backend-shared/spec"

	audit "wakalaserver/modules/audit"
)

type Tool = dispatch.Tool

var carriers = map[string]string{
	"entry": "Entry",
}

var storeOwned = map[string]bool{
	"Entry.at": true,
}

var filterFields = map[string]dispatch.FieldDoc{
	"EntryFilter.instance_id": {
		Description: "The agency whose log to read.",
		Required:    true,
	},
	"EntryFilter.actor": {
		Description: "Only entries made by this actor. Optional.",
	},
	"EntryFilter.subject": {
		Description: "Only entries about this subject. Optional.",
	},
}

func Fields() (map[string]dispatch.FieldDoc, error) {
	b, err := audit.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for _, role := range b.Roles() {
		carrier, named := carriers[role]
		if !named {
			return nil, fmt.Errorf("audit tools: role %q has no type to describe", role)
		}
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("audit tools: the blueprint declares no %q", role)
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

func BuildTools(am audit.AuditManager) ([]Tool, error) { return BuildToolsFor(am, Mount{}) }

func BuildToolsFor(am audit.AuditManager, m Mount) ([]Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: am, Errors: sentinels, Fields: fields, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func Tools(am audit.AuditManager) []Tool { return ToolsFor(am, Mount{}) }

func ToolsFor(am audit.AuditManager, m Mount) []Tool {
	out, err := BuildToolsFor(am, m)
	if err != nil {
		panic(fmt.Sprintf("audit tools: %v", err))
	}
	return out
}
