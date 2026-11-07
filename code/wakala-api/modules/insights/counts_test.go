package mwanachamainsights

import (
	"testing"

	"wakalaserver/modules/insights/models"
)

func many(subject string, n int) []models.Insight {
	out := make([]models.Insight, n)
	for i := range out {
		out[i] = models.Insight{SubjectID: subject, Summary: "s"}
	}
	return out
}

func TestSmallSubjectIsSuppressedWithCover(t *testing.T) {
	var in []models.Insight
	in = append(in, many("ward-a", 9)...)
	in = append(in, many("ward-b", 2)...)
	in = append(in, many("ward-c", 6)...)
	got, err := DiscloseBySubject(in, 5)
	if err != nil {
		t.Fatal(err)
	}
	hidden := 0
	for _, c := range got.Items {
		if c.Suppressed {
			hidden++
			if c.Count != 0 {
				t.Fatalf("%s leaks %d", c.SubjectID, c.Count)
			}
		}
	}
	if hidden < 2 {
		t.Fatalf("a lone suppressed cell is recoverable from the total, hidden = %d", hidden)
	}
	if got.TotalPublished && hidden == 2 && got.Total != 17 {
		t.Fatalf("total = %d", got.Total)
	}
}

func TestLargeSubjectsPublishedAsIs(t *testing.T) {
	got, err := DiscloseBySubject(append(many("ward-a", 7), many("ward-b", 5)...), 5)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range got.Items {
		if c.Suppressed || c.Count < 5 {
			t.Fatalf("%+v", c)
		}
	}
	if got.Total != 12 {
		t.Fatalf("total = %d", got.Total)
	}
}
