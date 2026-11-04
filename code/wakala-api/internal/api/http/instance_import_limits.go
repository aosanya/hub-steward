package http

import (
	"errors"
	"fmt"

	"wakalaserver/internal/throttle"
)

var errImportTooLarge = errors.New("import too large")

func (in importRequest) entityCount() int {
	return len(in.Roles) +
		len(in.Goals) +
		len(in.Objectives) +
		len(in.Workflows) +
		len(in.WorkflowObjectives) +
		len(in.WorkItems) +
		len(in.RoleAssignments) +
		len(in.Controls) +
		len(in.Values) +
		len(in.Rules) +
		len(in.ControlAttachments) +
		len(in.ValueAttachments) +
		len(in.RuleAttachments) +
		len(in.Records) +
		len(in.Risks) +
		len(in.RiskPathways)
}

func checkImportSize(in importRequest) error {
	if n := in.entityCount(); n > throttle.MaxImportEntities {
		return fmt.Errorf("%w: a document may carry at most %d entities, this one carries %d; import it in several documents", errImportTooLarge, throttle.MaxImportEntities, n)
	}
	return nil
}
