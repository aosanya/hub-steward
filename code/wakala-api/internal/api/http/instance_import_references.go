package http

import (
	"errors"
	"fmt"

	"github.com/aosanya/mwanachama-backend-agency/models"
)

var errDuplicateReference = errors.New("duplicate reference")

type referenceKeys struct {
	id   string
	code string
}

func checkSectionReferences(section string, keys []referenceKeys) error {
	seen := map[string]bool{}
	for _, k := range keys {
		own := map[string]bool{}
		for _, key := range []string{k.id, k.code} {
			if key == "" || own[key] {
				continue
			}
			own[key] = true
			if seen[key] {
				return fmt.Errorf("%w: %q is the id or code of more than one row in %q; give every row its own", errDuplicateReference, key, section)
			}
		}
		for key := range own {
			seen[key] = true
		}
	}
	return nil
}

type importRefusal struct{ error }

func (r importRefusal) Unwrap() error { return r.error }

func (in importRequest) check() error {
	for _, check := range []func() error{in.checkReferences, in.checkRolePermissions, in.checkMounts, in.checkHome} {
		if err := check(); err != nil {
			return importRefusal{err}
		}
	}
	return nil
}

func (in importRequest) checkReferences() error {
	if err := in.checkRecordCodes(); err != nil {
		return err
	}
	if err := in.checkStepRecordCodes(); err != nil {
		return err
	}
	if err := in.checkRecordCodeClashes(); err != nil {
		return err
	}
	if err := in.checkRecordKeys(); err != nil {
		return err
	}
	sections := []struct {
		name string
		keys []referenceKeys
	}{
		{"roles", keysOf(len(in.Roles), func(i int) referenceKeys { return referenceKeys{in.Roles[i].ID, in.Roles[i].Code} })},
		{"goals", keysOf(len(in.Goals), func(i int) referenceKeys { return referenceKeys{in.Goals[i].ID, in.Goals[i].Code} })},
		{"objectives", keysOf(len(in.Objectives), func(i int) referenceKeys {
			return referenceKeys{in.Objectives[i].ID, in.Objectives[i].Code}
		})},
		{"workflows", keysOf(len(in.Workflows), func(i int) referenceKeys {
			return referenceKeys{in.Workflows[i].ID, in.Workflows[i].Code}
		})},
		{"work_items", keysOf(len(in.WorkItems), func(i int) referenceKeys {
			return referenceKeys{in.WorkItems[i].ID, in.WorkItems[i].Code}
		})},
		{"controls, values and rules", controlKeys(in.controls())},
		{"risks", keysOf(len(in.Risks), func(i int) referenceKeys { return referenceKeys{in.Risks[i].ID, in.Risks[i].Code} })},
	}
	for _, s := range sections {
		if err := checkSectionReferences(s.name, s.keys); err != nil {
			return err
		}
	}
	return in.checkSubjectRecords()
}

func (in importRequest) checkSubjectRecords() error {
	held := map[string]bool{}
	for _, r := range in.Records {
		held[r.Code] = true
	}
	for _, wi := range in.WorkItems {
		if wi.RecordCode != "" {
			held[wi.RecordCode] = true
		}
	}
	for _, w := range in.Workflows {
		if w.SubjectRecord != "" && !held[w.SubjectRecord] {
			return fmt.Errorf("workflow %q names the subject record %q, which the file does not hold", w.Name, w.SubjectRecord)
		}
	}
	return nil
}

func (wi importWorkItem) keepsARecordByCode() bool {
	return wi.Kind == models.StepKindFillForm && wi.RoleID != "" && wi.FormName != "" && len(wi.Questions) > 0 && !wi.writesARow()
}

func (in importRequest) workflowPositions() map[string]int {
	positions := map[string]int{}
	for i, w := range in.Workflows {
		for _, ref := range []string{w.ID, w.Code} {
			if ref != "" {
				positions[ref] = i
			}
		}
	}
	return positions
}

func (in importRequest) checkStepRecordCodes() error {
	declared := in.declaredRecordCodes()
	positions := in.workflowPositions()
	named := map[string]string{}
	for _, wi := range in.WorkItems {
		code := wi.RecordCode
		if code == "" {
			continue
		}
		if !validRecordCode(code) {
			return fmt.Errorf("work item %q: the record code %q is not valid; %s", wi.Title, code, recordCodeRule())
		}
		if !wi.keepsARecordByCode() {
			return fmt.Errorf("work item %q: the record code %q needs a form step with a role, a form name and questions that does not write a row", wi.Title, code)
		}
		if first, repeated := named[code]; repeated {
			return fmt.Errorf("work item %q: the record code %q is already the record of the work item %q; give every form step its own record", wi.Title, code, first)
		}
		named[code] = wi.Title
		if rc, adopted := declared[code]; adopted && !sameWorkflow(positions, rc.WorkflowID, wi.WorkflowID) {
			return fmt.Errorf("work item %q: the record %q with the code %q belongs to another workflow than the step", wi.Title, rc.Name, code)
		}
	}
	return nil
}

func sameWorkflow(positions map[string]int, a, b string) bool {
	first, okA := positions[a]
	second, okB := positions[b]
	return okA && okB && first == second
}

func keysOf(n int, at func(int) referenceKeys) []referenceKeys {
	out := make([]referenceKeys, n)
	for i := range out {
		out[i] = at(i)
	}
	return out
}

func controlKeys(controls []importControl) []referenceKeys {
	return keysOf(len(controls), func(i int) referenceKeys { return referenceKeys{controls[i].ID, controls[i].Code} })
}
