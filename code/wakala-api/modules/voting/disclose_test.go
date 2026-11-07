package voting

import (
	"context"
	"testing"
)

func count(answered int, votes ...int) Count {
	c := Count{PollID: "p", Answered: answered}
	for i, v := range votes {
		c.Choices = append(c.Choices, ChoiceCount{ChoiceID: string(rune('a' + i)), Position: i, Votes: v})
	}
	return c
}

func TestSmallRunHidesEverything(t *testing.T) {
	got, err := Disclose(count(3, 2, 1), 5)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range got.Choices {
		if !c.Suppressed || c.Votes != 0 {
			t.Fatalf("%+v", c)
		}
	}
	if !got.AnsweredSuppressed || got.Answered != 0 {
		t.Fatalf("answered leaked: %+v", got)
	}
}

func TestSmallChoiceNeverShownAndTotalWithheld(t *testing.T) {
	got, err := Disclose(count(20, 12, 6, 2), 5)
	if err != nil {
		t.Fatal(err)
	}
	if got.Choices[0].Suppressed && got.Choices[1].Suppressed && got.Choices[2].Suppressed {
		t.Fatal("everything hidden")
	}
	for _, c := range got.Choices {
		if c.Suppressed && c.Votes != 0 {
			t.Fatalf("suppressed choice leaks %d", c.Votes)
		}
		if !c.Suppressed && c.Votes < 5 {
			t.Fatalf("small count shown: %+v", c)
		}
	}
	if !got.Choices[2].Suppressed {
		t.Fatal("2 votes shown")
	}
	hidden := 0
	for _, c := range got.Choices {
		if c.Suppressed {
			hidden++
		}
	}
	if hidden < 2 {
		t.Fatal("lone suppression is recoverable")
	}
	if !got.AnsweredSuppressed {
		t.Fatal("answered would reveal the hidden votes")
	}
}

func TestLargeCountsPassThrough(t *testing.T) {
	got, err := Disclose(count(17, 12, 5), 5)
	if err != nil {
		t.Fatal(err)
	}
	if got.Choices[0].Votes != 12 || got.Choices[1].Votes != 5 || got.Answered != 17 || got.AnsweredSuppressed {
		t.Fatalf("%+v", got)
	}
}

func TestMinimumBelowTwoIsRejected(t *testing.T) {
	if _, err := Disclose(count(10, 10), 1); err == nil {
		t.Fatal("accepted")
	}
}

func TestSetMinimumCountOnManager(t *testing.T) {
	sp, err := SpecFor("test")
	if err != nil {
		t.Fatal(err)
	}
	m := &pollManager{spec: sp}
	if n, err := m.minimumCount(context.Background()); err != nil || n != DefaultMinimumCount {
		t.Fatal("default")
	}
	if err := SetMinimumCount(m, 8); err != nil {
		t.Fatal("set")
	}
	if n, err := m.minimumCount(context.Background()); err != nil || n != 8 {
		t.Fatal("set")
	}
	if err := SetMinimumCount(m, 1); err == nil {
		t.Fatal("accepted 1")
	}
}
