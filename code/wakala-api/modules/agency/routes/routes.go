package routes

import (
	"fmt"
	"sort"
	"sync"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	mwanachamaagency "wakalaserver/modules/agency"
)

type Route = httpwire.Route

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(mwanachamaagency.Operations())
})

var sentinels = map[string]error{
	"ErrAgencyNotFound":             mwanachamaagency.ErrAgencyNotFound,
	"ErrAgencyExists":               mwanachamaagency.ErrAgencyExists,
	"ErrAmbiguousLookup":            mwanachamaagency.ErrAmbiguousLookup,
	"ErrCannotEditLive":             mwanachamaagency.ErrCannotEditLive,
	"ErrConflict":                   mwanachamaagency.ErrConflict,
	"ErrDraftNotFound":              mwanachamaagency.ErrDraftNotFound,
	"ErrDraftNotOpen":               mwanachamaagency.ErrDraftNotOpen,
	"ErrDraftRequired":              mwanachamaagency.ErrDraftRequired,
	"ErrDuplicateRoleAssignment":    mwanachamaagency.ErrDuplicateRoleAssignment,
	"ErrDuplicateWorkflowObjective": mwanachamaagency.ErrDuplicateWorkflowObjective,
	"ErrDuplicateAttachment":        mwanachamaagency.ErrDuplicateAttachment,
	"ErrDuplicateModule":            mwanachamaagency.ErrDuplicateModule,
	"ErrDuplicateTag":               mwanachamaagency.ErrDuplicateTag,
	"ErrEventFlowStepNotFound":      mwanachamaagency.ErrEventFlowStepNotFound,
	"ErrGoalNotFound":               mwanachamaagency.ErrGoalNotFound,
	"ErrInvalidForkSource":          mwanachamaagency.ErrInvalidForkSource,
	"ErrLimitExceeded":              mwanachamaagency.ErrLimitExceeded,
	"ErrInvalidLookup":              mwanachamaagency.ErrInvalidLookup,
	"ErrInvalidModule":              mwanachamaagency.ErrInvalidModule,
	"ErrInvalidRACILabel":           mwanachamaagency.ErrInvalidRACILabel,
	"ErrInvalidRole":                mwanachamaagency.ErrInvalidRole,
	"ErrInvalidRule":                mwanachamaagency.ErrInvalidRule,
	"ErrInvalidTargetType":          mwanachamaagency.ErrInvalidTargetType,
	"ErrInvalidValue":               mwanachamaagency.ErrInvalidValue,
	"ErrInvalidWorkItem":            mwanachamaagency.ErrInvalidWorkItem,
	"ErrInvalidWorkflow":            mwanachamaagency.ErrInvalidWorkflow,
	"ErrModuleNotFound":             mwanachamaagency.ErrModuleNotFound,
	"ErrModuleLocked":               mwanachamaagency.ErrModuleLocked,
	"ErrNoChangesDetected":          mwanachamaagency.ErrNoChangesDetected,
	"ErrObjectiveNotFound":          mwanachamaagency.ErrObjectiveNotFound,
	"ErrPublicationNotFound":        mwanachamaagency.ErrPublicationNotFound,
	"ErrPublishValidationFailed":    mwanachamaagency.ErrPublishValidationFailed,
	"ErrRoleAssignmentNotFound":     mwanachamaagency.ErrRoleAssignmentNotFound,
	"ErrRoleNotFound":               mwanachamaagency.ErrRoleNotFound,
	"ErrRuleAttachmentNotFound":     mwanachamaagency.ErrRuleAttachmentNotFound,
	"ErrRuleNotFound":               mwanachamaagency.ErrRuleNotFound,
	"ErrValueAttachmentNotFound":    mwanachamaagency.ErrValueAttachmentNotFound,
	"ErrValueNotFound":              mwanachamaagency.ErrValueNotFound,
	"ErrWorkItemNotFound":           mwanachamaagency.ErrWorkItemNotFound,
	"ErrWorkflowNotFound":           mwanachamaagency.ErrWorkflowNotFound,
	"ErrWorkflowObjectiveNotFound":  mwanachamaagency.ErrWorkflowObjectiveNotFound,
	"ErrInvalidMeasure":             mwanachamaagency.ErrInvalidMeasure,
	"ErrRiskNotFound":               mwanachamaagency.ErrRiskNotFound,
	"ErrRiskPathwayNotFound":        mwanachamaagency.ErrRiskPathwayNotFound,
	"ErrInvalidControl":             mwanachamaagency.ErrInvalidControl,
	"ErrControlNotFound":            mwanachamaagency.ErrControlNotFound,
	"ErrControlAttachmentNotFound":  mwanachamaagency.ErrControlAttachmentNotFound,
	"ErrDuplicateControlAttachment": mwanachamaagency.ErrDuplicateControlAttachment,
	"ErrInvalidRisk":                mwanachamaagency.ErrInvalidRisk,
	"ErrInvalidRiskPathway":         mwanachamaagency.ErrInvalidRiskPathway,
	"ErrInvalidRecord":              mwanachamaagency.ErrInvalidRecord,
	"ErrInvalidRecordRow":           mwanachamaagency.ErrInvalidRecordRow,
	"ErrRecordNotFound":             mwanachamaagency.ErrRecordNotFound,
	"ErrRecordRowRefused":           mwanachamaagency.ErrRecordRowRefused,
	"ErrDuplicateRecordRow":         mwanachamaagency.ErrDuplicateRecordRow,
	"ErrInvalidModuleMounts":        mwanachamaagency.ErrInvalidModuleMounts,
	"ErrScenarioNotFound":           mwanachamaagency.ErrScenarioNotFound,
	"ErrInvalidScenario":            mwanachamaagency.ErrInvalidScenario,
	"ErrScenarioActorNotFound":      mwanachamaagency.ErrScenarioActorNotFound,
	"ErrDuplicateScenarioActor":     mwanachamaagency.ErrDuplicateScenarioActor,
	"ErrScenarioRunning":            mwanachamaagency.ErrScenarioRunning,
	"ErrTestRunNotFound":            mwanachamaagency.ErrTestRunNotFound,
	"ErrTestRunFinished":            mwanachamaagency.ErrTestRunFinished,
	"ErrReviewRunning":              mwanachamaagency.ErrReviewRunning,
	"ErrNoReviewAreas":              mwanachamaagency.ErrNoReviewAreas,
	"ErrReviewNotFound":             mwanachamaagency.ErrReviewNotFound,
	"ErrReviewAreaNotFound":         mwanachamaagency.ErrReviewAreaNotFound,
	"ErrReviewAreaRecorded":         mwanachamaagency.ErrReviewAreaRecorded,
	"ErrFindingNotFound":            mwanachamaagency.ErrFindingNotFound,
	"ErrInvalidReview":              mwanachamaagency.ErrInvalidReview,
	"ErrUsedByScenario":             mwanachamaagency.ErrUsedByScenario,
	"ErrHazardNotFound":             mwanachamaagency.ErrHazardNotFound,
	"ErrThreatNotFound":             mwanachamaagency.ErrThreatNotFound,
	"ErrConsequenceNotFound":        mwanachamaagency.ErrConsequenceNotFound,
	"ErrRiskThreatNotFound":         mwanachamaagency.ErrRiskThreatNotFound,
	"ErrRiskConsequenceNotFound":    mwanachamaagency.ErrRiskConsequenceNotFound,
	"ErrInvalidHazard":              mwanachamaagency.ErrInvalidHazard,
	"ErrInvalidThreat":              mwanachamaagency.ErrInvalidThreat,
	"ErrInvalidConsequence":         mwanachamaagency.ErrInvalidConsequence,
	"ErrLibraryPartInUse":           mwanachamaagency.ErrLibraryPartInUse,
	"ErrDuplicateRiskThreat":        mwanachamaagency.ErrDuplicateRiskThreat,
	"ErrDuplicateRiskConsequence":   mwanachamaagency.ErrDuplicateRiskConsequence,
	"ErrConsequenceOutsideHazard":   mwanachamaagency.ErrConsequenceOutsideHazard, "ErrLibraryTitleTaken": mwanachamaagency.ErrLibraryTitleTaken,
}

func Build(m mwanachamaagency.AgencyManager, caller dispatch.Caller) ([]Route, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{Manager: m, Errors: sentinels, Caller: caller})
}

func Routes(m mwanachamaagency.AgencyManager, caller dispatch.Caller) []Route {
	out, err := Build(m, caller)
	if err != nil {
		panic(fmt.Sprintf("agency routes: %v", err))
	}
	return out
}

func Shape() []Route {
	s, err := operations()
	if err != nil {
		panic(fmt.Sprintf("agency routes: %v", err))
	}
	names := make([]string, 0, len(s.Operations))
	for name := range s.Operations {
		names = append(names, name)
	}
	sort.Strings(names)

	out := make([]Route, 0, len(names))
	for _, name := range names {
		op := s.Operations[name]
		out = append(out, Route{Method: op.Method, Path: s.Base + op.Path, Action: op.Action})
	}
	return out
}
