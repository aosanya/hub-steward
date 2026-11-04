package mwanachamacatalog

import (
	"context"

	"wakalaserver/modules/catalog/models"
)

type (
	ServiceTerms   = models.ServiceTerms
	ServiceOpening = models.ServiceOpening
)

const (
	ServiceOpensForm  = models.ServiceOpensForm
	ServiceOpensRaise = models.ServiceOpensRaise
)

var ErrInvalidServiceTerms = models.ErrInvalidServiceTerms

func ServiceTermsOf(e Entry) (ServiceTerms, error) {
	return models.ServiceTermsOf(e.Doc)
}

func ServiceEntry(slug, name, summary string, t ServiceTerms) (Entry, error) {
	doc, err := t.Doc()
	if err != nil {
		return Entry{}, err
	}
	return Entry{Slug: slug, Name: name, Summary: summary, Doc: doc}, nil
}

func WithServiceTerms(cm CatalogManager) CatalogManager {
	return serviceTermsChecked{CatalogManager: cm}
}

type serviceTermsChecked struct {
	CatalogManager
}

func (s serviceTermsChecked) CreateEntry(ctx context.Context, e Entry) (Entry, error) {
	if _, err := ServiceTermsOf(e); err != nil {
		return Entry{}, err
	}
	return s.CatalogManager.CreateEntry(ctx, e)
}

func (s serviceTermsChecked) UpsertEntry(ctx context.Context, e Entry) (Entry, error) {
	if _, err := ServiceTermsOf(e); err != nil {
		return Entry{}, err
	}
	return s.CatalogManager.UpsertEntry(ctx, e)
}

func (s serviceTermsChecked) UpdateEntry(ctx context.Context, e Entry) (Entry, error) {
	if _, err := ServiceTermsOf(e); err != nil {
		return Entry{}, err
	}
	return s.CatalogManager.UpdateEntry(ctx, e)
}
