package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"sync"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"

	mwanachamaagency "wakalaserver/modules/agency"
)

const instanceArg = "instance_id"

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(mwanachamaagency.Operations())
})

var carriers = map[string]string{
	"agency":             "Agency",
	"draft":              "Draft",
	"goal":               "Goal",
	"objective":          "Objective",
	"workflow":           "Workflow",
	"work_item":          "WorkItem",
	"workflow_objective": "WorkflowObjective",
	"event_flow_step":    "EventFlowStep",
	"role":               "Role",
	"role_assignment":    "RoleAssignment",
	"module":             "Module",
	"value":              "Value",
	"value_attachment":   "ValueAttachment",
	"rule":               "Rule",
	"rule_attachment":    "RuleAttachment",
	"control":            "Control",
	"control_attachment": "ControlAttachment",
	"issue":              "Issue",
	"agency_publication": "AgencyPublication",
	"record":             "Record",
	"record_row":         "RecordRow",
	"measure":            "Measure",
	"risk":               "Risk",
	"risk_pathway":       "RiskPathway",
	"hazard":             "Hazard",
	"threat":             "Threat",
	"consequence":        "Consequence",
	"risk_threat":        "RiskThreat",
	"risk_consequence":   "RiskConsequence",
	"scenario":           "Scenario",
	"scenario_actor":     "ScenarioActor",
	"scenario_input":     "ScenarioInput",
	"test_run":           "TestRun",
}

var storeOwned = map[string]bool{
	"Module.enabled":   true,
	"Measure.current":  true,
	"Measure.draft_id": true,
	"Draft.status":     true,
	"Issue.severity":   true,
	"Issue.message":    true,
	"Issue.entity_id":  true,

	"ScenarioActor.draft_id":    true,
	"ScenarioActor.scenario_id": true,
	"ScenarioInput.draft_id":    true,
	"ScenarioInput.scenario_id": true,
}

func fields() (map[string]dispatch.FieldDoc, error) {
	b, err := mwanachamaagency.Blueprint()
	if err != nil {
		return nil, err
	}
	out := map[string]dispatch.FieldDoc{}
	for role, carrier := range carriers {
		o, ok := b.Object(role)
		if !ok {
			return nil, fmt.Errorf("agency tools: the blueprint declares no %q", role)
		}
		for _, f := range o.Fields {
			key := carrier + "." + f.Name
			out[key] = dispatch.FieldDoc{
				Description: f.Description,
				Required:    f.Required,
				ReadOnly:    f.Primary || f.Type == spec.TypeTimestamp || f.Immutable || f.Name == "deleted" || storeOwned[key],
				Values:      f.Values,
			}
		}
	}
	return out, nil
}

func toolsFor(m mwanachamaagency.AgencyManager) ([]dispatch.Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	f, err := fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{Manager: m, Errors: sentinels, Fields: f})
}

func registerDeclaredTools(server *mcp.Server, resolve ManagerResolver) error {
	shapes, err := toolsFor(mwanachamaagency.ManagerShape())
	if err != nil {
		return err
	}
	for _, shape := range shapes {
		schema, err := withInstance(shape.InputSchema)
		if err != nil {
			return fmt.Errorf("agency tools: %s: %w", shape.Name, err)
		}
		mcp.AddTool(server, &mcp.Tool{
			Name:        shape.Name,
			Title:       shape.Title,
			Description: shape.Description,
			InputSchema: schema,
		}, declaredHandler(shape.Name, resolve))
	}
	return nil
}

func withInstance(schema json.RawMessage) (json.RawMessage, error) {
	var doc map[string]any
	if err := json.Unmarshal(schema, &doc); err != nil {
		return nil, err
	}
	properties, ok := doc["properties"].(map[string]any)
	if !ok {
		properties = map[string]any{}
		doc["properties"] = properties
	}
	properties[instanceArg] = map[string]any{
		"type":        "string",
		"description": "which Agency this operates on, as resolved by the mounting host",
	}

	required, _ := doc["required"].([]any)
	doc["required"] = append(required, instanceArg)

	return json.Marshal(doc)
}

func declaredHandler(name string, resolve ManagerResolver) func(context.Context, *mcp.CallToolRequest, map[string]any) (*mcp.CallToolResult, any, error) {
	return func(ctx context.Context, req *mcp.CallToolRequest, in map[string]any) (*mcp.CallToolResult, any, error) {
		instance, _ := in[instanceArg].(string)
		delete(in, instanceArg)

		m, err := resolve(ctx, instance)
		if err != nil {
			return nil, nil, err
		}
		tools, err := toolsFor(m)
		if err != nil {
			return nil, nil, err
		}
		tool, ok := byName(tools, name)
		if !ok {
			return nil, nil, fmt.Errorf("agency tools: %s is no longer declared", name)
		}

		args, err := json.Marshal(in)
		if err != nil {
			return nil, nil, err
		}
		out, err := tool.Handle(ctx, dispatch.Request{Arguments: args, Meta: metaOf(req)})
		if err != nil {
			return nil, nil, err
		}
		if out == nil {
			return summary("Done."), nil, nil
		}
		return summaryWithContext(headline(out), describe(out)), structured(out), nil
	}
}

func metaOf(req *mcp.CallToolRequest) map[string]any {
	if req == nil || req.Params == nil {
		return nil
	}
	return req.Params.Meta
}

func structured(out any) any {
	if reflect.ValueOf(out).Kind() == reflect.Slice {
		return map[string]any{"items": out}
	}
	return out
}

func byName(tools []dispatch.Tool, name string) (dispatch.Tool, bool) {
	for _, t := range tools {
		if t.Name == name {
			return t, true
		}
	}
	return dispatch.Tool{}, false
}

func headline(out any) string {
	v := reflect.ValueOf(out)
	if v.Kind() == reflect.Slice {
		return fmt.Sprintf("Found %d.", v.Len())
	}
	return "Done."
}

func describe(out any) string {
	v := reflect.ValueOf(out)
	if v.Kind() != reflect.Slice {
		return line(v)
	}
	if v.Len() == 0 {
		return "There are none yet."
	}
	lines := make([]string, 0, v.Len())
	for i := 0; i < v.Len(); i++ {
		lines = append(lines, "- "+line(v.Index(i)))
	}
	return strings.Join(lines, "\n")
}

func line(v reflect.Value) string {
	if v.Kind() == reflect.Pointer {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return fmt.Sprint(v.Interface())
	}

	var handle, label string
	var refs, facts []string

	rt := v.Type()
	for i := 0; i < rt.NumField(); i++ {
		name := rt.Field(i).Name
		if rt.Field(i).PkgPath != "" || skipInLine[name] {
			continue
		}
		value := text(v, name)
		if value == "" {
			continue
		}
		switch {
		case handle == "" && (name == "Code" || name == "Tag" || name == "Version"):
			handle = mwanachamaagency.QuoteIfUnsafe(value)
		case label == "" && labelFields[name]:
			label = value
		case name == "ID":
			refs = append([]string{"id: " + mwanachamaagency.QuoteIfUnsafe(value)}, refs...)
		case strings.HasSuffix(name, "ID") || strings.HasSuffix(name, "Code"):
			refs = append(refs, reference(name)+": "+mwanachamaagency.QuoteIfUnsafe(value))
		case factFields[name]:
			facts = append(facts, reference(name)+": "+mwanachamaagency.QuoteIfUnsafe(value))
		}
	}

	var head []string
	if handle != "" {
		head = append(head, handle)
	}
	if label != "" {
		head = append(head, fmt.Sprintf("%q", label))
	}

	aside := append(facts, refs...)
	switch {
	case len(head) == 0 && len(aside) == 0:
		return "(no identifying fields)"
	case len(aside) == 0:
		return strings.Join(head, " ")
	case len(head) == 0:
		return strings.Join(aside, ", ")
	default:
		return strings.Join(head, " ") + " (" + strings.Join(aside, ", ") + ")"
	}
}

var skipInLine = map[string]bool{"DraftID": true, "CreatedAt": true, "LastUpdated": true, "PublishedAt": true}

var labelFields = map[string]bool{"Title": true, "Name": true, "Text": true, "Message": true, "Description": true}

var factFields = map[string]bool{"Label": true, "Severity": true, "Channel": true, "TargetType": true, "Status": true, "Enabled": true}

func reference(field string) string {
	var out []rune
	runes := []rune(field)
	for i, r := range runes {
		upper := r >= 'A' && r <= 'Z'
		if upper && i > 0 {
			prevLower := runes[i-1] >= 'a' && runes[i-1] <= 'z'
			nextLower := i+1 < len(runes) && runes[i+1] >= 'a' && runes[i+1] <= 'z'
			if prevLower || nextLower {
				out = append(out, ' ')
			}
		}
		if upper {
			out = append(out, r-'A'+'a')
			continue
		}
		out = append(out, r)
	}
	return string(out)
}

func text(v reflect.Value, name string) string {
	f := v.FieldByName(name)
	if !f.IsValid() {
		return ""
	}
	switch f.Kind() {
	case reflect.String:
		return f.String()
	case reflect.Int, reflect.Int64:
		return fmt.Sprint(f.Int())
	default:
		return ""
	}
}
