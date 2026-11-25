package http

import (
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func tenderRecordOf() agencymodels.Record {
	return agencymodels.Record{Code: "tender", Questions: []agencymodels.StepQuestion{{Code: "issuer"}, {Code: "closing_date"}}}
}

func TestACodeNamingOneFieldAllowsThatFieldAndRefusesAnother(t *testing.T) {
	codes := rowCodes{"record.tender.add.issuer": true}
	record := tenderRecordOf()
	if !codes.allow(record, "add", "issuer") {
		t.Errorf("add.issuer refused the issuer field")
	}
	if codes.allow(record, "add", "closing_date") {
		t.Errorf("add.issuer allowed the closing_date field")
	}
	if !codes.allow(record, "add", anyFieldOfRecord) {
		t.Errorf("add.issuer refused the add as a whole")
	}
}

func TestAStarAllowsEveryFieldTheRecordHasAtTheTimeOfTheCheck(t *testing.T) {
	codes := rowCodes{"record.tender.edit.*": true}
	record := tenderRecordOf()
	record.Questions = append(record.Questions, agencymodels.StepQuestion{Code: "added_next_month"})
	for _, field := range []string{"issuer", "closing_date", "added_next_month"} {
		if !codes.allow(record, "edit", field) {
			t.Errorf("edit.* refused the field %s", field)
		}
	}
}

func TestEachActionAsksItsOwnCodeAndViewIsNotImpliedByAddOrEdit(t *testing.T) {
	codes := rowCodes{"record.tender.add.*": true, "record.tender.edit.*": true}
	record := tenderRecordOf()
	if codes.allow(record, "view", "issuer") || codes.allow(record, "view", anyFieldOfRecord) {
		t.Errorf("add.* and edit.* gave view")
	}
	if codes.allow(record, "delete", anyFieldOfRecord) {
		t.Errorf("add.* and edit.* gave delete")
	}
}

func TestDeleteAsksOneCodeWithNoFieldPartAndNoStar(t *testing.T) {
	record := tenderRecordOf()
	if !(rowCodes{"record.tender.delete": true}).allow(record, "delete", anyFieldOfRecord) {
		t.Errorf("record.tender.delete refused a delete")
	}
	if (rowCodes{"record.tender.delete.*": true, "record.other.delete": true}).allow(record, "delete", anyFieldOfRecord) {
		t.Errorf("a star or another record's delete code allowed a delete")
	}
}

func TestACodeOfAnotherRecordGivesNothing(t *testing.T) {
	if (rowCodes{"record.client.view.*": true}).allow(tenderRecordOf(), "view", anyFieldOfRecord) {
		t.Errorf("the view code of another record allowed a view")
	}
}
