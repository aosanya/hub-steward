package mwanachamaforms

import (
	"context"

	"wakalaserver/modules/forms/models"
)

func (m *formManager) ShowPublicLink(ctx context.Context, key string) (models.ResolvedLinkView, error) {
	opened, err := m.OpenPublicLink(ctx, key)
	if err != nil {
		return models.ResolvedLinkView{}, err
	}
	return opened.RespondentView(), nil
}
