package mcp

import (
	"context"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// typeInfo is a plain-language glossary entry for one domain type — what it
// is, and (if it has one) which tool creates it. Static content, not
// derived from anything at runtime, so it needs no ManagerResolver and
// answers instantly regardless of which Agency the chat is scoped to.
type typeInfo struct {
	Name     string `json:"name"`
	WhatItIs string `json:"what_it_is"`
	HowToAdd string `json:"how_to_add"`
}

// domainTypeCatalog is every domain type this package's tools expose,
// mirroring each type's own doc comment in models/ — kept short and
// operator-facing rather than restating those comments verbatim.
var domainTypeCatalog = []typeInfo{
	{
		Name:     "Agency",
		WhatItIs: "The root of the whole design: the Agency document itself (name, description), everything else hangs off it. Exactly one per Instance.",
		HowToAdd: "agency_create_agency, once, when an Instance is first registered — there is no adding a second one.",
	},
	{
		Name:     "Goal",
		WhatItIs: "A strategic objective the Agency pursues — the top of the work breakdown: Goal → Objective, served by Workflows made of WorkItems.",
		HowToAdd: "agency_create_goal (title, optional description).",
	},
	{
		Name:     "Objective",
		WhatItIs: "A measurable, granular piece of a Goal — a Goal can have several. Workflows are linked to the Objectives they serve, and Objective-scoped Values/Rules attach to it.",
		HowToAdd: "agency_create_objective (goal_id, title) — always created under an existing Goal.",
	},
	{
		Name:     "Role",
		WhatItIs: "A persona that can be given a part in a WorkItem via RACI (e.g. \"bug-hunter\", \"code-reviewer\"). Belongs to a Draft, freely editable there.",
		HowToAdd: "agency_create_role (name, optional description).",
	},
	{
		Name:     "RoleAssignment (RACI)",
		WhatItIs: "Gives one Role a part in one WorkItem with a RACI label — responsible, accountable, consulted, or informed. A WorkItem may have any number of Roles under any label; only the same Role with the same label on the same WorkItem twice is refused.",
		HowToAdd: "agency_set_raci (role_id, work_item_id, label).",
	},
	{
		Name:     "Value",
		WhatItIs: "A cultural/strategic statement made explicit for an AI agent acting as a Role to read directly (e.g. \"we prioritize correctness over speed\") — the kind of thing a human would just treat as common knowledge. Agency-wide, or scoped to one Objective; informational only, nothing enforces it at runtime.",
		HowToAdd: "agency_create_value (text, optional objective_id). No update or delete tool: Agency-wide Values have no edit path at all, and Objective-scoped ones are pending a write-authorization design.",
	},
	{
		Name:     "Rule",
		WhatItIs: "A constraint statement made explicit the same way as a Value (e.g. \"never touch production data\") — Agency-wide or Objective-scoped, informational only.",
		HowToAdd: "agency_create_rule (text, optional objective_id). Same no-update/no-delete reasoning as Value.",
	},
	{
		Name:     "Workflow",
		WhatItIs: "An ordered sequence of WorkItems belonging to the Agency, linked to the Objectives it serves (a Workflow may serve several). A Workflow with no Objective blocks publishing.",
		HowToAdd: "agency_create_workflow (name, optional description), then agency_link_workflow_objective (workflow_id, objective_id) for each Objective it serves.",
	},
	{
		Name:     "WorkItem",
		WhatItIs: "A single unit of work, owned by exactly one Workflow; Roles take part in it through RACI.",
		HowToAdd: "agency_create_work_item (workflow_id, title).",
	},
	{
		Name:     "EventFlowStep",
		WhatItIs: "The queryable, structured projection of one step in a Workflow's event-flow diagram: which topic/consumer triggers it, which handler runs it, what it emits on success or error.",
		HowToAdd: "Not directly creatable through chat — populated from a Workflow's EventFlows data. Look one up with agency_lookup_event_flow_step or agency_list_event_flow_steps.",
	},
	{
		Name:     "Draft",
		WhatItIs: "The unit of editing — every Goal/Workflow/WorkItem/Role/RoleAssignment/etc. row belongs to exactly one Draft, always. There is no separate \"live\" copy; publishing reads a Draft's rows directly.",
		HowToAdd: "agency_create_draft — though in this chat, one is already open and managed by the host; never call it yourself.",
	},
	{
		Name:     "AgencyPublication",
		WhatItIs: "A tagged, versioned copy of one Draft's Agency, and what production actually operates from — nothing running reads Draft rows directly. A publication serves a named channel (\"production\", \"staging\", …) or is archived; several may be live on different channels at once.",
		HowToAdd: "Not created directly — agency_publish_agency produces one from a chosen Draft. agency_set_publication_channel moves a channel between publications, which is how a release goes live and how a rollback is done.",
	},
	{
		Name:     "Issue",
		WhatItIs: "A system-detected problem found by scanning a Draft — e.g. a Workflow linked to an Objective that no longer exists, a Workflow serving no Objective, or a Goal with no Objectives. info/warning/error severity. An error-severity Issue blocks publishing that Draft.",
		HowToAdd: "Never created directly — agency_list_issues re-scans and regenerates the Issues every time it's called.",
	},
}

// registerCatalogTools registers the domain-type glossary tool. Needs no
// ManagerResolver — the catalog is static content describing the data
// model itself, not any one Agency's data — matching registerDashboardUI's
// same "no manager needed" precedent in dashboard_ui.go.
func registerCatalogTools(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{
		Name: "agency_list_types", Title: "List Domain Types",
		Description: "Look up what a domain type is and, if it has one, which tool creates it — Agency, Goal, Objective, Role, RACI, Value, Rule, Workflow, WorkItem, EventFlowStep, Draft, AgencyPublication, Issue. Use this to answer an operator's \"what is an Objective\" or \"how do I add a Role\" question rather than guessing. Omit name to list every type; name does a case-insensitive substring match.",
	}, mcpListTypes())
}

type mcpListTypesParams struct {
	Name string `json:"name,omitempty" jsonschema:"filter: case-insensitive substring match on the type's name, e.g. \"objective\"; omit to list every domain type"`
}

func mcpListTypes() func(context.Context, *mcp.CallToolRequest, mcpListTypesParams) (*mcp.CallToolResult, ListResult[typeInfo], error) {
	return func(_ context.Context, _ *mcp.CallToolRequest, p mcpListTypesParams) (*mcp.CallToolResult, ListResult[typeInfo], error) {
		items := domainTypeCatalog
		if p.Name != "" {
			items = nil
			for _, t := range domainTypeCatalog {
				if strings.Contains(strings.ToLower(t.Name), strings.ToLower(p.Name)) {
					items = append(items, t)
				}
			}
		}
		return summary("Found %d domain type(s)", len(items)), ListResult[typeInfo]{Items: items}, nil
	}
}
