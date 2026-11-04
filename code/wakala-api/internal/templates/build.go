package templates

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	mwanachamaagencymodels "wakalaserver/modules/agency/models"
)

var raciLabels = map[string]bool{"responsible": true, "accountable": true, "consulted": true, "informed": true}

var targetTypes = map[string]bool{
	"role": true, "goal": true, "objective": true, "workflow": true, "work_item": true,
}

type Built struct {
	Document      json.RawMessage
	Readme        string
	Sales         string
	ModuleConfigs json.RawMessage
}

type builder struct {
	spec     Spec
	now      string
	counters map[string]int
	ids      map[string]string
	codes    map[string]string
	problems []string
}

func Build(spec Spec, now time.Time) (Built, error) {
	b := &builder{
		spec:     spec,
		now:      now.UTC().Format(time.RFC3339),
		counters: map[string]int{},
		ids:      map[string]string{},
		codes:    map[string]string{},
	}
	doc := b.document()
	if len(b.problems) > 0 {
		sort.Strings(b.problems)
		return Built{}, fmt.Errorf("%s", strings.Join(b.problems, "; "))
	}
	encoded, err := withTemplateBlock(doc, spec, b.now)
	if err != nil {
		return Built{}, err
	}
	out := Built{Document: encoded, Readme: spec.Readme, Sales: spec.Sales}
	if len(spec.ModuleConfigs) > 0 {
		configs, err := json.MarshalIndent(spec.ModuleConfigs, "", "  ")
		if err != nil {
			return Built{}, err
		}
		out.ModuleConfigs = configs
	}
	return out, nil
}

func withTemplateBlock(doc mwanachamaagencymodels.AgencyDocument, spec Spec, now string) (json.RawMessage, error) {
	encoded, err := json.Marshal(doc)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(encoded, &out); err != nil {
		return nil, err
	}
	mode := spec.ResearchMode
	if mode == "" {
		mode = "model-knowledge"
	}
	if mode != "web" && mode != "model-knowledge" {
		return nil, fmt.Errorf("research_mode %q is neither \"web\" nor \"model-knowledge\"", mode)
	}
	out["_template"] = map[string]string{
		"sector":        spec.Sector,
		"archetype":     spec.Archetype,
		"mined_at":      now,
		"research_mode": mode,
	}
	return json.MarshalIndent(out, "", "  ")
}

func (b *builder) fail(format string, a ...any) {
	b.problems = append(b.problems, fmt.Sprintf(format, a...))
}

func (b *builder) code(prefix string) string {
	b.counters[prefix]++
	return fmt.Sprintf("%s-%d", prefix, b.counters[prefix])
}

func (b *builder) declare(kind, key, prefix, description string) (string, string) {
	if strings.TrimSpace(key) == "" {
		b.fail("a %s has no key", kind)
		return "", ""
	}
	if _, taken := b.ids[kind+":"+key]; taken {
		b.fail("two %ss share the key %q", kind, key)
		return "", ""
	}
	if description != "" && strings.TrimSpace(description) == "" {
		b.fail("%s %q: a description that is only whitespace is not a description", kind, key)
	}
	id, code := uuid.NewString(), b.code(prefix)
	b.ids[kind+":"+key] = id
	b.codes[kind+":"+key] = code
	return id, code
}

func (b *builder) ref(kind, key, why string) string {
	id, ok := b.ids[kind+":"+key]
	if !ok {
		b.fail("%s names the %s %q, which is not declared", why, kind, key)
	}
	return id
}

func (b *builder) refCode(kind, key, why string) string {
	code, ok := b.codes[kind+":"+key]
	if !ok {
		b.fail("%s names the %s %q, which is not declared", why, kind, key)
	}
	return code
}

func (b *builder) needProse(kind, key, field, text string) {
	if strings.TrimSpace(text) == "" {
		b.fail("%s %q has no %s — say what it is and why it exists", kind, key, field)
	}
}

func (b *builder) document() mwanachamaagencymodels.AgencyDocument {
	doc := mwanachamaagencymodels.AgencyDocument{
		Agency: mwanachamaagencymodels.DocumentAgency{
			Name:        b.spec.Name,
			Description: b.spec.Description,
			Enabled:     false,
		},
	}
	if strings.TrimSpace(b.spec.Name) == "" {
		b.fail("the template has no name")
	}
	b.needProse("template", b.spec.Slug, "description", b.spec.Description)

	for _, r := range b.spec.Roles {
		id, code := b.declare("role", r.Key, "R", r.Description)
		b.needProse("role", r.Key, "description", r.Description)
		doc.Roles = append(doc.Roles, mwanachamaagencymodels.DocumentRole{
			ID: id, Code: code, Name: r.Name, Description: r.Description})
	}
	for _, g := range b.spec.Goals {
		id, code := b.declare("goal", g.Key, "G", g.Description)
		b.needProse("goal", g.Key, "description", g.Description)
		doc.Goals = append(doc.Goals, mwanachamaagencymodels.DocumentGoal{
			ID: id, Code: code, Title: g.Title, Description: g.Description})
	}
	for _, o := range b.spec.Objectives {
		id, code := b.declare("objective", o.Key, "O", o.Description)
		b.needProse("objective", o.Key, "description", o.Description)
		doc.Objectives = append(doc.Objectives, mwanachamaagencymodels.DocumentObjective{
			ID: id, Code: code, Title: o.Title, Description: o.Description,
			GoalID: b.ref("goal", o.Goal, fmt.Sprintf("objective %q", o.Key))})
	}
	for _, w := range b.spec.Workflows {
		id, code := b.declare("workflow", w.Key, "W", w.Description)
		b.needProse("workflow", w.Key, "description", w.Description)
		doc.Workflows = append(doc.Workflows, mwanachamaagencymodels.DocumentWorkflow{
			ID: id, Code: code, Name: w.Name, Description: w.Description})
	}
	for _, wi := range b.spec.WorkItems {
		id, code := b.declare("work_item", wi.Key, "WI", wi.Description)
		b.needProse("work item", wi.Key, "description", wi.Description)
		b.needProse("work item", wi.Key, "prompt", wi.Prompt)
		doc.WorkItems = append(doc.WorkItems, mwanachamaagencymodels.DocumentWorkItem{
			ID: id, Code: code, Title: wi.Title, Description: wi.Description, Prompt: wi.Prompt,
			WorkflowID: b.ref("workflow", wi.Workflow, fmt.Sprintf("work item %q", wi.Key))})
	}
	doc.WorkflowObjectives = b.workflowObjectives()
	for _, c := range b.spec.Controls {
		id, code := b.declare("control", c.Key, "C", "")
		b.needProse("control", c.Key, "text", c.Text)
		doc.Controls = append(doc.Controls, mwanachamaagencymodels.DocumentControl{ID: id, Code: code, Text: c.Text})
		if c.TargetType != "" {
			doc.ControlAttachments = append(doc.ControlAttachments, b.attach(c, code))
		}
	}

	for _, a := range b.spec.RACI {
		if !raciLabels[a.Label] {
			b.fail("RACI on work item %q: %q is not responsible, accountable, consulted or informed", a.WorkItem, a.Label)
			continue
		}
		doc.RoleAssignments = append(doc.RoleAssignments, mwanachamaagencymodels.DocumentRoleAssignment{
			RoleID:     b.ref("role", a.Role, "a RACI assignment"),
			WorkItemID: b.ref("work_item", a.WorkItem, "a RACI assignment"),
			Label:      a.Label})
	}

	enabled := map[string]bool{}
	for _, m := range b.spec.Modules {
		enabled[m.Code] = true
	}
	moduleIDs := map[string]string{}
	for _, entry := range mwanachamaagencymodels.ModuleCatalog {
		id := uuid.NewString()
		moduleIDs[entry.Code] = id
		doc.Modules = append(doc.Modules, mwanachamaagencymodels.DocumentModule{
			ID: id, Code: entry.Code, Enabled: entry.Enabled || enabled[entry.Code]})
	}
	for _, m := range b.spec.Modules {
		if _, known := moduleIDs[m.Code]; !known {
			b.fail("module %q is not in the model's own catalog — a code is never invented", m.Code)
			continue
		}
	}
	for code := range b.spec.ModuleConfigs {
		if !enabled[code] {
			b.fail("a configuration is given for module %q, which the template does not enable", code)
		}
	}
	return doc
}

func (b *builder) attach(s Statement, code string) mwanachamaagencymodels.DocumentControlAttachment {
	if !targetTypes[s.TargetType] {
		b.fail("%q attaches to %q, which is not a role, goal, objective, workflow or work item", s.Key, s.TargetType)
		return mwanachamaagencymodels.DocumentControlAttachment{}
	}
	return mwanachamaagencymodels.DocumentControlAttachment{
		ControlCode: code,
		TargetType:  s.TargetType,
		TargetCode:  b.refCode(s.TargetType, s.TargetKey, fmt.Sprintf("the attachment of %q", s.Key)),
	}
}

func (b *builder) workflowObjectives() []mwanachamaagencymodels.DocumentWorkflowObjective {
	var out []mwanachamaagencymodels.DocumentWorkflowObjective
	linked := map[[2]string]bool{}
	link := func(workflowKey, objectiveKey, why string) {
		workflowID := b.ref("workflow", workflowKey, why)
		objectiveID := b.ref("objective", objectiveKey, why)
		pair := [2]string{workflowKey, objectiveKey}
		if linked[pair] {
			return
		}
		linked[pair] = true
		out = append(out, mwanachamaagencymodels.DocumentWorkflowObjective{
			ID: uuid.NewString(), WorkflowID: workflowID, ObjectiveID: objectiveID})
	}
	for _, w := range b.spec.Workflows {
		for _, objective := range w.Objectives {
			link(w.Key, objective, fmt.Sprintf("workflow %q", w.Key))
		}
	}
	for _, wi := range b.spec.WorkItems {
		if wi.Objective != "" {
			link(wi.Workflow, wi.Objective, fmt.Sprintf("work item %q", wi.Key))
		}
	}
	has := map[string]bool{}
	for pair := range linked {
		has[pair[0]] = true
	}
	for _, w := range b.spec.Workflows {
		if !has[w.Key] {
			b.fail("workflow %q has no objective", w.Key)
		}
	}
	return out
}
