package http

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"
)

type fileRecordShape struct {
	code      string
	name      string
	formName  string
	itemName  string
	questions []models.StepQuestion
}

func fieldCodesOf(questions []models.StepQuestion) []models.StepQuestion {
	out := append([]models.StepQuestion(nil), questions...)
	taken := map[string]bool{}
	for _, q := range out {
		taken[q.Code] = true
	}
	for i := range out {
		if out[i].Code != "" {
			continue
		}
		proposed := mwanachamaagency.FieldCodeOf(out[i].Prompt)
		code := proposed
		for n := 2; taken[code]; n++ {
			code = proposed + "_" + strconv.Itoa(n)
		}
		out[i].Code = code
		taken[code] = true
	}
	return out
}

func (in importRequest) recordShapes() map[string]fileRecordShape {
	shapes := map[string]fileRecordShape{}
	for _, rc := range in.Records {
		shapes[rc.Code] = fileRecordShape{rc.Code, rc.Name, rc.FormName, rc.ItemName, fieldCodesOf(rc.Questions)}
	}
	for _, wi := range in.stepsDerivingARecord() {
		shapes[wi.RecordCode] = fileRecordShape{wi.RecordCode, recordNameOfCode(wi.RecordCode, wi.Title), wi.FormName, "", fieldCodesOf(wi.Questions)}
	}
	return shapes
}

func (s fileRecordShape) permissionCodes() map[string]bool {
	given := map[string]bool{}
	record := models.Record{Code: s.code, Name: s.name, FormName: s.formName, ItemName: s.itemName, Questions: s.questions}
	for _, p := range mwanachamaagency.RecordPermissionsOf(record) {
		given[p.Code] = true
	}
	return given
}

func (s fileRecordShape) fieldNames() string {
	names := make([]string, 0, len(s.questions))
	for _, q := range s.questions {
		names = append(names, q.Code)
	}
	return strings.Join(names, ", ")
}

type recordPermissionParts struct {
	record string
	action string
	field  string
	fields int
}

func partsOfRecordPermission(code string) recordPermissionParts {
	pieces := strings.Split(strings.TrimPrefix(code, mwanachamaagency.RecordPermissionPrefix), ".")
	parts := recordPermissionParts{record: pieces[0], fields: len(pieces) - 2}
	if len(pieces) > 1 {
		parts.action = pieces[1]
	}
	if len(pieces) > 2 {
		parts.field = pieces[2]
	}
	return parts
}

func isFieldLevelAction(action string) bool {
	return action == models.RowActionAdd || action == models.RowActionEdit || action == mwanachamaagency.RecordViewAction
}

func refuseRecordPermission(role, code string, shapes map[string]fileRecordShape) error {
	parts := partsOfRecordPermission(code)
	if parts.fields == 0 && isFieldLevelAction(parts.action) {
		return fmt.Errorf("role %q: %s is not a permission any more; give %s for every field of the record, or %s for one field", role, code,
			mwanachamaagency.RecordPermissionCode(parts.record, parts.action, mwanachamaagency.RecordFieldStar),
			mwanachamaagency.RecordPermissionCode(parts.record, parts.action, "<field>"))
	}
	shape, found := shapes[parts.record]
	if !found {
		return fmt.Errorf("role %q: %s names the record %q, and the file has no record with that code", role, code, parts.record)
	}
	if parts.fields == 1 && isFieldLevelAction(parts.action) {
		return fmt.Errorf("role %q: %s names the field %q, and the record %q has no such field; its fields are %s", role, code, parts.field, parts.record, shape.fieldNames())
	}
	return fmt.Errorf("role %q: %s is not a permission of the record %q; its codes are %s.<add|edit|view>.<field>, the same with .* for every field, and %s", role, code, parts.record, parts.record, mwanachamaagency.RecordPermissionCode(parts.record, models.RowActionDelete))
}

func refuseCataloguePermission(role, code string) error {
	permission, known := models.LookupPermission(code)
	switch {
	case !known:
		return fmt.Errorf("role %q: %s is not a permission the catalogue knows; list the catalogue to see the codes", role, code)
	case permission.Locked:
		return fmt.Errorf("role %q: %s belongs to the owner alone and cannot be given to a role", role, code)
	}
	return nil
}

func isRecordPermissionCode(code string) bool {
	return strings.HasPrefix(code, mwanachamaagency.RecordPermissionPrefix)
}

func (in importRequest) checkRolePermissions() error {
	shapes := in.recordShapes()
	given := map[string]bool{}
	for _, shape := range shapes {
		for code := range shape.permissionCodes() {
			given[code] = true
		}
	}
	for _, role := range in.Roles {
		for _, code := range role.Permissions {
			if !isRecordPermissionCode(code) {
				if err := refuseCataloguePermission(role.Name, code); err != nil {
					return err
				}
				continue
			}
			if !given[code] {
				return refuseRecordPermission(role.Name, code, shapes)
			}
		}
	}
	return nil
}

func withoutRecordPermissions(codes []string) []string {
	kept := make([]string, 0, len(codes))
	for _, code := range codes {
		if !isRecordPermissionCode(code) {
			kept = append(kept, code)
		}
	}
	return kept
}

func hasRecordPermissions(codes []string) bool {
	return len(withoutRecordPermissions(codes)) != len(codes)
}

func (im *importer) recordPermissionInDraft(code string) string {
	if !isRecordPermissionCode(code) {
		return code
	}
	rest := strings.TrimPrefix(code, mwanachamaagency.RecordPermissionPrefix)
	record, tail, _ := strings.Cut(rest, ".")
	return mwanachamaagency.RecordPermissionPrefix + im.readableCodes.resolveOr(record) + "." + tail
}

func (im *importer) applyRolePermissions(ctx context.Context, in importRequest) {
	for _, r := range in.Roles {
		id, ok := im.roles.resolve(firstNonEmpty(r.ID, r.Code))
		if !ok || (!hasRecordPermissions(r.Permissions) && len(im.stepRolesAdding[id]) == 0) {
			continue
		}
		permissions := make([]string, 0, len(r.Permissions))
		for _, code := range r.Permissions {
			permissions = append(permissions, im.recordPermissionInDraft(code))
		}
		permissions = append(permissions, im.stepRolesAdding[id]...)
		if _, err := im.mgr.SetRolePermissions(ctx, id, models.DistinctPermissions(permissions)); err != nil {
			im.fail("role %q: %v", r.Name, err)
		}
	}
}
