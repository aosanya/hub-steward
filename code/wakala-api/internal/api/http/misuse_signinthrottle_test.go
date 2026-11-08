package http

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	mwanachamaauth "wakalaserver/modules/auth"
	authmodels "wakalaserver/modules/auth/models"

	"wakalaserver/internal/session"
)

type throttleFakeRepo struct {
	email string
	hash  string
}

func (f throttleFakeRepo) Verifier(ctx context.Context, email string) (authmodels.OperatorCredential, string, error) {
	if email != f.email {
		return authmodels.OperatorCredential{}, "", authmodels.ErrOperatorNotFound
	}
	return authmodels.OperatorCredential{SubjectID: "subject-one", Email: f.email}, f.hash, nil
}

func (f throttleFakeRepo) Create(ctx context.Context, c authmodels.OperatorCredential, hash string) (authmodels.OperatorCredential, error) {
	return authmodels.OperatorCredential{}, nil
}
func (f throttleFakeRepo) Get(ctx context.Context, id string) (authmodels.OperatorCredential, error) {
	return authmodels.OperatorCredential{}, authmodels.ErrOperatorNotFound
}
func (f throttleFakeRepo) ListForSubject(ctx context.Context, subjectID string) ([]authmodels.OperatorCredential, error) {
	return nil, nil
}
func (f throttleFakeRepo) SetPassword(ctx context.Context, id, hash string) error { return nil }
func (f throttleFakeRepo) Disable(ctx context.Context, id string) error           { return nil }
func (f throttleFakeRepo) Attempt(ctx context.Context, email string) (authmodels.OperatorAttempt, error) {
	return authmodels.OperatorAttempt{}, nil
}
func (f throttleFakeRepo) RecordFailure(ctx context.Context, email string, now time.Time, lockFor time.Duration) (authmodels.OperatorAttempt, error) {
	return authmodels.OperatorAttempt{}, nil
}
func (f throttleFakeRepo) ClearAttempts(ctx context.Context, email string) error { return nil }

type throttleFakeSessions struct{}

func (throttleFakeSessions) Mint(ctx context.Context, memberID string, ttl time.Duration) (session.Session, error) {
	return session.Session{Token: "tok", MemberID: memberID, ExpiresAt: time.Now().Add(ttl)}, nil
}
func (throttleFakeSessions) Verify(ctx context.Context, token string) (session.Session, error) {
	return session.Session{}, nil
}
func (throttleFakeSessions) Revoke(ctx context.Context, token string) error { return nil }

func postSignIn(h http.HandlerFunc, email, password string) *httptest.ResponseRecorder {
	body := `{"email":"` + email + `","password":"` + password + `"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/signin", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.1:5555"
	rec := httptest.NewRecorder()
	h(rec, req)
	return rec
}

func TestSignIn_GuesserCannotDoSignInAfterTooManyWrongPasswords(t *testing.T) {
	const email = "x@example.test"
	const good = "right-password-123!"
	hash, err := mwanachamaauth.Hash(good)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}

	admitted := signIn(throttleFakeRepo{email: email, hash: hash}, throttleFakeSessions{}, CookieConfig{})
	if rec := postSignIn(admitted, email, good); rec.Code != http.StatusCreated {
		t.Fatalf("correct password on a fresh sign-in: %d %s, want 201", rec.Code, rec.Body.String())
	}

	locked := signIn(throttleFakeRepo{email: email, hash: hash}, throttleFakeSessions{}, CookieConfig{})
	for i := 0; i < 5; i++ {
		postSignIn(locked, email, "wrong-guess")
	}
	if rec := postSignIn(locked, email, good); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("correct password after exhausting guesses: %d %s, want 429", rec.Code, rec.Body.String())
	}
}
