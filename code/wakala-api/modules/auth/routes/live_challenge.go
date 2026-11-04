package routes

import (
	"context"
	"time"

	mwanachamaauth "wakalaserver/modules/auth"
	"wakalaserver/modules/auth/models"
)

func liveChallenge(ctx context.Context, auth mwanachamaauth.AuthRepository, id string, now time.Time) (models.Challenge, error) {
	held, err := auth.GetChallenge(ctx, id)
	if err != nil {
		return models.Challenge{}, err
	}
	if held.Consumed {
		return models.Challenge{}, models.ErrAuthNotFound
	}
	if !now.Before(held.ExpiresAt) {
		return models.Challenge{}, models.ErrAuthChallengeExpired
	}
	return held, nil
}
