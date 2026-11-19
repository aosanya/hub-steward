package agencies

import (
	"context"
	"reflect"
	"testing"

	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
)

func permitEntry(t *testing.T, slug, formID, inspector string) mwanachamacatalog.Entry {
	t.Helper()
	e, err := mwanachamacatalog.ServiceEntry(slug, slug, "", mwanachamacatalog.ServiceTerms{Form: slug, Opens: mwanachamacatalog.ServiceOpensForm, InspectorRole: inspector})
	if err != nil {
		t.Fatal(err)
	}
	e.FormID = formID
	return e
}

func TestThePlanningOfficerInspectsTheFencePermitFormAndNotTheTerraceLicenceOrAPermitWithNoInspector(t *testing.T) {
	permits := []mwanachamacatalog.Entry{
		permitEntry(t, "fence-permit", "form-fence", "Planning officer"),
		permitEntry(t, "terrace-licence", "form-terrace", "Market warden"),
		permitEntry(t, "sign-permit", "form-sign", ""),
	}
	held := func(context.Context, string) ([]string, error) { return []string{"Planning officer"}, nil }
	list := func(context.Context) ([]mwanachamacatalog.Entry, error) { return permits, nil }
	got, err := inspectorFormsFrom(held, list)(context.Background(), "anna")
	if err != nil || !reflect.DeepEqual(got, []string{"form-fence"}) {
		t.Fatalf("forms = %v (%v), want only the fence permit's form", got, err)
	}
}

func TestACallerHoldingNoRoleInspectsNothing(t *testing.T) {
	permits := []mwanachamacatalog.Entry{permitEntry(t, "fence-permit", "form-fence", "Planning officer")}
	held := func(context.Context, string) ([]string, error) { return nil, nil }
	list := func(context.Context) ([]mwanachamacatalog.Entry, error) { return permits, nil }
	got, err := inspectorFormsFrom(held, list)(context.Background(), "bela")
	if err != nil || len(got) != 0 {
		t.Fatalf("forms = %v (%v), want none", got, err)
	}
}
