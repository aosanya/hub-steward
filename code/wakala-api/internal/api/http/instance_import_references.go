package http

import (
	"errors"
	"fmt"
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

func (in importRequest) checkReferences() error {
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
	return nil
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
