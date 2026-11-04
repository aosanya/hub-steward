package shopauth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

var ErrNoProject = errors.New("shopauth: no project is configured")

var ErrRateLimited = errors.New("shopauth: the project is refusing to send more links for now")

func (v Verifier) Configured() bool {
	return v.URL != "" && v.AnonKey != ""
}

func (v Verifier) SendMagicLink(ctx context.Context, email, redirectTo string) error {
	if !v.Configured() {
		return ErrNoProject
	}
	body, err := json.Marshal(map[string]any{"email": email, "create_user": false})
	if err != nil {
		return err
	}
	endpoint := strings.TrimRight(v.URL, "/") + "/auth/v1/otp?" + url.Values{"redirect_to": {redirectTo}}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", v.AnonKey)
	req.Header.Set("Authorization", "Bearer "+v.AnonKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := v.client().Do(req)
	if err != nil {
		return errors.New("could not reach the project's sign-in")
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode/100 == 2:
		return nil
	case res.StatusCode == http.StatusTooManyRequests:
		return ErrRateLimited
	default:
		return fmt.Errorf("the project's sign-in answered %d", res.StatusCode)
	}
}
