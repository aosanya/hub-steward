package reviewruns

import (
	"context"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type starterRecorder struct {
	mwanachamaagency.AgencyManager
	startedBy string
}

func (s *starterRecorder) StartReview(_ context.Context, _, by, _ string) (agencymodels.ReviewView, error) {
	s.startedBy = by
	return agencymodels.ReviewView{Review: &agencymodels.Review{ID: "rv1", StartedBy: by}}, nil
}

func TestTheRunnersStartCarriesTheStarterTheServiceWasGiven(t *testing.T) {
	recorder := &starterRecorder{}
	tools := CallerTools{Agency: func(context.Context, string) (mwanachamaagency.AgencyManager, error) { return recorder, nil }}
	page, err := tools.StartReview(context.Background(), "i1", "d1", "amina", "")
	if err != nil {
		t.Fatalf("StartReview: %v", err)
	}
	if recorder.startedBy != "amina" || page.Review == nil || page.Review.StartedBy != "amina" {
		t.Errorf("the review was started by %q and the page names %+v; want amina", recorder.startedBy, page.Review)
	}
}
