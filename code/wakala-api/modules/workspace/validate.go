package mwanachamaworkspace

import (
	"fmt"
	"reflect"
	"strings"

	"wakalaserver/modules/shared/spec"
)

const (
	RoleWorkbook  = roleWorkbook
	RoleReference = roleReference
	RoleUse       = roleUse
	RoleShare     = roleShare

	RoleLayout       = roleLayout
	RoleLayoutChange = roleLayoutChange
	RoleLayoutChoice = roleLayoutChoice
)

func Check(s *spec.Spec, role string, v any) error {
	o, ok := s.ByRole(role)
	if !ok {
		return fmt.Errorf("check: this domain fills no object for the role %q", role)
	}
	return check(o, v)
}

func check(o spec.Object, v any) error {
	val := reflect.Indirect(reflect.ValueOf(v))
	if val.Kind() != reflect.Struct {
		return fmt.Errorf("check: %T is not a struct", v)
	}

	var problems []string
	for _, f := range o.Fields {
		fv := val.FieldByNameFunc(func(name string) bool {
			return columnName(name) == f.Name
		})
		if !fv.IsValid() {
			continue
		}
		text, ok := fv.Interface().(string)
		if !ok {
			if s, isStringer := fv.Interface().(fmt.Stringer); isStringer {
				text = s.String()
			} else {
				continue
			}
		}
		if f.Required && strings.TrimSpace(text) == "" {
			problems = append(problems, fmt.Sprintf("%s is required", f.Name))
			continue
		}
		if text == "" {
			continue
		}
		if len(f.Values) > 0 && !oneOf(text, f.Values) {
			problems = append(problems, fmt.Sprintf("%s is %q, which is not one of %s",
				f.Name, text, strings.Join(f.Values, ", ")))
		}
		if f.Matches != "" {
			ok, known := patterns[f.Matches]
			if !known {
				problems = append(problems, fmt.Sprintf("%s names the pattern %q, which this module does not supply", f.Name, f.Matches))
				continue
			}
			if !ok(text) {
				problems = append(problems, fmt.Sprintf("%s does not match %s", f.Name, f.Matches))
			}
		}
	}
	if len(problems) > 0 {
		return fmt.Errorf("%s: %s", o.Name, strings.Join(problems, "; "))
	}
	return nil
}

func oneOf(v string, values []string) bool {
	for _, x := range values {
		if x == v {
			return true
		}
	}
	return false
}
