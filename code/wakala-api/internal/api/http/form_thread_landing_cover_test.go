package http

import (
	"context"
	"errors"
	"testing"
	"time"

	"wakalaserver/internal/accounts"
	commmodels "wakalaserver/modules/comm/models"
	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
)

func TestOnlyAStandingFormThatLandsInAThreadOpensOne(t *testing.T) {
	cases := []struct {
		name string
		form formsmodels.Form
		want bool
	}{
		{"standing and landing in a thread", formsmodels.Form{Standing: true, Landing: forms.LandingThread}, true},
		{"standing but landing nowhere", formsmodels.Form{Standing: true}, false},
		{"standing but landing as a case", formsmodels.Form{Standing: true, Landing: formsmodels.LandingCase}, false},
		{"one-off landing in a thread", formsmodels.Form{Landing: forms.LandingThread}, false},
	}
	for _, c := range cases {
		if got := landsInAThread(c.form); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestSendersOwnThreadIsTheLatestLiveOneWithTheFormsTitle(t *testing.T) {
	declined := time.Now()
	threads := []commmodels.ChatThread{
		{ID: "t1", RequestedBy: "amina", Label: "Weekly report"},
		{ID: "t2", RequestedBy: "otieno", Label: "Weekly report"},
		{ID: "t3", RequestedBy: "amina", Label: "Weekly report"},
		{ID: "t4", RequestedBy: "amina", Label: "Weekly report", DeclinedAt: &declined},
		{ID: "t5", RequestedBy: "amina", Label: "Another form"},
	}

	got, found := threadRequestedBy(threads, "amina", "  Weekly   report ")
	if !found || got.ID != "t3" {
		t.Fatalf("the title is matched with its spaces squeezed, the newest live thread wins; got %q found=%v", got.ID, found)
	}
	if _, found := threadRequestedBy(threads, "nobody", "Weekly report"); found {
		t.Fatal("a thread another person requested is not the sender's")
	}
	if _, found := threadRequestedBy(threads[3:4], "amina", "Weekly report"); found {
		t.Fatal("a declined thread is never reused")
	}
	if _, found := threadRequestedBy(nil, "amina", "Weekly report"); found {
		t.Fatal("no threads, nothing found")
	}
}

func landingWorld(t *testing.T) (applyWorld, sendsLandedInThreads) {
	t.Helper()
	w := newApplyWorld(t)
	fm, err := w.reg.FormManager(w.ctx, w.instanceID)
	if err != nil {
		t.Fatalf("FormManager: %v", err)
	}
	return w, sendsLandedInThreads{FormManager: fm, rooms: w.reg, instanceID: w.instanceID}
}

func newForm(t *testing.T, s sendsLandedInThreads, in formsmodels.Form) formsmodels.Form {
	t.Helper()
	in.Title = "Weekly report"
	in.ClosesAt = "2099-01-01T00:00:00Z"
	in.OriginatorChapterID = "g-1"
	in.CreatedBy = "author-1"
	in.Audience = formsmodels.AudienceMember
	in.CollectionMode = formsmodels.CollectionSelf
	made, err := s.FormManager.Create(context.Background(), in)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return made
}

func TestSentLinesReadChoiceAnswersAsTheOptionsLabels(t *testing.T) {
	_, s := landingWorld(t)
	ctx := context.Background()
	form := newForm(t, s, formsmodels.Form{Standing: true, Landing: forms.LandingThread})
	choice, options, err := s.FormManager.AddQuestion(ctx, formsmodels.QuestionDraft{
		Question: formsmodels.Question{FormID: form.ID, Prompt: "Which tool", AnswerType: formsmodels.AnswerSingleChoice},
		Options:  []formsmodels.QuestionOption{{Label: "Spade"}, {Label: "Rake"}},
	})
	if err != nil {
		t.Fatalf("AddQuestion choice: %v", err)
	}
	note, _, err := s.FormManager.AddQuestion(ctx, formsmodels.QuestionDraft{Question: formsmodels.Question{FormID: form.ID, Prompt: "Notes", AnswerType: formsmodels.AnswerFreeText}})
	if err != nil {
		t.Fatalf("AddQuestion note: %v", err)
	}
	if len(options) != 2 {
		t.Fatalf("two options expected, got %d", len(options))
	}

	body, err := s.sentLines(ctx, form, []formsmodels.Answer{
		{QuestionID: choice.ID, OptionIDs: []string{options[1].ID}},
		{QuestionID: note.ID, ValueText: "all fine"},
	})
	if err != nil {
		t.Fatalf("sentLines: %v", err)
	}
	if body != "Which tool: Rake\nNotes: all fine" {
		t.Fatalf("the lines carry prompts and the chosen label, got %q", body)
	}

	labels, err := s.optionLabels(ctx, []formsmodels.Question{choice, note})
	if err != nil {
		t.Fatalf("optionLabels: %v", err)
	}
	if len(labels) != 2 || labels[options[0].ID] != "Spade" || labels[options[1].ID] != "Rake" {
		t.Fatalf("labels for both options and none for free text, got %v", labels)
	}
}

func TestSentLinesOfAFormWithNoQuestionsAreEmpty(t *testing.T) {
	_, s := landingWorld(t)
	body, err := s.sentLines(context.Background(), formsmodels.Form{ID: "no-such-form"}, []formsmodels.Answer{{QuestionID: "q1", ValueText: "stray"}})
	if err != nil || body != "" {
		t.Fatalf("a form with no questions says nothing and is not an error, got %q, %v", body, err)
	}
}

func TestAnAnswerOnAFormThatDoesNotLandInAThreadPostsNothing(t *testing.T) {
	_, s := landingWorld(t)
	oneOff := newForm(t, s, formsmodels.Form{})
	if err := s.landInThread(context.Background(), oneOff.ID, nil); err != nil {
		t.Fatalf("a form that lands nowhere is not an error: %v", err)
	}
	if err := s.landInThread(context.Background(), "no-such-form", nil); err == nil {
		t.Fatal("an unknown form is an error the caller logs")
	}
}

func TestAThreadFormWithNothingAnsweredPostsNothing(t *testing.T) {
	_, s := landingWorld(t)
	form := newForm(t, s, formsmodels.Form{Standing: true, Landing: forms.LandingThread})
	if err := s.landInThread(context.Background(), form.ID, nil); err != nil {
		t.Fatalf("no answers means no lines and no post, not an error: %v", err)
	}
}

func TestPostingToTheSendersThreadNeedsASenderAndAGroup(t *testing.T) {
	w, s := landingWorld(t)

	if err := s.postToSendersThread(context.Background(), "Weekly report", "g-1", "lines"); !errors.Is(err, errNobodySent) {
		t.Fatalf("no caller in the context: got %v, want errNobodySent", err)
	}
	signedIn := accounts.WithID(context.Background(), "amina")
	if err := s.postToSendersThread(signedIn, "Weekly report", "", "lines"); !errors.Is(err, errSendNamedNoGroup) {
		t.Fatalf("a send filed under no group: got %v, want errSendNamedNoGroup", err)
	}
	if err := s.postToSendersThread(signedIn, "Weekly report", "g-1", "lines"); err == nil {
		t.Fatal("a sender who is not in that group cannot open a thread in it")
	}
	_ = w
}
