package mwanachamaactor

import (
	"context"

	"wakalaserver/modules/actor/models"
)

func (m *userManager) AttributeProperties(ctx context.Context) ([]models.Property, error) {
	return models.DefaultActorProperties(), nil
}
