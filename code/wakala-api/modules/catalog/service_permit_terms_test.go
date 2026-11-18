package mwanachamacatalog_test

import (
	"errors"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

func fenceEntry(t *testing.T, terms catalog.ServiceTerms) catalog.Entry {
	t.Helper()
	e, err := catalog.ServiceEntry("fence-permit", "Fence permit", "Build or change a fence", terms)
	if err != nil {
		t.Fatalf("ServiceEntry: %v", err)
	}
	return e
}

func TestAPermitWithNoneOfTheThreeTermsReadsBackNoInspectorNoFeeAndThirtyDays(t *testing.T) {
	got, err := catalog.ServiceTermsOf(catalog.Entry{Doc: `{"form":"terrace-licence","opens":"form"}`})
	if err != nil {
		t.Fatalf("ServiceTermsOf: %v", err)
	}
	if got.InspectorRole != "" || got.FeeAmount != nil || got.DaysUntilDue == nil || *got.DaysUntilDue != 30 {
		t.Fatalf("terms = %+v, want none, none, 30", got)
	}
}

func TestThePlanningOfficerFifteenThousandForintsAndFourteenDaysReadBack(t *testing.T) {
	fee, days := 15000, 14
	e := fenceEntry(t, catalog.ServiceTerms{Form: "fence-permit", Opens: catalog.ServiceOpensForm, InspectorRole: "Planning officer", FeeAmount: &fee, DaysUntilDue: &days})
	got, err := catalog.ServiceTermsOf(e)
	if err != nil {
		t.Fatalf("ServiceTermsOf: %v", err)
	}
	if got.InspectorRole != "Planning officer" || got.FeeAmount == nil || *got.FeeAmount != 15000 || got.DaysUntilDue == nil || *got.DaysUntilDue != 14 {
		t.Fatalf("terms = %+v", got)
	}
}

func TestADaysValueBelowOneIsRefused(t *testing.T) {
	for _, days := range []int{0, -3} {
		d := days
		_, err := catalog.ServiceEntry("fence-permit", "Fence permit", "", catalog.ServiceTerms{Form: "fence-permit", Opens: catalog.ServiceOpensForm, DaysUntilDue: &d})
		if !errors.Is(err, catalog.ErrInvalidServiceTerms) {
			t.Errorf("days %d: %v, want ErrInvalidServiceTerms", days, err)
		}
	}
}

func TestANegativeFeeIsRefusedAndAFeeOfZeroForintsIsNotAFee(t *testing.T) {
	negative := -1
	if _, err := catalog.ServiceEntry("fence-permit", "Fence permit", "", catalog.ServiceTerms{Form: "fence-permit", Opens: catalog.ServiceOpensForm, FeeAmount: &negative}); !errors.Is(err, catalog.ErrInvalidServiceTerms) {
		t.Errorf("negative fee: %v, want ErrInvalidServiceTerms", err)
	}
}

func TestAnOldPermitDocumentWithTheFreeTextFeeStillReadsAndSaves(t *testing.T) {
	e := catalog.Entry{Slug: "terrace-licence", Name: "Terrace licence", Doc: `{"fee":"about 5 000 Ft","form":"terrace-licence","opens":"form"}`}
	got, err := catalog.ServiceTermsOf(e)
	if err != nil || got.Fee != "about 5 000 Ft" {
		t.Fatalf("ServiceTermsOf = %+v %v", got, err)
	}
	if _, err := got.Doc(); err != nil {
		t.Fatalf("Doc: %v", err)
	}
}

func TestTheRefusalNamesTheTermThatIsWrong(t *testing.T) {
	zero, negative := 0, -5
	_, err := catalog.ServiceEntry("fence-permit", "Fence permit", "", catalog.ServiceTerms{Form: "fence-permit", Opens: catalog.ServiceOpensForm, DaysUntilDue: &zero})
	if err == nil || !strings.Contains(err.Error(), "days until due") {
		t.Errorf("days: %v, want a message naming days until due", err)
	}
	_, err = catalog.ServiceEntry("fence-permit", "Fence permit", "", catalog.ServiceTerms{Form: "fence-permit", Opens: catalog.ServiceOpensForm, FeeAmount: &negative})
	if err == nil || !strings.Contains(err.Error(), "fee amount") {
		t.Errorf("fee: %v, want a message naming the fee amount", err)
	}
}
