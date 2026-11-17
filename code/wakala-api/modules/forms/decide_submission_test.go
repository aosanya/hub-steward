package mwanachamaforms_test

import (
	"context"
	"errors"
	"testing"

	forms "wakalaserver/modules/forms"
	"wakalaserver/modules/forms/models"
)

func TestDecidingApprovedSetsTheFourFieldsAndTheApplicantReadsThemBack(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	before := models.NowRFC3339()
	decided, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionApproved, "inspection passed", "clerk-1")
	if err != nil {
		t.Fatalf("DecideSubmission: %v", err)
	}
	if decided.Decision != models.DecisionApproved || decided.DecidedBy != "clerk-1" || decided.DecisionNote != "inspection passed" || decided.DecidedAt < before {
		t.Fatalf("decided send = %+v", decided)
	}
	mine, err := r.m.ShowMySubmission(ctx, r.form.ID, "mem-1")
	if err != nil {
		t.Fatalf("ShowMySubmission: %v", err)
	}
	if mine.Decision != models.DecisionApproved || mine.DecidedBy != "clerk-1" || mine.DecisionNote != "inspection passed" || mine.DecidedAt != decided.DecidedAt {
		t.Fatalf("read_mine = %+v, want the decision as recorded", mine)
	}
	if mine.PaidBy != "" {
		t.Fatalf("read_mine paid_by = %q, want it cleared as before", mine.PaidBy)
	}
}

func TestTheApplicantReadsTheDecisionOnTheirSendByItsId(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionRefused, "no plan attached", "clerk-1"); err != nil {
		t.Fatalf("DecideSubmission: %v", err)
	}
	rows, err := r.m.ListAnswered(ctx, "mem-1")
	if err != nil || len(rows) != 1 {
		t.Fatalf("ListAnswered = %+v (%v)", rows, err)
	}
	send, err := r.m.GetSend(ctx, r.form.ID, rows[0].SendID, "mem-1")
	if err != nil {
		t.Fatalf("GetSend: %v", err)
	}
	if send.Submission.Decision != models.DecisionRefused || send.Submission.DecisionNote != "no plan attached" || send.Submission.DecidedBy != "clerk-1" {
		t.Fatalf("read_my_send submission = %+v", send.Submission)
	}
}

func TestARefusalWithoutANoteIsRefusedAndLeavesTheSendUndecided(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	for _, note := range []string{"", "   "} {
		if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionRefused, note, "clerk-1"); !errors.Is(err, forms.ErrMissingNote) {
			t.Fatalf("refusal with note %q = %v, want ErrMissingNote", note, err)
		}
	}
	mine, err := r.m.ShowMySubmission(ctx, r.form.ID, "mem-1")
	if err != nil || mine.Decision != "" {
		t.Fatalf("send after the refused refusal = %+v (%v), want undecided", mine, err)
	}
}

func TestARefusalWithANoteIsStored(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	got, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionRefused, "fence taller than allowed", "clerk-1")
	if err != nil {
		t.Fatalf("DecideSubmission: %v", err)
	}
	if got.Decision != models.DecisionRefused || got.DecisionNote != "fence taller than allowed" || got.DecidedBy != "clerk-1" || got.DecidedAt == "" {
		t.Fatalf("refused send = %+v", got)
	}
	mine, _ := r.m.ShowMySubmission(ctx, r.form.ID, "mem-1")
	if mine.Decision != models.DecisionRefused || mine.DecisionNote != "fence taller than allowed" {
		t.Fatalf("read_mine = %+v", mine)
	}
}

func TestAnApprovalNeedsNoNote(t *testing.T) {
	r := sentOnce(t)
	got, err := r.m.DecideSubmission(context.Background(), r.form.ID, "mem-1", models.DecisionApproved, "", "clerk-1")
	if err != nil || got.Decision != models.DecisionApproved || got.DecisionNote != "" {
		t.Fatalf("approval without note = %+v (%v)", got, err)
	}
}

func TestTheApplicantCannotDecideTheirOwnSend(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionApproved, "", "mem-1"); !errors.Is(err, forms.ErrSelfDecision) {
		t.Fatalf("own send decided by the applicant = %v, want ErrSelfDecision", err)
	}
	mine, _ := r.m.ShowMySubmission(ctx, r.form.ID, "mem-1")
	if mine.Decision != "" {
		t.Fatalf("send after the refused self decision = %+v, want undecided", mine)
	}
}

func TestDecidingAnUnknownSendIsNotFound(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-9", models.DecisionApproved, "", "clerk-1"); !errors.Is(err, forms.ErrSubmissionNotFound) {
		t.Fatalf("nobody sent = %v, want ErrSubmissionNotFound", err)
	}
	if _, err := r.m.DecideSubmission(ctx, "no-such-form", "mem-1", models.DecisionApproved, "", "clerk-1"); err == nil {
		t.Fatal("unknown form decided without error")
	}
}

func TestADecisionOfAWithdrawnSendIsNotFound(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	if err := r.m.HideMemberAnswers(ctx, "mem-1"); err != nil {
		t.Fatalf("HideMemberAnswers: %v", err)
	}
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionApproved, "", "clerk-1"); !errors.Is(err, forms.ErrSubmissionNotFound) {
		t.Fatalf("withdrawn send = %v, want ErrSubmissionNotFound", err)
	}
}

func TestADecisionMustBeApprovedOrRefusedAndANeedsADecider(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	for _, word := range []string{"", "maybe", "Approved"} {
		if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.Decision(word), "n", "clerk-1"); !errors.Is(err, forms.ErrInvalidDecision) {
			t.Fatalf("decision %q = %v, want ErrInvalidDecision", word, err)
		}
	}
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionApproved, "", ""); !errors.Is(err, forms.ErrInvalidDecision) {
		t.Fatalf("nobody deciding = %v, want ErrInvalidDecision", err)
	}
}

func TestDecidingAgainReplacesTheEarlierDecisionAndItsNote(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionRefused, "plan missing", "clerk-1"); err != nil {
		t.Fatalf("first decision: %v", err)
	}
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionApproved, "", "clerk-2"); err != nil {
		t.Fatalf("second decision: %v", err)
	}
	mine, err := r.m.ShowMySubmission(ctx, r.form.ID, "mem-1")
	if err != nil {
		t.Fatalf("ShowMySubmission: %v", err)
	}
	if mine.Decision != models.DecisionApproved || mine.DecidedBy != "clerk-2" || mine.DecisionNote != "" {
		t.Fatalf("send after deciding again = %+v, want the second decision alone", mine)
	}
	sent, err := r.m.ListSubmissions(ctx, r.form.ID, "mem-1", "")
	if err != nil || len(sent) != 1 {
		t.Fatalf("sends after deciding twice = %+v (%v), want one", sent, err)
	}
}

func TestAnUndecidedSendReadsWithAnEmptyDecision(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	mine, err := r.m.ShowMySubmission(ctx, r.form.ID, "mem-1")
	if err != nil {
		t.Fatalf("ShowMySubmission: %v", err)
	}
	if mine.Decision != "" || mine.DecidedBy != "" || mine.DecidedAt != "" || mine.DecisionNote != "" {
		t.Fatalf("undecided send = %+v", mine)
	}
}

func TestTheAnsweredListRowCarriesTheDecisionAndWhenItWasMade(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	rows, err := r.m.ListAnswered(ctx, "mem-1")
	if err != nil || len(rows) != 1 || rows[0].Decision != "" || rows[0].DecidedAt != "" {
		t.Fatalf("answered before deciding = %+v (%v), want one undecided row", rows, err)
	}
	decided, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionApproved, "", "clerk-1")
	if err != nil {
		t.Fatalf("DecideSubmission: %v", err)
	}
	rows, err = r.m.ListAnswered(ctx, "mem-1")
	if err != nil || len(rows) != 1 {
		t.Fatalf("answered after deciding = %+v (%v)", rows, err)
	}
	if rows[0].Decision != models.DecisionApproved || rows[0].DecidedAt != decided.DecidedAt {
		t.Fatalf("answered row = %+v, want approved at %s", rows[0], decided.DecidedAt)
	}
}

func TestADecisionStaysAfterTheApplicantSendsAgainOrAClerkCorrectsIt(t *testing.T) {
	ctx := context.Background()
	r := sentOnce(t)
	if _, err := r.m.DecideSubmission(ctx, r.form.ID, "mem-1", models.DecisionApproved, "ok", "clerk-1"); err != nil {
		t.Fatalf("DecideSubmission: %v", err)
	}
	if _, err := r.m.CorrectSubmission(ctx, r.form.ID, "mem-1", "clerk-1", []models.Answer{{QuestionID: r.question.ID, ValueText: "street lighting"}}); err != nil {
		t.Fatalf("CorrectSubmission: %v", err)
	}
	mine, err := r.m.ShowMySubmission(ctx, r.form.ID, "mem-1")
	if err != nil || mine.Decision != models.DecisionApproved || mine.DecisionNote != "ok" {
		t.Fatalf("send after a correction = %+v (%v), want the decision kept", mine, err)
	}
}
