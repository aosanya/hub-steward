package shopauth

import (
	"context"
	"net/http"
	"strings"
)

func (v Verifier) UserEmail(ctx context.Context, token string) string {
	if token == "" || !v.Configured() {
		return ""
	}
	var user struct {
		Email string `json:"email"`
	}
	code, err := v.call(ctx, http.MethodGet, "/auth/v1/user", token, &user)
	if err != nil || code != http.StatusOK {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(user.Email))
}
