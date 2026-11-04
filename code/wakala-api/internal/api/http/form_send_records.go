package http

import (
	"context"
	"encoding/json"
	"errors"

	catalog "wakalaserver/modules/catalog"
	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
)

type formsCatalogs interface {
	CatalogManager(ctx context.Context, id, mount string) (catalog.CatalogManager, error)
}

type sendsRecorded struct {
	forms.FormManager
	catalogs   formsCatalogs
	instanceID string
}

func (s sendsRecorded) SubmitAnswersFor(ctx context.Context, formID, memberID, answeringAs, language, periodKey string, in []formsmodels.Answer) ([]formsmodels.Answer, error) {
	stored, err := s.FormManager.SubmitAnswersFor(ctx, formID, memberID, answeringAs, language, periodKey, in)
	if err != nil {
		return stored, err
	}
	return stored, s.record(ctx, formID, memberID, stored)
}

func (s sendsRecorded) record(ctx context.Context, formID, memberID string, stored []formsmodels.Answer) error {
	cm, err := s.catalogs.CatalogManager(ctx, s.instanceID, formsCatalogMount)
	if err != nil {
		return nil
	}
	doc, err := json.Marshal(countableAnswers(stored))
	if err != nil {
		return err
	}
	_, err = cm.PutRecord(ctx, catalog.Record{SubjectID: formID, HolderID: memberID, ScopeID: answeredThrough(stored), Doc: string(doc)})
	if errors.Is(err, catalog.ErrRecordsNotKept) {
		return nil
	}
	return err
}

func countableAnswers(stored []formsmodels.Answer) map[string]any {
	values := map[string]any{}
	for _, a := range stored {
		switch {
		case a.ValueBool != nil:
			values[a.QuestionID] = *a.ValueBool
		case a.ValueNumber != nil:
			values[a.QuestionID] = *a.ValueNumber
		case len(a.OptionIDs) > 0:
			values[a.QuestionID] = a.OptionIDs
		}
	}
	return values
}

func answeredThrough(stored []formsmodels.Answer) string {
	for _, a := range stored {
		if a.ChapterID != "" {
			return a.ChapterID
		}
	}
	return ""
}
