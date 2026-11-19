package http

import (
	"context"
	"errors"
	"testing"

	catalog "github.com/aosanya/mwanachama-backend-catalog"
	formsmodels "github.com/aosanya/mwanachama-backend-forms/models"
)

type fixedForms map[string]bool

func (f fixedForms) Get(_ context.Context, id string) (formsmodels.Form, error) {
	if f[id] {
		return formsmodels.Form{}, nil
	}
	return formsmodels.Form{}, errors.New("not found")
}

type recordingCatalog struct {
	catalog.CatalogManager
	written []catalog.Entry
}

func (r *recordingCatalog) UpsertEntry(_ context.Context, e catalog.Entry) (catalog.Entry, error) {
	r.written = append(r.written, e)
	return e, nil
}

func (r *recordingCatalog) UpdateEntry(_ context.Context, e catalog.Entry) (catalog.Entry, error) {
	r.written = append(r.written, e)
	return e, nil
}

func TestAnEntryNamingAFormThatIsNotAFormIsRefusedAndARealOneIsWritten(t *testing.T) {
	inner := &recordingCatalog{}
	cm := formChecked{CatalogManager: inner, forms: fixedForms{"real": true}}
	ctx := context.Background()
	for name, e := range map[string]catalog.Entry{
		"field": {Slug: "a", FormID: "ghost"},
		"doc":   {Slug: "b", Doc: `{"form_id":"ghost"}`},
	} {
		if _, err := cm.UpsertEntry(ctx, e); !errors.Is(err, catalog.ErrInvalidEntry) {
			t.Fatalf("%s upsert: %v", name, err)
		}
		if _, err := cm.UpdateEntry(ctx, e); !errors.Is(err, catalog.ErrInvalidEntry) {
			t.Fatalf("%s update: %v", name, err)
		}
	}
	if len(inner.written) != 0 {
		t.Fatalf("a refused entry reached the catalog: %+v", inner.written)
	}
	if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: "c", FormID: "real"}); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: "d"}); err != nil {
		t.Fatal(err)
	}
	if len(inner.written) != 2 {
		t.Fatalf("written: %+v", inner.written)
	}
}

type recordedSubmissions struct {
	asked []string
	sent  []formsmodels.Submission
}

func (r *recordedSubmissions) ListSubmissions(_ context.Context, formID, memberID, periodKey, _ string) ([]formsmodels.Submission, error) {
	r.asked = append(r.asked, formID+"/"+memberID+"/"+periodKey)
	return r.sent, nil
}

func TestTheCallersSubmissionsForAnEntryAreThoseOfItsFormOnly(t *testing.T) {
	forms := &recordedSubmissions{sent: []formsmodels.Submission{{ID: "s1", FormID: "f1", MemberID: "m1"}}}
	got, err := entrySubmissionsOf(context.Background(), catalog.Entry{Slug: "permit", FormID: "f1"}, forms, "m1")
	if err != nil || len(got) != 1 || got[0].ID != "s1" {
		t.Fatalf("%+v %v", got, err)
	}
	if len(forms.asked) != 1 || forms.asked[0] != "f1/m1/" {
		t.Fatalf("asked %v", forms.asked)
	}
	forms.asked = nil
	none, err := entrySubmissionsOf(context.Background(), catalog.Entry{Slug: "fee", Doc: `{"kind":"fee"}`}, forms, "m1")
	if err != nil || none == nil || len(none) != 0 || len(forms.asked) != 0 {
		t.Fatalf("an entry with no form: %+v %v asked %v", none, err, forms.asked)
	}
	fromDoc, err := entrySubmissionsOf(context.Background(), catalog.Entry{Slug: "licence", Doc: `{"form_id":"f2"}`}, forms, "m1")
	if err != nil || len(fromDoc) != 1 || forms.asked[0] != "f2/m1/" {
		t.Fatalf("form from the document: %+v %v asked %v", fromDoc, err, forms.asked)
	}
}
