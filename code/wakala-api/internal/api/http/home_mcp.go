package http

import (
	"context"
	"errors"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const (
	getHomeTool   = "agency_get_home"
	getHomeAction = "instance.home.read"
)

func homeToolActions() map[string]string {
	return map[string]string{getHomeTool: getHomeAction}
}

type homeNodeView struct {
	Key        string                   `json:"key"`
	Title      string                   `json:"title"`
	Titles     map[string]string        `json:"titles,omitempty"`
	Icon       string                   `json:"icon,omitempty"`
	Permission string                   `json:"permission,omitempty"`
	Roles      []string                 `json:"roles,omitempty"`
	PageOf     string                   `json:"page_of,omitempty"`
	Target     *agencymodels.HomeTarget `json:"target,omitempty"`
	TargetName string                   `json:"target_name,omitempty"`
	WorkflowID string                   `json:"workflow_id,omitempty"`
	StepID     string                   `json:"step_id,omitempty"`
	Entries    []homeNodeView           `json:"entries,omitempty"`
}

type agencyHomeView struct {
	Entries []homeNodeView `json:"entries"`
}

func (d *Deps) registerHomeMCPTool(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	server.AddTool(&mcp.Tool{
		Name:        getHomeTool,
		Title:       "Read the agency's Home",
		Description: "The rows the agency's published version declares for the app's Home: sections that hold further sections and entries, nested as declared and in the declared order. Each node has a key, a title, its translations by language code, an icon and the permission a person needs to see it. An entry has a target_type (record, workflow, backlog, menu or files) and a target: a record or workflow code, a backlog id or a menu item written as section/item. A workflow entry also carries target_name, the workflow's name. A record or workflow entry whose target the published version no longer holds is left out. An agency that declares no Home, or has no published version, gets an empty list.",
		InputSchema: map[string]any{
			"type":                 "object",
			"properties":           map[string]any{"instance_id": map[string]any{"type": "string", "description": "The agency whose Home to read."}},
			"required":             []string{"instance_id"},
			"additionalProperties": false,
		},
	}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		instanceID, _, err := splitFormsInstance(req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		out, err := d.agencyHome(ctx, instanceID)
		if err != nil {
			return toolError(err), nil
		}
		return &mcp.CallToolResult{
			Content:           []mcp.Content{&mcp.TextContent{Text: getHomeTool + " completed"}},
			StructuredContent: out,
		}, nil
	})
}

func (d *Deps) agencyHome(ctx context.Context, instanceID string) (agencyHomeView, error) {
	none := agencyHomeView{Entries: []homeNodeView{}}
	if err := d.requireAgentMay(ctx, instanceID, getHomeAction); err != nil {
		return none, err
	}
	m, err := agencyOfAnyone(ctx, d.Registry, instanceID)
	if err != nil {
		return none, err
	}
	doc, err := liveDocumentOf(ctx, m)
	if errors.Is(err, errNoLiveVersion) {
		return none, nil
	}
	if err != nil {
		return none, err
	}
	return agencyHomeView{Entries: homeViewOf(doc.Home, homeTargetsOf(doc))}, nil
}

func liveDocumentOf(ctx context.Context, m mwanachamaagency.AgencyManager) (agencymodels.AgencyDocument, error) {
	pubs, err := m.ListPublications(ctx, mwanachamaagency.PublicationFilter{Channel: agencymodels.DefaultChannel})
	if err != nil {
		return agencymodels.AgencyDocument{}, err
	}
	best := agencymodels.AgencyPublication{}
	for _, p := range pubs {
		if p.DraftID != "" && p.Version >= best.Version {
			best = p
		}
	}
	if best.DraftID == "" {
		return agencymodels.AgencyDocument{}, errNoLiveVersion
	}
	published, err := m.GetPublication(ctx, best.Version)
	if err != nil {
		return agencymodels.AgencyDocument{}, err
	}
	return published.Document, nil
}

type homeWorkflowRef struct {
	id   string
	name string
}

type homeTargets struct {
	records   map[string]bool
	workflows map[string]homeWorkflowRef
	steps     map[string]string
}

func homeTargetsOf(doc agencymodels.AgencyDocument) homeTargets {
	held := homeTargets{records: map[string]bool{}, workflows: map[string]homeWorkflowRef{}, steps: map[string]string{}}
	for _, record := range doc.Records {
		held.records[record.Code] = true
	}
	for _, workflow := range doc.Workflows {
		held.workflows[workflow.Code] = homeWorkflowRef{id: workflow.ID, name: workflow.Name}
	}
	for _, step := range doc.WorkItems {
		held.steps[step.Code] = step.ID
	}
	return held
}

func homeViewOf(nodes []agencymodels.DocumentHomeNode, targets homeTargets) []homeNodeView {
	out := []homeNodeView{}
	for _, node := range nodes {
		view := homeNodeView{Key: node.Key, Title: node.Title, Titles: node.Titles, Icon: node.Icon, Permission: node.Permission, Roles: node.Roles, PageOf: node.PageOf, Target: node.Target}
		if node.IsSection() {
			if node.PageOf != "" && !targets.records[node.PageOf] {
				continue
			}
			view.Entries = homeViewOf(node.Entries, targets)
			if node.PageOf == "" && len(view.Entries) == 0 {
				continue
			}
			out = append(out, view)
			continue
		}
		switch node.Target.Type {
		case agencymodels.HomeTargetRecord:
			if !targets.records[node.Target.Ref] {
				continue
			}
		case agencymodels.HomeTargetWorkflow:
			workflow, held := targets.workflows[node.Target.Ref]
			if !held {
				continue
			}
			view.TargetName, view.WorkflowID = workflow.name, workflow.id
			if node.Target.Step != "" {
				stepID, held := targets.steps[node.Target.Step]
				if !held {
					continue
				}
				view.StepID = stepID
			}
		}
		out = append(out, view)
	}
	return out
}
