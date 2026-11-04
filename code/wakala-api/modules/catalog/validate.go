package mwanachamacatalog

import (
	"fmt"
	"reflect"
	"strings"

	"wakalaserver/modules/shared/spec"
)

// The roles a caller may name when checking a value against a spec without
// a database — see [Check]. They are the module's own words for the objects
// a domain fills; the unexported constants in store.go are the same strings.
const (
	// RoleEntry is the catalog's document.
	RoleEntry = roleEntry

	// RoleEntryPrivate is the operator's own notes on one document.
	RoleEntryPrivate = roleEntryPrivate

	// RoleSuggestion is something proposed for the catalog.
	RoleSuggestion = roleSuggestion
)

// Check reports whether v satisfies what s declares for the object playing
// role. It needs no database, which is what lets a bulk import validate
// everything it has read before opening a connection.
func Check(s *spec.Spec, role string, v any) error {
	o, ok := s.ByRole(role)
	if !ok {
		return fmt.Errorf("check: this domain fills no object for the role %q", role)
	}
	return check(o, v)
}

// check reports whether v satisfies what o declares: a required field that
// is present, an enum value that is one of the declared ones, and a
// `matches` pattern that holds.
//
// These are the rules the spec can state, so they are read from it rather
// than written again in Go. What stays in Go is what a spec cannot say —
// that a PageView carries a slug exactly when it is an Entry's page, that a
// count is not negative — and each of those lives with the type it is about.
func check(o spec.Object, v any) error {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Pointer {
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return fmt.Errorf("check %s: want a struct, got %T", o.Name, v)
	}

	byColumn := map[string]reflect.Value{}
	rt := rv.Type()
	for i := 0; i < rt.NumField(); i++ {
		if rt.Field(i).PkgPath != "" {
			continue
		}
		byColumn[columnName(rt.Field(i).Name)] = rv.Field(i)
	}

	for _, f := range o.Fields {
		fv, ok := byColumn[f.Name]
		if !ok || fv.Kind() != reflect.String {
			// Only text-shaped fields carry these rules; an int or a bool
			// has nothing here to check, and a column with no field at all
			// was already refused when the manager was built.
			continue
		}
		s := fv.String()

		if f.Required && strings.TrimSpace(s) == "" {
			return fmt.Errorf("%s: %s is required", o.Name, f.Name)
		}
		if f.Type == spec.TypeEnum && !declares(f.Values, s) {
			return fmt.Errorf("%s: %s is %q, which is not one of %s",
				o.Name, f.Name, s, strings.Join(f.Values, ", "))
		}
		if f.Matches != "" && s != "" {
			ok, known := patterns[f.Matches]
			if !known {
				return fmt.Errorf("%s: %s names the pattern %q, which this module does not supply",
					o.Name, f.Name, f.Matches)
			}
			if !ok(s) {
				return fmt.Errorf("%s: %s does not match %s", o.Name, f.Name, f.Matches)
			}
		}
	}
	return nil
}

// checkField applies the same declared rules to one field, for the calls
// that carry one value rather than a whole object — SetVisibility is handed
// a state, not an Entry, and checking a whole Entry built around it would
// fail on every other field being absent.
func checkField(o spec.Object, column, value string) error {
	for _, f := range o.Fields {
		if f.Name != column {
			continue
		}
		if f.Type == spec.TypeEnum && !declares(f.Values, value) {
			return fmt.Errorf("%s: %s is %q, which is not one of %s",
				o.Name, f.Name, value, strings.Join(f.Values, ", "))
		}
		if f.Matches != "" && value != "" {
			if ok, known := patterns[f.Matches]; known && !ok(value) {
				return fmt.Errorf("%s: %s does not match %s", o.Name, f.Name, f.Matches)
			}
		}
		return nil
	}
	return fmt.Errorf("%s declares no field %q", o.Name, column)
}

func declares(values []string, s string) bool {
	for _, v := range values {
		if v == s {
			return true
		}
	}
	return false
}

// checks runs check for the object playing one role.
func (m *catalogManager) checks(role string, v any) error {
	return check(m.st.Object(role), v)
}

// checksField runs checkField for the object playing one role.
func (m *catalogManager) checksField(role, column, value string) error {
	return checkField(m.st.Object(role), column, value)
}
