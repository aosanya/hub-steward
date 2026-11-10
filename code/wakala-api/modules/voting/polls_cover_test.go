package voting

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
)

type pollsFixture struct {
	pm  *pollManager
	db  *gorm.DB
	s   *spec.Spec
	now time.Time
}

func newPolls(t *testing.T) *pollsFixture {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=private", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	s, err := SpecFor("cover")
	if err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	pm, err := NewPollManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	impl := pm.(*pollManager)
	f := &pollsFixture{pm: impl, db: db, s: s, now: time.Now().UTC()}
	impl.now = func() string { return f.now.Format(specstore.TimeLayout) }
	impl.UseGroups(func(_ context.Context, caller string) ([]string, error) {
		switch caller {
		case "amina":
			return []string{"ward-a"}, nil
		case "otieno":
			return []string{"ward-a", "ward-b"}, nil
		case "stranger":
			return []string{"ward-z"}, nil
		}
		return nil, nil
	})
	return f
}

func (f *pollsFixture) window() (string, string) {
	return f.now.Add(-time.Hour).Format(time.RFC3339), f.now.Add(time.Hour).Format(time.RFC3339)
}

func (f *pollsFixture) poll(t *testing.T, edit func(*Poll)) Poll {
	t.Helper()
	opens, closes := f.window()
	in := Poll{
		Question: "Which street is resurfaced first?", Mode: "one", PerGroup: "once", GroupIDs: []string{"ward-a"}, CreatedBy: "clerk",
		OpensAt: opens, ClosesAt: closes, Choices: []Choice{{Label: "Mill Street"}, {Label: "Orchard Lane"}, {Label: "Mill Road"}},
	}
	if edit != nil {
		edit(&in)
	}
	p, err := f.pm.CreatePoll(context.Background(), in)
	if err != nil {
		t.Fatalf("CreatePoll: %v", err)
	}
	return p
}

func TestCreatePollKeepsChoicesInOrderAndAlwaysStartsAsADraft(t *testing.T) {
	f := newPolls(t)
	p := f.poll(t, func(p *Poll) { p.State = "open"; p.PublishedBy = "sneaky"; p.PublishedAt = "2020-01-01T00:00:00Z" })
	if p.State != "draft" || p.PublishedAt != "" || p.PublishedBy != "" {
		t.Fatalf("%+v", p)
	}
	got, err := f.pm.GetPoll(context.Background(), p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Question != p.Question || got.State != "draft" || got.CreatedBy != "clerk" {
		t.Fatalf("%+v", got)
	}
	choices, err := f.pm.ListChoices(context.Background(), p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(choices) != 3 || choices[0].Label != "Mill Street" || choices[1].Position != 2 || choices[2].Label != "Mill Road" {
		t.Fatalf("%+v", choices)
	}
}

func TestCreatePollRefusesWhatAPollCannotBe(t *testing.T) {
	f := newPolls(t)
	opens, closes := f.window()
	cases := []struct {
		name string
		edit func(*Poll)
		want error
	}{
		{"no caller behind it", func(p *Poll) { p.CreatedBy = "" }, ErrNoCreator},
		{"no group to go to", func(p *Poll) { p.GroupIDs = nil }, ErrInvalidPoll},
		{"closing before it opens", func(p *Poll) { p.OpensAt, p.ClosesAt = closes, opens }, ErrInvalidPoll},
		{"up to without how many", func(p *Poll) { p.Mode, p.MaxChoices = "up_to", 0 }, ErrInvalidPoll},
		{"up to more than the choices", func(p *Poll) { p.Mode, p.MaxChoices = "up_to", 9 }, ErrInvalidPoll},
		{"quadratic without a budget", func(p *Poll) { p.Mode, p.Budget = "quadratic", 0 }, ErrInvalidPoll},
		{"a mode nobody declared", func(p *Poll) { p.Mode = "ranked" }, ErrInvalidPoll},
		{"an empty question", func(p *Poll) { p.Question = "  " }, ErrInvalidPoll},
		{"a choice without a label", func(p *Poll) { p.Choices = []Choice{{Label: ""}} }, ErrInvalidChoice},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			in := Poll{Question: "Which street?", Mode: "one", PerGroup: "once", GroupIDs: []string{"ward-a"}, CreatedBy: "clerk", OpensAt: opens, ClosesAt: closes, Choices: []Choice{{Label: "Mill Street"}}}
			c.edit(&in)
			if _, err := f.pm.CreatePoll(context.Background(), in); !errors.Is(err, c.want) {
				t.Fatalf("want %v, got %v", c.want, err)
			}
		})
	}
}

func TestCreatePollTakesItsModeFromTheDeclaredSettingsWhenNoneIsGiven(t *testing.T) {
	f := newPolls(t)
	settings, err := f.pm.Settings(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if settings.Mode == "" || len(settings.Effective) == 0 {
		t.Fatalf("%+v", settings)
	}
	p := f.poll(t, func(p *Poll) { p.Mode, p.PerGroup = "", "" })
	if p.Mode != settings.Mode || p.PerGroup != settings.PerGroup {
		t.Fatalf("poll %q/%q, settings %q/%q", p.Mode, p.PerGroup, settings.Mode, settings.PerGroup)
	}
}

func TestSettingsReadTheOverridesTheCallerSupplies(t *testing.T) {
	f := newPolls(t)
	f.pm.UseSettings(func(context.Context) (map[string]any, map[string]spec.Override, error) {
		return nil, map[string]spec.Override{"minimum_count": {Value: 7}}, nil
	})
	got, err := f.pm.Settings(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got.MinimumCount != 7 {
		t.Fatalf("%+v", got)
	}
	f.pm.UseSettings(func(context.Context) (map[string]any, map[string]spec.Override, error) {
		return nil, nil, errors.New("settings are down")
	})
	if _, err := f.pm.Settings(context.Background()); err == nil || !strings.Contains(err.Error(), "settings are down") {
		t.Fatalf("got %v", err)
	}
	if _, err := f.pm.CreatePoll(context.Background(), Poll{CreatedBy: "clerk"}); err == nil {
		t.Fatal("a poll was made while settings were unreadable")
	}
}

func TestWholeNumberReadsTheNumberTypesASettingCanHold(t *testing.T) {
	for _, c := range []struct {
		in   any
		want int
	}{{5, 5}, {int64(6), 6}, {7.0, 7}, {"8", 0}, {nil, 0}} {
		if got := wholeNumber(c.in); got != c.want {
			t.Fatalf("%v: got %d, want %d", c.in, got, c.want)
		}
	}
}

func TestChoicesAreAddedOnlyWhileThePollIsADraft(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, nil)
	added, err := f.pm.AddChoice(ctx, Choice{PollID: p.ID, Label: "Church Path"})
	if err != nil {
		t.Fatal(err)
	}
	if added.Position != 4 || added.ID == "" {
		t.Fatalf("%+v", added)
	}
	if _, err := f.pm.AddChoice(ctx, Choice{PollID: p.ID, Label: ""}); !errors.Is(err, ErrInvalidChoice) {
		t.Fatalf("got %v", err)
	}
	if _, err := f.pm.AddChoice(ctx, Choice{PollID: "nowhere", Label: "Church Path"}); !errors.Is(err, ErrPollNotFound) {
		t.Fatalf("got %v", err)
	}
}

func TestAnAnswerIsRefusedWhenItDoesNotFitThePoll(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	one := f.poll(t, nil)
	oneChoices, _ := f.pm.ListChoices(ctx, one.ID)
	upTo := f.poll(t, func(p *Poll) { p.Mode, p.MaxChoices = "up_to", 2 })
	upToChoices, _ := f.pm.ListChoices(ctx, upTo.ID)
	quad := f.poll(t, func(p *Poll) { p.Mode, p.Budget = "quadratic", 5 })
	quadChoices, _ := f.pm.ListChoices(ctx, quad.ID)

	cases := []struct {
		name string
		in   Answer
		want error
	}{
		{"nobody answering", Answer{PollID: one.ID, Votes: map[string]int{oneChoices[0].ID: 1}}, ErrNoAnswerer},
		{"a poll that is not there", Answer{PollID: "nowhere", AnsweredBy: "amina", Votes: map[string]int{"x": 1}}, ErrPollNotFound},
		{"nobody from the poll's groups", Answer{PollID: one.ID, AnsweredBy: "stranger", Votes: map[string]int{oneChoices[0].ID: 1}}, ErrNotInPollGroups},
		{"no votes at all", Answer{PollID: one.ID, AnsweredBy: "amina", Votes: map[string]int{}}, ErrInvalidAnswer},
		{"a choice from another poll", Answer{PollID: one.ID, AnsweredBy: "amina", Votes: map[string]int{upToChoices[0].ID: 1}}, ErrInvalidAnswer},
		{"two choices on a pick-one poll", Answer{PollID: one.ID, AnsweredBy: "amina", Votes: map[string]int{oneChoices[0].ID: 1, oneChoices[1].ID: 1}}, ErrInvalidAnswer},
		{"two votes on one choice", Answer{PollID: one.ID, AnsweredBy: "amina", Votes: map[string]int{oneChoices[0].ID: 2}}, ErrInvalidAnswer},
		{"zero votes on a choice", Answer{PollID: one.ID, AnsweredBy: "amina", Votes: map[string]int{oneChoices[0].ID: 0}}, ErrInvalidAnswer},
		{"more choices than up to allows", Answer{PollID: upTo.ID, AnsweredBy: "amina", Votes: map[string]int{upToChoices[0].ID: 1, upToChoices[1].ID: 1, upToChoices[2].ID: 1}}, ErrInvalidAnswer},
		{"votes that cost more than the budget", Answer{PollID: quad.ID, AnsweredBy: "amina", Votes: map[string]int{quadChoices[0].ID: 3}}, ErrInvalidAnswer},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := f.pm.AnswerPoll(ctx, c.in); !errors.Is(err, c.want) {
				t.Fatalf("want %v, got %v", c.want, err)
			}
		})
	}
	if res, err := f.pm.ListResponses(ctx, one.ID); err != nil || len(res.Items) != 0 {
		t.Fatalf("a refused answer was kept: %+v %v", res, err)
	}
}

func TestAnswersOutsideTheWindowAreRefused(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, nil)
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	answer := Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[0].ID: 1}}
	f.now = f.now.Add(2 * time.Hour)
	if _, err := f.pm.AnswerPoll(ctx, answer); !errors.Is(err, ErrOutsideWindow) {
		t.Fatalf("after closing: %v", err)
	}
	f.now = f.now.Add(-4 * time.Hour)
	if _, err := f.pm.AnswerPoll(ctx, answer); !errors.Is(err, ErrOutsideWindow) {
		t.Fatalf("before opening: %v", err)
	}
	f.now = f.now.Add(2 * time.Hour)
	if _, err := f.pm.AnswerPoll(ctx, answer); err != nil {
		t.Fatalf("inside the window: %v", err)
	}
}

func TestTheFirstAnswerIsKeptUnlessChangesAreAllowed(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	keep := f.poll(t, nil)
	keepChoices, _ := f.pm.ListChoices(ctx, keep.ID)
	first := Answer{PollID: keep.ID, AnsweredBy: "amina", Votes: map[string]int{keepChoices[0].ID: 1}}
	if _, err := f.pm.AnswerPoll(ctx, first); err != nil {
		t.Fatal(err)
	}
	first.Votes = map[string]int{keepChoices[1].ID: 1}
	if _, err := f.pm.AnswerPoll(ctx, first); !errors.Is(err, ErrAlreadyAnswered) {
		t.Fatalf("got %v", err)
	}
	count, err := f.pm.CountPoll(ctx, keep.ID)
	if err != nil || count.Answered != 1 || count.Choices[0].Votes != 1 || count.Choices[1].Votes != 0 {
		t.Fatalf("%+v %v", count, err)
	}

	change := f.poll(t, func(p *Poll) { p.ChangeAllowed = true })
	changeChoices, _ := f.pm.ListChoices(ctx, change.ID)
	a := Answer{PollID: change.ID, AnsweredBy: "amina", Votes: map[string]int{changeChoices[0].ID: 1}}
	firstPart, err := f.pm.AnswerPoll(ctx, a)
	if err != nil {
		t.Fatal(err)
	}
	a.Votes = map[string]int{changeChoices[2].ID: 1}
	secondPart, err := f.pm.AnswerPoll(ctx, a)
	if err != nil {
		t.Fatal(err)
	}
	if secondPart.ID != firstPart.ID {
		t.Fatalf("a changed answer is a new response: %q vs %q", firstPart.ID, secondPart.ID)
	}
	count, err = f.pm.CountPoll(ctx, change.ID)
	if err != nil || count.Answered != 1 || count.Choices[0].Votes != 0 || count.Choices[2].Votes != 1 {
		t.Fatalf("%+v %v", count, err)
	}
}

func TestEachGroupCountsOnceWhenThePollAsksPerGroup(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.PerGroup = "per_group"; p.GroupIDs = []string{"ward-a", "ward-b"} })
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	votes := map[string]int{choices[0].ID: 1}
	for _, c := range []struct {
		name  string
		group string
		want  error
	}{
		{"no group named", "", ErrNotInPollGroups},
		{"a group the poll does not go to", "ward-z", ErrNotInPollGroups},
		{"a group the caller is not in", "ward-c", ErrNotInPollGroups},
	} {
		if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "otieno", GroupID: c.group, Votes: votes}); !errors.Is(err, c.want) {
			t.Fatalf("%s: got %v", c.name, err)
		}
	}
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "otieno", GroupID: "ward-a", Votes: votes}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "otieno", GroupID: "ward-b", Votes: votes}); err != nil {
		t.Fatalf("the second group's own answer: %v", err)
	}
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "otieno", GroupID: "ward-b", Votes: votes}); !errors.Is(err, ErrAlreadyAnswered) {
		t.Fatalf("got %v", err)
	}
	res, err := f.pm.ListResponses(ctx, p.ID)
	if err != nil || len(res.Items) != 2 {
		t.Fatalf("%+v %v", res, err)
	}
}

func TestQuadraticVotesCountAtTheirWeightWithinTheBudget(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.Mode, p.Budget = "quadratic", 10 })
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: "amina", Votes: map[string]int{choices[0].ID: 3, choices[1].ID: 1}}); err != nil {
		t.Fatal(err)
	}
	count, err := f.pm.CountPoll(ctx, p.ID)
	if err != nil || count.Choices[0].Votes != 3 || count.Choices[1].Votes != 1 || count.Choices[2].Votes != 0 {
		t.Fatalf("%+v %v", count, err)
	}
}

func TestResponsesListEveryoneOrOnlyTheCallersOwn(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.GroupIDs = []string{"ward-a"} })
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	for i, who := range []string{"amina", "otieno"} {
		f.now = f.now.Add(time.Minute)
		if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: who, Votes: map[string]int{choices[i].ID: 1}}); err != nil {
			t.Fatal(err)
		}
	}
	all, err := f.pm.ListResponses(ctx, p.ID)
	if err != nil || len(all.Items) != 2 || all.Items[0].AnsweredBy != "amina" || all.Items[1].AnsweredBy != "otieno" {
		t.Fatalf("%+v %v", all, err)
	}
	own, err := f.pm.ReadOwnResponses(ctx, p.ID, "otieno")
	if err != nil || len(own.Items) != 1 || own.Items[0].Votes[choices[1].ID] != 1 {
		t.Fatalf("%+v %v", own, err)
	}
	none, err := f.pm.ReadOwnResponses(ctx, p.ID, "stranger")
	if err != nil || len(none.Items) != 0 {
		t.Fatalf("%+v %v", none, err)
	}
	if _, err := f.pm.ReadOwnResponses(ctx, p.ID, ""); !errors.Is(err, ErrNoReader) {
		t.Fatalf("got %v", err)
	}
	if _, err := f.pm.ListResponses(ctx, "nowhere"); !errors.Is(err, ErrPollNotFound) {
		t.Fatalf("got %v", err)
	}
}

func TestAResultIsPublishedOnlyToTheGroupsNamedAndReadOnlyByThem(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) { p.GroupIDs = []string{"ward-a", "ward-b"} })
	if _, err := f.pm.PublishResult(ctx, Publication{PollID: p.ID, GroupIDs: []string{"ward-a"}}); !errors.Is(err, ErrNoPublisher) {
		t.Fatalf("got %v", err)
	}
	if _, err := f.pm.PublishResult(ctx, Publication{PollID: p.ID, PublishedBy: "clerk"}); !errors.Is(err, ErrInvalidPublication) {
		t.Fatalf("got %v", err)
	}
	if _, err := f.pm.PublishResult(ctx, Publication{PollID: "nowhere", PublishedBy: "clerk", GroupIDs: []string{"ward-a"}}); !errors.Is(err, ErrPollNotFound) {
		t.Fatalf("got %v", err)
	}
	if _, err := f.pm.ReadPublishedCount(ctx, p.ID, "amina"); !errors.Is(err, ErrPollNotFound) {
		t.Fatalf("an unpublished result was readable: %v", err)
	}
	published, err := f.pm.PublishResult(ctx, Publication{PollID: p.ID, PublishedBy: "clerk", GroupIDs: []string{"ward-b"}})
	if err != nil {
		t.Fatal(err)
	}
	if published.PublishedBy != "clerk" || published.PublishedAt == "" || len(published.PublishedGroupIDs) != 1 || published.PublishedGroupIDs[0] != "ward-b" {
		t.Fatalf("%+v", published)
	}
	if _, err := f.pm.ReadPublishedCount(ctx, p.ID, ""); !errors.Is(err, ErrNoReader) {
		t.Fatalf("got %v", err)
	}
	if _, err := f.pm.ReadPublishedCount(ctx, p.ID, "amina"); !errors.Is(err, ErrPollNotFound) {
		t.Fatalf("a group the result was not published to read it: %v", err)
	}
	count, err := f.pm.ReadPublishedCount(ctx, p.ID, "otieno")
	if err != nil {
		t.Fatal(err)
	}
	if count.AnsweredSuppressed || count.Answered != 0 || count.Minimum != DefaultMinimumCount || len(count.Choices) != 3 {
		t.Fatalf("a poll nobody answered reads as zero against the minimum: %+v", count)
	}
}

func TestAFewAnswersAreWithheldFromAPublishedCount(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, nil)
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	for i := 0; i < DefaultMinimumCount-1; i++ {
		who := fmt.Sprintf("resident-%d", i)
		f.pm.UseGroups(func(context.Context, string) ([]string, error) { return []string{"ward-a"}, nil })
		if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: who, Votes: map[string]int{choices[0].ID: 1}}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := f.pm.PublishResult(ctx, Publication{PollID: p.ID, PublishedBy: "clerk", GroupIDs: []string{"ward-a"}}); err != nil {
		t.Fatal(err)
	}
	count, err := f.pm.ReadPublishedCount(ctx, p.ID, "resident-0")
	if err != nil {
		t.Fatal(err)
	}
	if !count.AnsweredSuppressed || count.Answered != 0 {
		t.Fatalf("%+v", count)
	}
	for _, c := range count.Choices {
		if !c.Suppressed || c.Votes != 0 {
			t.Fatalf("%+v", c)
		}
	}
}

func TestAPublishedCountShowsTotalsOnceEveryChoiceClearsTheMinimum(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	p := f.poll(t, func(p *Poll) {
		p.GroupIDs = []string{"ward-a"}
		p.Choices = []Choice{{Label: "Mill Street"}, {Label: "Orchard Lane"}}
	})
	choices, _ := f.pm.ListChoices(ctx, p.ID)
	for i := 0; i < 2*DefaultMinimumCount; i++ {
		who := fmt.Sprintf("resident-%d", i)
		f.pm.UseGroups(func(context.Context, string) ([]string, error) { return []string{"ward-a"}, nil })
		if _, err := f.pm.AnswerPoll(ctx, Answer{PollID: p.ID, AnsweredBy: who, Votes: map[string]int{choices[i%2].ID: 1}}); err != nil {
			t.Fatalf("answer %d: %v", i, err)
		}
	}
	if _, err := f.pm.PublishResult(ctx, Publication{PollID: p.ID, PublishedBy: "clerk", GroupIDs: []string{"ward-a"}}); err != nil {
		t.Fatal(err)
	}
	count, err := f.pm.ReadPublishedCount(ctx, p.ID, "resident-0")
	if err != nil {
		t.Fatal(err)
	}
	if count.AnsweredSuppressed || count.Answered != 2*DefaultMinimumCount || count.Choices[0].Votes != DefaultMinimumCount || count.Choices[1].Votes != DefaultMinimumCount {
		t.Fatalf("%+v", count)
	}
}

func TestCheckRefusesWhatTheDeclaredObjectsCannotHold(t *testing.T) {
	s, err := SpecFor("cover")
	if err != nil {
		t.Fatal(err)
	}
	if err := Check(s, "no_such_object", Poll{}); err == nil || !strings.Contains(err.Error(), "no_such_object") {
		t.Fatalf("got %v", err)
	}
	if err := Check(s, ObjectPoll, "not a struct"); err == nil || !strings.Contains(err.Error(), "want a struct") {
		t.Fatalf("got %v", err)
	}
	if err := Check(s, ObjectPoll, &Poll{Question: "", Mode: "one", PerGroup: "once", CreatedBy: "clerk"}); err == nil {
		t.Fatal("an empty question passed Check through a pointer")
	}
	if err := Check(s, ObjectChoice, Choice{PollID: "p1", Label: "Mill Street"}); err != nil {
		t.Fatalf("a good choice was refused: %v", err)
	}
}

func TestAScopedRunManagerAnswersFromItsOwnRows(t *testing.T) {
	f := newPolls(t)
	ctx := context.Background()
	scoped, err := f.pm.ForRun("run-1")
	if err != nil {
		t.Skipf("this schema has no run scoping: %v", err)
	}
	if scoped == PollManager(f.pm) {
		t.Fatal("ForRun returned the same manager")
	}
	p := f.poll(t, nil)
	if _, err := scoped.GetPoll(ctx, p.ID); err == nil {
		t.Fatal("a run saw a poll made outside it")
	}
}
