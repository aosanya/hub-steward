package mwanachamaratings

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"wakalaserver/modules/ratings/models"
	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
)

func Check(s *spec.Spec, role string, v any) error {
	o, ok := s.ByRole(role)
	if !ok {
		return fmt.Errorf("check: this domain fills no object for the role %q", role)
	}
	if err := declared(o, v); err != nil {
		return err
	}
	return bounds(role, v)
}

func declared(o spec.Object, v any) error {
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
		byColumn[specstore.ColumnName(rt.Field(i).Name)] = rv.Field(i)
	}

	for _, f := range o.Fields {
		fv, ok := byColumn[f.Name]
		if !ok {
			continue
		}
		if err := declaredField(o, f, fv); err != nil {
			return err
		}
	}
	return nil
}

var timeType = reflect.TypeOf(time.Time{})

func declaredField(o spec.Object, f spec.Field, fv reflect.Value) error {
	if fv.Type() == timeType {
		if f.Required && fv.Interface().(time.Time).IsZero() {
			return fmt.Errorf("%s: %s is required", o.Name, f.Name)
		}
		return nil
	}
	if fv.Kind() != reflect.String {
		return nil
	}
	s := fv.String()
	if f.Required && strings.TrimSpace(s) == "" {
		return fmt.Errorf("%s: %s is required", o.Name, f.Name)
	}
	if f.Type == spec.TypeEnum && !holds(f.Values, s) {
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
	return nil
}

func holds(values []string, s string) bool {
	for _, v := range values {
		if v == s {
			return true
		}
	}
	return false
}

func bounds(role string, v any) error {
	switch held := deref(v).(type) {
	case models.Rating:
		if !held.ValueInRange() {
			return fmt.Errorf("%s: value %v is outside [%v, %v]", role, held.Value, models.MinValue, models.MaxValue)
		}
	case models.Similarity:
		if !held.ScoreInRange() {
			return fmt.Errorf("%s: score %v is outside (0, 1]", role, held.Score)
		}
		if !held.OverlapIsCount() {
			return fmt.Errorf("%s: overlap %d is not a count", role, held.Overlap)
		}
	}
	return nil
}

func deref(v any) any {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Pointer && !rv.IsNil() {
		return rv.Elem().Interface()
	}
	return v
}
