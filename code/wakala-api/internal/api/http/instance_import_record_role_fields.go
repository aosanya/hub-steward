package http

import (
	"encoding/json"
	"fmt"
	"strings"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"
)

func (rc *importRecord) UnmarshalJSON(data []byte) error {
	var probe models.DocumentRecord
	if err := json.Unmarshal(data, &probe); err != nil {
		return err
	}
	type plain importRecord
	var read plain
	if err := json.Unmarshal(data, &read); err != nil {
		return err
	}
	*rc = importRecord(read)
	rc.carriedRoleFields = probe.CarriedGoneRoleFields()
	return nil
}

var actionOfGoneRoleField = map[string]string{
	models.RecordFieldRoleID:       models.RowActionAdd,
	models.RecordFieldEditRoleID:   models.RowActionEdit,
	models.RecordFieldViewerRoleID: mwanachamaagency.RecordViewAction,
	models.RecordFieldDeleteRoleID: models.RowActionDelete,
}

func replacingCodesOf(recordCode, field string) string {
	action := actionOfGoneRoleField[field]
	if action == models.RowActionDelete {
		return mwanachamaagency.RecordPermissionCode(recordCode, action)
	}
	return mwanachamaagency.RecordPermissionCode(recordCode, action, mwanachamaagency.RecordFieldStar) +
		" or " + mwanachamaagency.RecordPermissionCode(recordCode, action, "<field>")
}

func (in importRequest) checkRecordRoleFields() error {
	for _, rc := range in.Records {
		if len(rc.carriedRoleFields) == 0 {
			continue
		}
		recordCode := rc.Code
		if !keepableRecordCode.MatchString(recordCode) {
			recordCode = mwanachamaagency.RecordCodeOf(rc.Name)
		}
		named := make([]string, 0, len(rc.carriedRoleFields))
		for _, field := range rc.carriedRoleFields {
			named = append(named, fmt.Sprintf("%s is gone from a record: give a role %s instead", field, replacingCodesOf(recordCode, field)))
		}
		return fmt.Errorf("the record %s: %s", rc.Name, strings.Join(named, "; "))
	}
	return nil
}
