package http

import (
	"context"
	"errors"
	"testing"

	catalog "wakalaserver/modules/catalog"
	formsmodels "wakalaserver/modules/forms/models"
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
