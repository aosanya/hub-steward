package mwanachamaagency

import (
	"context"
	"encoding/json"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/identity"
	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/agency/models"
)

// AgencyManager is the behavior surface this package exposes: CRUD for
// Agency/Goal/Workflow/WorkItem/EventFlowStep data (every one of which
// always belongs to some Draft — AGD-006, there is no live row-scope), the
// Draft edit lifecycle, and publication.
type AgencyManager interface {
	identity.Owner

	// Agency. UpdateAgency only ever touches Name/Description —
	// Mission/Vision were removed 2026-09-10 (AGD-001); Description was
	// added back 2026-09-11 at the user's explicit request. Nothing else
	// has asked to edit Enabled/DefaultFailurePipelineBudget/
	// InactivityTimeoutSeconds/EventFlows yet. Agency itself is a
	// singleton with no DraftID — always directly editable.
	CreateAgency(ctx context.Context, a models.Agency) (models.Agency, error)
	GetAgency(ctx context.Context) (models.Agency, error)
	UpdateAgency(ctx context.Context, a models.Agency) (models.Agency, error)

	// Goal. List's draftID selects which Draft's copies to return.
	CreateGoal(ctx context.Context, g models.Goal) (models.Goal, error)
	GetGoal(ctx context.Context, id string) (models.Goal, error)
	ListGoals(ctx context.Context, draftID string, filter GoalFilter) ([]models.Goal, error)
	UpdateGoal(ctx context.Context, g models.Goal) (models.Goal, error)
	// DeleteGoal cascades: every Objective scoped to it, and every
	// RoleAssignment and WorkItem scoped to each of those Objectives, is
	// deleted too.
	DeleteGoal(ctx context.Context, id string) error

	// Objective. A Goal may have several — each one a granular unit that
	// workflows serve through WorkflowObjective. Same Draft-scoping/list
	// convention as Goal.
	CreateObjective(ctx context.Context, o models.Objective) (models.Objective, error)
	GetObjective(ctx context.Context, id string) (models.Objective, error)
	ListObjectives(ctx context.Context, draftID string, filter ObjectiveFilter) ([]models.Objective, error)
	UpdateObjective(ctx context.Context, o models.Objective) (models.Objective, error)
	DeleteObjective(ctx context.Context, id string) error

	// Workflow
	CreateWorkflow(ctx context.Context, w models.Workflow) (models.Workflow, error)
	GetWorkflow(ctx context.Context, id string) (models.Workflow, error)
	ListWorkflows(ctx context.Context, draftID string, filter WorkflowFilter) ([]models.Workflow, error)
	ListDefaultWorkflows(ctx context.Context) ([]models.Workflow, error)
	UpdateWorkflow(ctx context.Context, w models.Workflow) (models.Workflow, error)
	// DeleteWorkflow cascades: every WorkItem owned by it is deleted too —
	// same reasoning as DeleteGoal's cascade above (see its doc comment).
	// A deleted Workflow also removes its WorkflowObjective rows, and a
	// deleted step removes its RoleAssignment rows, in the same transaction.
	DeleteWorkflow(ctx context.Context, id string) error

	CreateRisk(ctx context.Context, r models.Risk) (models.Risk, error)
	GetRisk(ctx context.Context, id string) (models.Risk, error)
	ListRisks(ctx context.Context, draftID string, filter RiskFilter) ([]models.Risk, error)
	UpdateRisk(ctx context.Context, r models.Risk) (models.Risk, error)
	DeleteRisk(ctx context.Context, id string) error

	CreateRiskPathway(ctx context.Context, p models.RiskPathway) (models.RiskPathway, error)
	GetRiskPathway(ctx context.Context, id string) (models.RiskPathway, error)
	ListRiskPathways(ctx context.Context, draftID string, filter RiskPathwayFilter) ([]models.RiskPathway, error)
	UpdateRiskPathway(ctx context.Context, p models.RiskPathway) (models.RiskPathway, error)
	DeleteRiskPathway(ctx context.Context, id string) error

	SetMeasure(ctx context.Context, m models.Measure) (models.Measure, error)
	ListMeasures(ctx context.Context, draftID string, filter MeasureFilter) ([]models.Measure, error)

	CreateRecord(ctx context.Context, r models.Record) (models.Record, error)
	GetRecord(ctx context.Context, id string) (models.Record, error)
	ListRecords(ctx context.Context, draftID string, filter RecordFilter) ([]models.Record, error)
	UpdateRecord(ctx context.Context, r models.Record) (models.Record, error)
	DeleteRecord(ctx context.Context, id string) error

	CreateRecordRow(ctx context.Context, row models.RecordRow) (models.RecordRow, error)
	ListRecordRows(ctx context.Context, draftID string, filter RecordRowFilter) ([]models.RecordRow, error)

	// WorkItem. A step takes its Objectives from its Workflow (AGD-009).
	CreateWorkItem(ctx context.Context, wi models.WorkItem) (models.WorkItem, error)
	GetWorkItem(ctx context.Context, id string) (models.WorkItem, error)
	ListWorkItems(ctx context.Context, draftID string, filter WorkItemFilter) ([]models.WorkItem, error)
	UpdateWorkItem(ctx context.Context, wi models.WorkItem) (models.WorkItem, error)
	// DeleteWorkItem carries no RACI of its own (RoleAssignment is
	// Objective-scoped, AG12), so there is nothing to cascade into.
	DeleteWorkItem(ctx context.Context, id string) error

	// Draft lifecycle. Every business-entity row belongs to some Draft —
	// there is no live row-scope (AGD-006). CreateDraft forks into new
	// rows scoped to the new Draft. forkedFromType selects the source:
	// "" starts an empty Draft (forkedFromID ignored — what a brand-new
	// Instance or a from-scratch seed like SeedSWELab uses); "draft"
	// forks another open Draft (forkedFromID is its ID); "publication"
	// forks a published tag — forkedFromID is then the Tag, and the
	// publication's document is materialized into the Draft rather than
	// rows being copied ([ErrPublicationNotFound] if no publication
	// carries that tag; that's what "go back to what release-1 was and
	// change one thing" needs). Anything else returns
	// [ErrInvalidForkSource]. ArchiveDraft discards a Draft; it is the
	// only terminal transition (there is no "promote" — see
	// PublishAgency). Returns [ErrDraftNotOpen] where noted.
	CreateDraft(ctx context.Context, description, forkedFromID, forkedFromType string) (models.Draft, error)
	GetDraft(ctx context.Context, id string) (models.Draft, error)
	ListDrafts(ctx context.Context, filter DraftFilter) ([]models.Draft, error)
	// UpdateDraftDescription returns [ErrDraftNotOpen] if the draft isn't open.
	UpdateDraftDescription(ctx context.Context, id, description string) (models.Draft, error)
	// ArchiveDraft returns [ErrDraftNotOpen] if the draft isn't open.
	ArchiveDraft(ctx context.Context, id string) (models.Draft, error)

	// Publication. A publication carries the whole Agency as a
	// [models.AgencyDocument], and production operates from that rather
	// than from any Draft's rows directly (AGD-005).
	//
	// PublishAgency freezes draftID's own rows into a new publication —
	// no merge step, no promotion; it reads that Draft directly
	// ([ErrDraftNotFound] if it doesn't exist; it need not be open —
	// publishing an archived Draft is allowed, and publishing never
	// changes the Draft's own status, AGD-006). tag names the publication
	// and must be unused ([ErrDuplicateTag]); "" falls back to
	// "v<version>". channel is the live channel it serves; "" means
	// [models.DefaultChannel], and whichever publication held that
	// channel is archived — publications on other channels keep serving
	// them. The scan runs first, against draftID: any error-severity
	// Issue refuses the publish with [ErrPublishValidationFailed].
	// Returns [ErrNoChangesDetected] if the content hash matches an
	// existing publication.
	PublishAgency(ctx context.Context, draftID, tag, channel string) (models.AgencyPublication, error)
	GetPublication(ctx context.Context, version int) (models.AgencyPublication, error)
	// GetPublicationForChannel is the production read: whichever
	// publication currently serves channel ("" means
	// [models.DefaultChannel]). [ErrPublicationNotFound] if none does.
	GetPublicationForChannel(ctx context.Context, channel string) (models.AgencyPublication, error)
	ChangedEnforcedControls(ctx context.Context, draftID string) ([]models.Control, error)
	ListPublications(ctx context.Context, filter PublicationFilter) ([]models.AgencyPublication, error)
	// SetPublicationChannel moves a channel onto version, taking it off
	// whichever publication held it; [models.ChannelArchived] archives
	// version instead. Re-channelling an archived publication is the
	// rollback path, so both directions are allowed.
	SetPublicationChannel(ctx context.Context, version int, channel string) (models.AgencyPublication, error)

	// EventFlowStep. Every step belongs to some Draft, same as
	// Goal/Workflow/WorkItem (AGD-006).
	CreateEventFlowStep(ctx context.Context, s models.EventFlowStep) (models.EventFlowStep, error)
	// LookupFlowStep tries lookup.HandlerCode, then
	// (lookup.TriggerTopic, lookup.Consumer) together, then lookup.Code, in
	// that order, scoped to draftID. Returns [ErrInvalidLookup] if none are
	// set.
	LookupFlowStep(ctx context.Context, draftID string, lookup models.EventFlowStepLookup) (models.EventFlowStep, error)
	// ListEventFlowSteps returns draftID's steps ordered by (WorkflowCode,
	// Ordinality, Step), optionally filtered to one workflowCode.
	ListEventFlowSteps(ctx context.Context, draftID, workflowCode string, filter EventFlowStepFilter) ([]models.EventFlowStep, error)

	// Role. Every Role belongs to some Draft and is freely editable there
	// (AGD-006). List's draftID selects scope, same as Goal/Workflow/
	// WorkItem.
	CreateRole(ctx context.Context, r models.Role) (models.Role, error)
	GetRole(ctx context.Context, id string) (models.Role, error)
	GetRoleBrief(ctx context.Context, roleID string) (models.RoleBrief, error)
	ListRoles(ctx context.Context, draftID string, filter RoleFilter) ([]models.Role, error)
	// DeleteRole cascades into every RoleAssignment naming the Role, the
	// mirror of DeleteObjective's cascade from the other side of the same
	// join table.
	UpdateRole(ctx context.Context, r models.Role) (models.Role, error)
	DeleteRole(ctx context.Context, id string) error

	CreateWorkflowObjective(ctx context.Context, l models.WorkflowObjective) (models.WorkflowObjective, error)
	GetWorkflowObjective(ctx context.Context, id string) (models.WorkflowObjective, error)
	ListWorkflowObjectives(ctx context.Context, draftID string, filter WorkflowObjectiveFilter) ([]models.WorkflowObjective, error)
	DeleteWorkflowObjective(ctx context.Context, id string) error

	CreateRoleAssignment(ctx context.Context, a models.RoleAssignment) (models.RoleAssignment, error)
	GetRoleAssignment(ctx context.Context, id string) (models.RoleAssignment, error)
	ListRoleAssignments(ctx context.Context, draftID string, filter RoleAssignmentFilter) ([]models.RoleAssignment, error)
	ListRoleAssignmentsForWorkItem(ctx context.Context, workItemID, draftID string, filter RoleAssignmentFilter) ([]models.RoleAssignment, error)
	UpdateRoleAssignment(ctx context.Context, a models.RoleAssignment) (models.RoleAssignment, error)
	DeleteRoleAssignment(ctx context.Context, id string) error

	CreateModule(ctx context.Context, mod models.Module) (models.Module, error)
	GetModule(ctx context.Context, id string) (models.Module, error)
	ListModules(ctx context.Context, draftID string, filter ModuleFilter) ([]models.Module, error)
	ListPermissions(ctx context.Context) ([]models.Permission, error)
	ListPickers(ctx context.Context, draftID string) (models.Pickers, error)
	SetModuleSettings(ctx context.Context, id string, settings json.RawMessage) (models.Module, error)
	SetModuleMounts(ctx context.Context, id string, mounts []models.ModuleMount) (models.Module, error)
	SetModuleEnabled(ctx context.Context, draftID, id string, enabled bool) (models.Module, error)

	// Value/Rule. Plain-text statements an AI agent acting as a Role
	// needs made explicit (see models.Value/models.Rule's doc comments).
	// A Value/Rule with no [ValueAttachment]/[RuleAttachment] is
	// Agency-wide: meant to be set once (at Agency creation/seed time)
	// and never edited — nothing here stops a caller from trying, but
	// [CreateDraft] never forks one with zero attachments, so
	// UpdateValue/DeleteValue's [ErrCannotEditLive] check
	// ([hasAnyAttachment]) makes it permanent in practice. One with at
	// least one attachment is freely Text-editable within whichever Draft
	// it belongs to — attaching/detaching a target (AGD-003, 2026-09-15)
	// is its own always-editable operation, never gated by Draft scope at
	// all. The write-authorization rule from AGD-001 (only a target's
	// Accountable may write) is NOT enforced here — flagged as new
	// machinery needing its own design.
	CreateValue(ctx context.Context, v models.Value) (models.Value, error)
	GetValue(ctx context.Context, id string) (models.Value, error)
	// ListValues' filter can narrow to "attached to this
	// Role/Goal/Objective/Workflow/WorkItem" via ValueFilter's target-id
	// fields, alongside its existing Code/Text substring match.
	ListValues(ctx context.Context, draftID string, filter ValueFilter) ([]models.Value, error)
	// UpdateValue/DeleteValue return [ErrCannotEditLive] if the target row
	// is live.
	UpdateValue(ctx context.Context, v models.Value) (models.Value, error)
	DeleteValue(ctx context.Context, id string) error
	// CreateValueAttachment attaches valueID to one target. Returns
	// [ErrInvalidTargetType] for an unrecognized targetType, that target
	// type's own NotFound sentinel (e.g. [ErrRoleNotFound]) if targetID
	// names no row, or [ErrDuplicateAttachment] if already attached.
	CreateValueAttachment(ctx context.Context, valueID string, targetType models.TargetType, targetID string) (models.ValueAttachment, error)
	// ListValueAttachments lists every target valueID is attached to.
	ListValueAttachments(ctx context.Context, valueID string) ([]models.ValueAttachment, error)
	// DeleteValueAttachment returns [ErrValueAttachmentNotFound] if id
	// names no attachment.
	DeleteValueAttachment(ctx context.Context, id string) error

	CreateRule(ctx context.Context, r models.Rule) (models.Rule, error)
	GetRule(ctx context.Context, id string) (models.Rule, error)
	// ListRules' filter can narrow the same way ListValues' does.
	ListRules(ctx context.Context, draftID string, filter RuleFilter) ([]models.Rule, error)
	// UpdateRule/DeleteRule return [ErrCannotEditLive] if the target row
	// is live.
	UpdateRule(ctx context.Context, r models.Rule) (models.Rule, error)
	DeleteRule(ctx context.Context, id string) error
	// CreateRuleAttachment/ListRuleAttachments/DeleteRuleAttachment work
	// exactly like their Value counterparts above.
	CreateRuleAttachment(ctx context.Context, ruleID string, targetType models.TargetType, targetID string) (models.RuleAttachment, error)
	ListRuleAttachments(ctx context.Context, ruleID string) ([]models.RuleAttachment, error)
	DeleteRuleAttachment(ctx context.Context, id string) error
	CreateHazard(ctx context.Context, p models.Hazard) (models.Hazard, error)
	GetHazard(ctx context.Context, id string) (models.Hazard, error)
	ListHazards(ctx context.Context, draftID string, filter LibraryPartFilter) ([]models.Hazard, error)
	UpdateHazard(ctx context.Context, p models.Hazard) (models.Hazard, error)
	DeleteHazard(ctx context.Context, id string) error
	CreateThreat(ctx context.Context, p models.Threat) (models.Threat, error)
	GetThreat(ctx context.Context, id string) (models.Threat, error)
	ListThreats(ctx context.Context, draftID string, filter LibraryPartFilter) ([]models.Threat, error)
	UpdateThreat(ctx context.Context, p models.Threat) (models.Threat, error)
	DeleteThreat(ctx context.Context, id string) error
	CreateConsequence(ctx context.Context, p models.Consequence) (models.Consequence, error)
	GetConsequence(ctx context.Context, id string) (models.Consequence, error)
	ListConsequences(ctx context.Context, draftID string, filter ConsequenceFilter) ([]models.Consequence, error)
	UpdateConsequence(ctx context.Context, p models.Consequence) (models.Consequence, error)
	DeleteConsequence(ctx context.Context, id string) error
	CreateRiskThreat(ctx context.Context, l models.RiskThreat) (models.RiskThreat, error)
	ListRiskThreats(ctx context.Context, draftID string, filter RiskThreatFilter) ([]models.RiskThreat, error)
	DeleteRiskThreat(ctx context.Context, id string) error
	CreateRiskConsequence(ctx context.Context, l models.RiskConsequence) (models.RiskConsequence, error)
	ListRiskConsequences(ctx context.Context, draftID string, filter RiskConsequenceFilter) ([]models.RiskConsequence, error)
	DeleteRiskConsequence(ctx context.Context, id string) error
	ListUnguardedParts(ctx context.Context, draftID string) ([]UnguardedPart, error)
	CreateControl(ctx context.Context, c models.Control) (models.Control, error)
	GetControl(ctx context.Context, id string) (models.Control, error)
	ListControls(ctx context.Context, draftID string, filter ControlFilter) ([]models.Control, error)
	UpdateControl(ctx context.Context, c models.Control) (models.Control, error)
	DeleteControl(ctx context.Context, id string) error
	CreateControlAttachment(ctx context.Context, controlID string, targetType models.TargetType, targetID string) (models.ControlAttachment, error)
	ListControlAttachments(ctx context.Context, controlID string) ([]models.ControlAttachment, error)
	DeleteControlAttachment(ctx context.Context, id string) error
	UnguardedPathways(ctx context.Context, draftID string) ([]models.RiskPathway, error)

	// Issue. A system-detected diagnostics list (info/warning/error) — a
	// dangling reference, a Workflow with no Objective, a Goal with
	// no Objectives. draftID selects which Draft to scan, like every
	// other scoped read. ListIssues re-scans on every call: it deletes
	// that scope's existing
	// Issue rows, re-runs every check against its current data,
	// re-inserts, then returns the (possibly filtered) result — so there
	// is no Create/Update/Delete surface; nothing here is ever authored
	// directly. An error-severity Issue is what PublishAgency refuses on.
	ListIssues(ctx context.Context, draftID string, filter IssueFilter) ([]models.Issue, error)

	// ImportDocument writes a whole agency document into a draft of its
	// own — a mined template, or an export from elsewhere.
	ImportDocument(ctx context.Context, description string, doc models.AgencyDocument) (ImportResult, error)

	CreateScenario(ctx context.Context, s models.Scenario) (models.Scenario, error)
	GetScenario(ctx context.Context, id string) (models.Scenario, error)
	ListScenarios(ctx context.Context, draftID string, filter ScenarioFilter) ([]models.Scenario, error)
	UpdateScenario(ctx context.Context, s models.Scenario) (models.Scenario, error)
	DeleteScenario(ctx context.Context, id string) error
	AddScenarioActor(ctx context.Context, a models.ScenarioActor) (models.ScenarioActor, error)
	RenameScenarioActor(ctx context.Context, id, name string) (models.ScenarioActor, error)
	RemoveScenarioActor(ctx context.Context, id string) error
	SetScenarioInput(ctx context.Context, in models.ScenarioInput) (models.ScenarioInput, error)
	RunScenario(ctx context.Context, id string) (models.TestRun, error)
	RunScenarios(ctx context.Context, draftID string, scenarioIDs []string) ([]models.TestRun, error)
	GetTestRun(ctx context.Context, id string) (models.TestRun, error)
	ListTestRuns(ctx context.Context, scenarioID string) ([]models.TestRun, error)
	StopRun(ctx context.Context, runID string) (models.TestRun, error)
	ResumeRuns(ctx context.Context) ([]models.TestRun, error)
	AwaitRun(ctx context.Context, runID string) (models.TestRun, error)

	StartReview(ctx context.Context, draftID, startedBy, area string) (models.ReviewView, error)
	GetReview(ctx context.Context, reviewID, draftID string) (models.ReviewView, error)
	ListReviews(ctx context.Context, draftID string) ([]models.Review, error)
	ListRunningReviews(ctx context.Context, draftID string) ([]models.Review, error)
	SetFindingStatus(ctx context.Context, findingID string, status models.FindingStatus) (models.FindingView, error)
	CommentFinding(ctx context.Context, findingID, body, author string) (models.ReviewComment, error)
	ReviewInput(ctx context.Context, reviewID string, area models.ReviewAreaName) (models.ReviewInput, error)
	RecordReviewArea(ctx context.Context, reviewID string, area models.ReviewAreaName, status models.ReviewAreaStatus, summary, failureReason string, tokens int, findings []models.ReviewFindingInput) (models.ReviewAreaView, models.ReviewStatus, error)
}

type agencyManager struct {
	db         *gorm.DB
	st         *specstore.Store
	tables     TableNames
	settings   SettingsChecker
	runner     ScenarioRunner
	atOnce     func(ctx context.Context) int
	tokenLimit func(ctx context.Context) int
	board      *runBoard
	groups     GroupLister
	runs       RunLister

	reviewAreas ReviewAreasFunc
}

func NewAgencyManager(db *gorm.DB, s *spec.Spec, opts ...Option) (AgencyManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewAgencyManager: db must not be nil")
	}
	if s == nil {
		return nil, fmt.Errorf("NewAgencyManager: spec must not be nil")
	}
	st, err := newStore(db, s)
	if err != nil {
		return nil, fmt.Errorf("NewAgencyManager: %w", err)
	}
	m := &agencyManager{db: db, st: st, tables: TablesFor(s), board: newRunBoard()}
	for _, opt := range opts {
		opt(m)
	}
	return m, nil
}

func ManagerShape() AgencyManager { return (*agencyManager)(nil) }
