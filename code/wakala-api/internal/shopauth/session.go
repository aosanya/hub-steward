package shopauth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

var ErrSessionEnded = errors.New("shopauth: the project no longer holds that session")

type Session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	ExpiresAt    int64  `json:"expires_at"`
}

func (v Verifier) RefreshSession(ctx context.Context, refreshToken string) (Session, error) {
	if !v.Configured() {
		return Session{}, ErrNoProject
	}
	if refreshToken == "" {
		return Session{}, ErrSessionEnded
	}
	body, err := json.Marshal(map[string]string{"refresh_token": refreshToken})
	if err != nil {
		return Session{}, err
	}
	endpoint := strings.TrimRight(v.URL, "/") + "/auth/v1/token?grant_type=refresh_token"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return Session{}, err
	}
	req.Header.Set("apikey", v.AnonKey)
	req.Header.Set("Authorization", "Bearer "+v.AnonKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := v.client().Do(req)
	if err != nil {
		return Session{}, errors.New("could not reach the project's sign-in")
	}
	defer res.Body.Close()
	if err := sessionAnswer(res.StatusCode); err != nil {
		return Session{}, err
	}
	if res.StatusCode != http.StatusOK {
		return Session{}, fmt.Errorf("the project's sign-in answered %d", res.StatusCode)
	}
	var s Session
	if err := json.NewDecoder(res.Body).Decode(&s); err != nil || s.AccessToken == "" || s.RefreshToken == "" {
		return Session{}, errors.New("the project's sign-in answered without a session")
	}
	return s, nil
}

func (v Verifier) EndSession(ctx context.Context, accessToken string) error {
	if !v.Configured() {
		return ErrNoProject
	}
	if accessToken == "" {
		return ErrSessionEnded
	}
	endpoint := strings.TrimRight(v.URL, "/") + "/auth/v1/logout?scope=local"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", v.AnonKey)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	res, err := v.client().Do(req)
	if err != nil {
		return errors.New("could not reach the project's sign-in")
	}
	defer res.Body.Close()
	return sessionAnswer(res.StatusCode)
}

func sessionAnswer(code int) error {
	switch {
	case code/100 == 2:
		return nil
	case code == http.StatusTooManyRequests:
		return ErrRateLimited
	case code == http.StatusBadRequest, code == http.StatusUnauthorized,
		code == http.StatusForbidden, code == http.StatusNotFound:
		return ErrSessionEnded
	default:
		return fmt.Errorf("the project's sign-in answered %d", code)
	}
}
