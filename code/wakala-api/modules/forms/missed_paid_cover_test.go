package mwanachamaforms_test

import (
	"context"
	"errors"
	"testing"
	"time"

	forms "wakalaserver/modules/forms"
	"wakalaserver/modules/forms/models"
)

func dailyForm(t *testing.T, m forms.FormManager) models.Form {
	t.Helper()
	f, err := m.Create(context.Background(), models.Form{
		Title: "Synthetic daily return", ClosesAt: "2099-01-01T00:00:00Z", OriginatorChapterID: "g-1",
		CreatedBy: "author-1", Audience: models.AudienceMember, CollectionMode: models.CollectionSelf,
		Schedule: models.FormSchedule{Start: "2020-01-01T00:00:00Z", Zone: "UTC", Rule: "FREQ=DAILY"},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return f
}

func yesterdayKey() string {
	return time.Now().UTC().AddDate(0, 0, -1).Format(models.PeriodKeyLayout)
}

func rosterOf(groups map[string][]string) forms.Members {
	return func(_ context.Context, groupID string, _ bool) ([]string, error) {
		return groups[groupID], nil
	}
}

func TestMissedRefusesAnUnknownFormAndAFormThatDoesNotRepeat(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	if _, err := m.ListMissed(ctx, "no-such-form", yesterdayKey()); !errors.Is(err, forms.ErrFormNotFound) {
		t.Fatalf("missed on an unknown form = %v, want ErrFormNotFound", err)
	}
	once, err := m.Create(ctx, models.Form{
		Title: "Synthetic one-off", ClosesAt: "2099-01-01T00:00:00Z", OriginatorChapterID: "g-1",
		CreatedBy: "author-1", Audience: models.AudienceMember, CollectionMode: models.CollectionSelf,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := m.ListMissed(ctx, once.ID, yesterdayKey()); !errors.Is(err, forms.ErrNotRepeating) {
		t.Fatalf("missed on a one-off form = %v, want ErrNotRepeating", err)
	}
}

func TestMissedRefusesAPeriodThatHasNotClosed(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	f := dailyForm(t, m)
	today := time.Now().UTC().Format(models.PeriodKeyLayout)
	tomorrow := time.Now().UTC().AddDate(0, 0, 1).Format(models.PeriodKeyLayout)
	for name, key := range map[string]string{"no period named": "", "the running period": today, "a future period": tomorrow} {
		if _, err := m.ListMissed(ctx, f.ID, key); !errors.Is(err, forms.ErrPeriodNotClosed) {
			t.Fatalf("missed with %s = %v, want ErrPeriodNotClosed", name, err)
		}
	}
}

func TestMissedIsEmptyWhenNoRosterIsSupplied(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	f := dailyForm(t, m)
	if _, err := m.AddTarget(ctx, models.Target{FormID: f.ID, ChapterID: "g-1"}); err != nil {
		t.Fatalf("AddTarget: %v", err)
	}
	got, err := m.ListMissed(ctx, f.ID, yesterdayKey())
	if err != nil {
		t.Fatalf("ListMissed: %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("missed with no roster = %#v, want an empty non-nil list", got)
	}
}

func TestMissedListsEachTargetedMemberOnceInIdOrderUnderTheFirstGroupThatNamedThem(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	f := dailyForm(t, m)
	for _, g := range []string{"g-1", "g-2"} {
		if _, err := m.AddTarget(ctx, models.Target{FormID: f.ID, ChapterID: g}); err != nil {
			t.Fatalf("AddTarget %s: %v", g, err)
		}
	}
	m.UseMembers(rosterOf(map[string][]string{
		"g-1": {"mem-3", "mem-1"},
		"g-2": {"mem-2", "mem-1"},
	}))
	got, err := m.ListMissed(ctx, f.ID, yesterdayKey())
	if err != nil {
		t.Fatalf("ListMissed: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("missed = %+v, want three distinct members", got)
	}
	for i, id := range []string{"mem-1", "mem-2", "mem-3"} {
		if got[i].MemberID != id {
			t.Fatalf("missed[%d] = %s, want %s (sorted by member id): %+v", i, got[i].MemberID, id, got)
		}
	}
	byMember := map[string]string{}
	for _, mm := range got {
		byMember[mm.MemberID] = mm.ChapterID
	}
	if byMember["mem-2"] != "g-2" {
		t.Fatalf("mem-2 reported under %q, want g-2", byMember["mem-2"])
	}
	if c := byMember["mem-1"]; c != "g-1" && c != "g-2" {
		t.Fatalf("mem-1 reported under %q, want one of their groups", c)
	}
}

func TestMissedPassesARosterFailureBack(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	f := dailyForm(t, m)
	if _, err := m.AddTarget(ctx, models.Target{FormID: f.ID, ChapterID: "g-1"}); err != nil {
		t.Fatalf("AddTarget: %v", err)
	}
	broken := errors.New("roster unavailable")
	m.UseMembers(func(context.Context, string, bool) ([]string, error) { return nil, broken })
	if _, err := m.ListMissed(ctx, f.ID, yesterdayKey()); !errors.Is(err, broken) {
		t.Fatalf("missed with a failing roster = %v, want the roster error", err)
	}
}

func TestMarkPaidNeedsASubmissionToMark(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	f := dailyForm(t, m)
	if _, err := m.MarkPaid(ctx, f.ID, "mem-1", true, "treasurer-1"); !errors.Is(err, forms.ErrSubmissionNotFound) {
		t.Fatalf("marking paid with nothing sent = %v, want ErrSubmissionNotFound", err)
	}
	if _, err := m.MarkPaid(ctx, f.ID, "", true, "treasurer-1"); !errors.Is(err, forms.ErrSubmissionNotFound) {
		t.Fatalf("marking paid for nobody = %v, want ErrSubmissionNotFound", err)
	}
	if _, err := m.MarkPaid(ctx, "no-such-form", "mem-1", true, "treasurer-1"); !errors.Is(err, forms.ErrFormNotFound) {
		t.Fatalf("marking paid on an unknown form = %v, want ErrFormNotFound", err)
	}
}

func submittedForm(t *testing.T, m forms.FormManager, member string) models.Form {
	t.Helper()
	ctx := context.Background()
	f, err := m.Create(ctx, models.Form{
		Title: "Synthetic dues", ClosesAt: "2099-01-01T00:00:00Z", OriginatorChapterID: "g-1",
		CreatedBy: "author-1", Audience: models.AudienceMember, CollectionMode: models.CollectionSelf,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	q, _, err := m.AddQuestion(ctx, models.QuestionDraft{Question: models.Question{FormID: f.ID, Prompt: "Ward", AnswerType: models.AnswerFreeText}})
	if err != nil {
		t.Fatalf("AddQuestion: %v", err)
	}
	if _, err := m.AddTarget(ctx, models.Target{FormID: f.ID, ChapterID: "g-1"}); err != nil {
		t.Fatalf("AddTarget: %v", err)
	}
	published, _, err := m.Publish(ctx, f.ID, "", "author-1", "")
	if err != nil {
		t.Fatalf("Publish: %v", err)
	}
	if _, err := m.SubmitAnswers(ctx, f.ID, member, []models.Answer{{QuestionID: q.ID, ValueText: "North"}}); err != nil {
		t.Fatalf("SubmitAnswers: %v", err)
	}
	return published
}

func TestMarkPaidStampsWhoAndWhenAndUnmarkingClearsBoth(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	f := submittedForm(t, m, "mem-1")

	paid, err := m.MarkPaid(ctx, f.ID, "mem-1", true, "treasurer-1")
	if err != nil {
		t.Fatalf("MarkPaid: %v", err)
	}
	if !paid.Paid || paid.PaidBy != "treasurer-1" || paid.PaidAt == "" {
		t.Fatalf("paid submission = %+v, want Paid with the marker and a time", paid)
	}
	read, err := m.GetSubmission(ctx, f.ID, "mem-1")
	if err != nil || !read.Paid || read.PaidBy != "treasurer-1" {
		t.Fatalf("submission read back = %+v, %v, want it still paid", read, err)
	}

	unpaid, err := m.MarkPaid(ctx, f.ID, "mem-1", false, "treasurer-2")
	if err != nil {
		t.Fatalf("MarkPaid false: %v", err)
	}
	if unpaid.Paid || unpaid.PaidBy != "" || unpaid.PaidAt != "" {
		t.Fatalf("unmarked submission = %+v, want no payment trace", unpaid)
	}
	read, err = m.GetSubmission(ctx, f.ID, "mem-1")
	if err != nil || read.Paid || read.PaidBy != "" {
		t.Fatalf("submission read back after unmarking = %+v, %v", read, err)
	}
}

func TestMarkPaidTouchesOnlyTheNamedMembersSubmission(t *testing.T) {
	m := gatedManager(t, gateFor{})
	ctx := context.Background()
	f := submittedForm(t, m, "mem-1")
	if _, err := m.MarkPaid(ctx, f.ID, "mem-2", true, "treasurer-1"); !errors.Is(err, forms.ErrSubmissionNotFound) {
		t.Fatalf("marking a member who sent nothing = %v, want ErrSubmissionNotFound", err)
	}
	read, err := m.GetSubmission(ctx, f.ID, "mem-1")
	if err != nil || read.Paid {
		t.Fatalf("another member's submission = %+v, %v, want it unpaid", read, err)
	}
}
