package mwanachamaagency

import (
	"errors"

	"wakalaserver/modules/agency/models"
)

var (
	// ErrAgencyNotFound is returned when no Agency row exists.
	ErrAgencyNotFound = errors.New("mwanachamaagency: agency not found")
	ErrAgencyExists   = errors.New("mwanachamaagency: this instance already has its agency")
	// ErrGoalNotFound is returned when a Goal id has no match.
	ErrGoalNotFound = errors.New("mwanachamaagency: goal not found")
	// ErrWorkflowNotFound is returned when a Workflow id has no match.
	ErrWorkflowNotFound = errors.New("mwanachamaagency: workflow not found")
	// ErrWorkItemNotFound is returned when a WorkItem id has no match.
	ErrWorkItemNotFound = errors.New("mwanachamaagency: work item not found")
	// ErrDraftNotFound is returned when a Draft id has no match.
	ErrDraftNotFound = errors.New("mwanachamaagency: draft not found")
	// ErrDraftNotOpen is returned when an operation that requires an open
	// Draft (fork-from, edit, archive) is attempted on a Draft whose Status
	// is not "open".
	ErrDraftNotOpen = errors.New("mwanachamaagency: draft is not open")
	// ErrDraftRequired is returned by every Create<Type> when DraftID is
	// empty — AGD-006: every row belongs to a real Draft, there is no live
	// row-scope left to default into.
	ErrDraftRequired = errors.New("mwanachamaagency: a draft id is required")
	// ErrInvalidForkSource is returned by CreateDraft when forkedFromType
	// is none of "" (start empty), "draft", or "publication" (AGD-006
	// dropped "live" — there is no working-set row-scope left to fork
	// from).
	ErrInvalidForkSource = errors.New("mwanachamaagency: forkedFromType must be \"\", \"draft\", or \"publication\"")
	// ErrPublicationNotFound is returned when a publication version has no
	// match.
	ErrPublicationNotFound = errors.New("mwanachamaagency: publication not found")
	// ErrNoChangesDetected is returned by PublishAgency when the current
	// live content hash matches an existing publication's.
	ErrNoChangesDetected = errors.New("mwanachamaagency: no changes detected since last publication")
	// ErrEventFlowStepNotFound is returned when LookupFlowStep finds no
	// matching live EventFlowStep.
	ErrEventFlowStepNotFound = errors.New("mwanachamaagency: event flow step not found")
	ErrAmbiguousLookup       = errors.New("mwanachamaagency: event flow step lookup matches more than one step")
	// ErrInvalidLookup is returned by LookupFlowStep when no lookup key is
	// set (or TriggerTopic is set without Consumer).
	ErrInvalidLookup = errors.New("mwanachamaagency: invalid event flow step lookup")
	// ErrInvalidRole is returned by CreateRole/UpdateRole when Name is empty.
	ErrInvalidRole = errors.New("mwanachamaagency: invalid role")
	// ErrRoleNotFound is returned when a Role id has no match in the
	// expected scope.
	ErrRoleNotFound = errors.New("mwanachamaagency: role not found")
	// ErrRoleAssignmentNotFound is returned when a RoleAssignment id has no
	// match.
	ErrRoleAssignmentNotFound = errors.New("mwanachamaagency: role assignment not found")
	// ErrInvalidRACILabel is returned by CreateRoleAssignment/
	// UpdateRoleAssignment when Label is not one of the four RACI values.
	ErrInvalidRACILabel = errors.New("mwanachamaagency: invalid RACI label")
	// ErrDuplicateRoleAssignment is returned by CreateRoleAssignment/
	// UpdateRoleAssignment when the same role already holds the same label
	// on the same step.
	ErrDuplicateRoleAssignment = errors.New("mwanachamaagency: role already holds this label on the step")
	// ErrWorkflowObjectiveNotFound is returned when a WorkflowObjective id
	// has no match.
	ErrWorkflowObjectiveNotFound = errors.New("mwanachamaagency: workflow objective not found")
	// ErrDuplicateWorkflowObjective is returned by CreateWorkflowObjective
	// when the workflow already delivers the objective.
	ErrDuplicateWorkflowObjective = errors.New("mwanachamaagency: workflow already delivers this objective")
	// ErrObjectiveNotFound is returned when an Objective id has no match
	// in the expected scope.
	ErrObjectiveNotFound   = errors.New("mwanachamaagency: objective not found")
	ErrRiskNotFound        = errors.New("mwanachamaagency: risk not found")
	ErrRiskPathwayNotFound = errors.New("mwanachamaagency: risk pathway not found")
	ErrInvalidRisk         = errors.New("mwanachamaagency: invalid risk")
	ErrInvalidRiskPathway  = errors.New("mwanachamaagency: invalid risk pathway")
	// ErrInvalidWorkItem is returned by CreateWorkItem/UpdateWorkItem for a
	// step that fails validation.
	ErrInvalidWorkItem = errors.New("mwanachamaagency: invalid work item")
	ErrInvalidWorkflow = errors.New("mwanachamaagency: invalid workflow")
	// ErrInvalidValue is returned by CreateValue/UpdateValue when Text is
	// empty.
	ErrInvalidValue = errors.New("mwanachamaagency: invalid value")
	// ErrValueNotFound is returned when a Value id has no match.
	ErrValueNotFound = errors.New("mwanachamaagency: value not found")
	// ErrInvalidRule is returned by CreateRule/UpdateRule when Text is
	// empty.
	ErrInvalidRule                = errors.New("mwanachamaagency: invalid rule")
	ErrInvalidControl             = errors.New("mwanachamaagency: invalid control")
	ErrControlNotFound            = errors.New("mwanachamaagency: control not found")
	ErrControlAttachmentNotFound  = errors.New("mwanachamaagency: control attachment not found")
	ErrDuplicateControlAttachment = errors.New("mwanachamaagency: control attachment already exists")
	// ErrRuleNotFound is returned when a Rule id has no match.
	ErrRuleNotFound = errors.New("mwanachamaagency: rule not found")
	// ErrCannotEditLive is returned by UpdateValue/DeleteValue/
	// UpdateRule/DeleteRule when the target row carries no attachment
	// (see [hasAnyAttachment]) — an Agency-wide Value/Rule is never forked
	// into another Draft, so this is permanent, not just "until archived".
	ErrCannotEditLive = errors.New("mwanachamaagency: agency-wide data cannot be edited directly")
	// ErrInvalidTargetType is returned by CreateValueAttachment/
	// CreateRuleAttachment when TargetType is not one of the five known
	// values (see [models.TargetType.Valid]).
	ErrInvalidTargetType = errors.New("mwanachamaagency: invalid target type")
	// ErrDuplicateAttachment is returned by CreateValueAttachment/
	// CreateRuleAttachment when the same (Value/Rule, TargetType,
	// TargetID) attachment already exists.
	ErrDuplicateAttachment = errors.New("mwanachamaagency: attachment already exists")
	// ErrValueAttachmentNotFound is returned when a ValueAttachment id has
	// no match.
	ErrValueAttachmentNotFound = errors.New("mwanachamaagency: value attachment not found")
	// ErrRuleAttachmentNotFound is returned when a RuleAttachment id has
	// no match.
	ErrRuleAttachmentNotFound = errors.New("mwanachamaagency: rule attachment not found")
	// ErrPublishValidationFailed is returned by PublishAgency when the
	// scan of the Draft being published found at least one error-severity
	// Issue. Its message names them; ListIssues(ctx, draftID,
	// IssueFilter{Severity: "error"}) reads the same findings back as
	// structured rows.
	ErrPublishValidationFailed = errors.New("mwanachamaagency: agency has validation errors and cannot be published")
	// ErrDuplicateTag is returned by PublishAgency when another
	// publication already carries the requested tag.
	ErrDuplicateTag = errors.New("mwanachamaagency: publication tag already exists")
	// ErrInvalidModule is returned by CreateModule when Code is empty.
	ErrInvalidModule = errors.New("mwanachamaagency: invalid module")
	// ErrDuplicateModule is returned by CreateModule when a Module with
	// the same Code already exists in the same scope.
	ErrDuplicateModule = errors.New("mwanachamaagency: module code already exists")
	// ErrModuleNotFound is returned when a Module id has no match in the
	// expected scope.
	ErrModuleNotFound = errors.New("mwanachamaagency: module not found")

	ErrInvalidModuleSettings = errors.New("mwanachamaagency: module settings must be a JSON object")
	ErrInvalidModuleMounts   = models.ErrInvalidMounts
	ErrModuleLocked          = errors.New("mwanachamaagency: a locked module cannot be switched off")

	ErrInvalidMeasure   = errors.New("mwanachamaagency: invalid measure")
	ErrInvalidRecord    = errors.New("mwanachamaagency: invalid record")
	ErrRecordNotFound   = errors.New("mwanachamaagency: record not found")
	ErrInvalidRecordRow = errors.New("mwanachamaagency: invalid record row")
	ErrRecordRowRefused = errors.New("mwanachamaagency: this role does not add rows to the record")

	ErrDuplicateRecordRow = errors.New("mwanachamaagency: the same answers were saved a moment ago")
)

var (
	ErrScenarioNotFound       = errors.New("mwanachamaagency: scenario not found")
	ErrInvalidScenario        = errors.New("mwanachamaagency: invalid scenario")
	ErrScenarioActorNotFound  = errors.New("mwanachamaagency: scenario actor not found")
	ErrDuplicateScenarioActor = errors.New("mwanachamaagency: scenario actor name already used")
	ErrScenarioRunning        = errors.New("mwanachamaagency: scenario is already running")
	ErrTestRunNotFound        = errors.New("mwanachamaagency: test run not found")
	ErrTestRunFinished        = errors.New("mwanachamaagency: test run has already finished")
	ErrUsedByScenario         = errors.New("mwanachamaagency: used by a scenario")
)

var (
	ErrReviewRunning      = errors.New("A review of this draft is already running.")
	ErrNoReviewAreas      = errors.New("There is no part of this draft to review.")
	ErrReviewNotFound     = errors.New("mwanachamaagency: review not found")
	ErrReviewAreaNotFound = errors.New("mwanachamaagency: review part not found")
	ErrReviewAreaRecorded = errors.New("mwanachamaagency: this part of the review has already been recorded")
	ErrFindingNotFound    = errors.New("mwanachamaagency: review finding not found")
	ErrInvalidReview      = errors.New("mwanachamaagency: invalid review")
)

var (
	ErrHazardNotFound           = errors.New("mwanachamaagency: hazard not found")
	ErrThreatNotFound           = errors.New("mwanachamaagency: threat not found")
	ErrConsequenceNotFound      = errors.New("mwanachamaagency: consequence not found")
	ErrRiskThreatNotFound       = errors.New("mwanachamaagency: risk threat not found")
	ErrRiskConsequenceNotFound  = errors.New("mwanachamaagency: risk consequence not found")
	ErrInvalidHazard            = errors.New("mwanachamaagency: invalid hazard")
	ErrInvalidThreat            = errors.New("mwanachamaagency: invalid threat")
	ErrInvalidConsequence       = errors.New("mwanachamaagency: invalid consequence")
	ErrLibraryPartInUse         = errors.New("mwanachamaagency: a risk still uses this part")
	ErrDuplicateRiskThreat      = errors.New("mwanachamaagency: risk already uses this threat")
	ErrDuplicateRiskConsequence = errors.New("mwanachamaagency: risk already uses this consequence")
	ErrConsequenceOutsideHazard = errors.New("mwanachamaagency: a risk links only consequences of its own hazard")
	ErrLibraryTitleTaken        = errors.New("mwanachamaagency: a part of this kind already has this title")
)

var ErrConflict = errors.New("mwanachamaagency: another write got there first, try again")
