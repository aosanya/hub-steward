package http

import (
	"context"
	"errors"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	forms "github.com/aosanya/mwanachama-backend-forms"
	formsmodels "github.com/aosanya/mwanachama-backend-forms/models"
)

type applicationsStub struct {
	forms.FormManager
	submitted []string
	sends     map[string][]formsmodels.Submission
}

func (a *applicationsStub) SubmitAnswersFor(_ context.Context, _, _, _, _, _, recordRowID string, _ []formsmodels.Answer) ([]formsmodels.Answer, error) {
	a.submitted = append(a.submitted, recordRowID)
	return nil, nil
}

func (a *applicationsStub) FileSubmission(_ context.Context, _, _, _, _, _, _, recordRowID, _ string, _ []formsmodels.Answer) ([]formsmodels.Answer, error) {
	a.submitted = append(a.submitted, recordRowID)
	return nil, nil
}

func (a *applicationsStub) ListSubmissionsOfPerson(_ context.Context, _, recordRowID string) ([]formsmodels.Submission, error) {
	return a.sends[recordRowID], nil
}

func (a *applicationsStub) ListSubmissions(_ context.Context, _, _, _, recordRowID string) ([]formsmodels.Submission, error) {
	return a.sends[recordRowID], nil
}

func businessRows() ([]agencymodels.RecordRow, []agencymodels.Record) {
	records := []agencymodels.Record{{
		ID: "rec-business", Code: "RC-266",
		Questions: []agencymodels.StepQuestion{{Prompt: "Owner", AnswerType: agencymodels.AnswerSingleChoice, OptionsFrom: "actors"}},
	}}
	rows := []agencymodels.RecordRow{
		{ID: "row-old", RecordID: "rec-business", Answers: map[string]string{"Owner": "mem-1"}},
		{ID: "row-new", RecordID: "rec-business", Replaces: "row-old", Answers: map[string]string{"Owner": "mem-1"}},
		{ID: "row-other", RecordID: "rec-business", Answers: map[string]string{"Owner": "mem-2"}},
	}
	return rows, records
}

func rowsFor(rows []agencymodels.RecordRow, records []agencymodels.Record) rowsOfTheAgency {
	return func(context.Context) ([]agencymodels.RecordRow, []agencymodels.Record, error) {
		return rows, records, nil
	}
}

func TestAnApplicationNamingABusinessTheSenderOwnsIsAccepted(t *testing.T) {
	rows, records := businessRows()
	stub := &applicationsStub{}
	wrapped := sendsNamingRows{FormManager: stub, read: rowsFor(rows, records)}
	if _, err := wrapped.SubmitAnswersFor(context.Background(), "f", "mem-1", "", "", "", "row-new", nil); err != nil {
		t.Fatalf("send naming an owned business = %v", err)
	}
	if len(stub.submitted) != 1 || stub.submitted[0] != "row-new" {
		t.Fatalf("submitted row ids = %v, want row-new", stub.submitted)
	}
}

func TestAnApplicationNamingABusinessTheSenderDoesNotOwnIsRefused(t *testing.T) {
	rows, records := businessRows()
	stub := &applicationsStub{}
	wrapped := sendsNamingRows{FormManager: stub, read: rowsFor(rows, records)}
	if _, err := wrapped.SubmitAnswersFor(context.Background(), "f", "mem-1", "", "", "", "row-other", nil); !errors.Is(err, errRecordRowNotOwned) {
		t.Fatalf("send naming another's business = %v, want errRecordRowNotOwned", err)
	}
	if _, err := wrapped.SubmitAnswersFor(context.Background(), "f", "mem-1", "", "", "", "row-missing", nil); !errors.Is(err, errRecordRowNotOwned) {
		t.Fatalf("send naming an unknown row = %v, want errRecordRowNotOwned", err)
	}
	if len(stub.submitted) != 0 {
		t.Fatalf("a refused send reached the manager: %v", stub.submitted)
	}
}

func TestAnApplicationNamingNoRowPassesStraightThrough(t *testing.T) {
	stub := &applicationsStub{}
	wrapped := sendsNamingRows{FormManager: stub, read: func(context.Context) ([]agencymodels.RecordRow, []agencymodels.Record, error) {
		return nil, nil, errors.New("rows must not be read")
	}}
	if _, err := wrapped.SubmitAnswersFor(context.Background(), "f", "mem-1", "", "", "", "", nil); err != nil {
		t.Fatalf("send naming no row = %v", err)
	}
}

func TestTheApplicationsOfACorrectedRowAreFoundFromTheCorrectedRow(t *testing.T) {
	rows, records := businessRows()
	stub := &applicationsStub{sends: map[string][]formsmodels.Submission{
		"row-old": {{ID: "s-old", RecordRowID: "row-old"}},
		"row-new": {{ID: "s-new", RecordRowID: "row-new"}},
	}}
	wrapped := sendsNamingRows{FormManager: stub, read: rowsFor(rows, records)}
	listed, err := wrapped.ListSubmissionsOfPerson(context.Background(), "mem-1", "row-new")
	if err != nil || len(listed) != 2 {
		t.Fatalf("applications of the corrected row = %+v (%v), want the send on the old row and the new row", listed, err)
	}
	byForm, err := wrapped.ListSubmissions(context.Background(), "f", "mem-1", "", "row-new")
	if err != nil || len(byForm) != 2 {
		t.Fatalf("applications of the corrected row by form = %+v (%v), want both", byForm, err)
	}
}

func TestAClerkFilingForAResidentNamingTheResidentsBusinessIsAccepted(t *testing.T) {
	rows, records := businessRows()
	stub := &applicationsStub{}
	wrapped := sendsNamingRows{FormManager: stub, read: rowsFor(rows, records)}
	if _, err := wrapped.FileSubmission(context.Background(), "f", "mem-1", "", "", "", "paper", "row-new", "clerk-1", nil); err != nil {
		t.Fatalf("filing naming the resident's business = %v", err)
	}
	if len(stub.submitted) != 1 || stub.submitted[0] != "row-new" {
		t.Fatalf("filed row ids = %v, want row-new", stub.submitted)
	}
}

func TestAClerkFilingNamingABusinessTheNamedPersonDoesNotOwnIsRefused(t *testing.T) {
	rows, records := businessRows()
	stub := &applicationsStub{}
	wrapped := sendsNamingRows{FormManager: stub, read: rowsFor(rows, records)}
	for _, row := range []string{"row-other", "row-missing"} {
		if _, err := wrapped.FileSubmission(context.Background(), "f", "mem-1", "", "", "", "paper", row, "mem-2", nil); !errors.Is(err, errRecordRowNotOwned) {
			t.Fatalf("filing naming %s = %v, want errRecordRowNotOwned", row, err)
		}
	}
	if len(stub.submitted) != 0 {
		t.Fatalf("a refused filing reached the manager: %v", stub.submitted)
	}
}

func TestAClerkFilingNamingNoRowPassesStraightThrough(t *testing.T) {
	stub := &applicationsStub{}
	wrapped := sendsNamingRows{FormManager: stub, read: func(context.Context) ([]agencymodels.RecordRow, []agencymodels.Record, error) {
		return nil, nil, errors.New("rows must not be read")
	}}
	if _, err := wrapped.FileSubmission(context.Background(), "f", "mem-1", "", "", "", "paper", "", "clerk-1", nil); err != nil {
		t.Fatalf("filing naming no row = %v", err)
	}
}
