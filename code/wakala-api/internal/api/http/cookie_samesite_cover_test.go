package http

import (
	"net/http"
	"strings"
	"testing"
)

func TestSameSiteFromAcceptsTheThreeModesAndDefaultsToLax(t *testing.T) {
	cases := []struct {
		raw    string
		secure bool
		want   string
	}{
		{"", false, "lax"},
		{"  LAX ", false, "lax"},
		{"Strict", false, "strict"},
		{"none", true, "none"},
	}
	for _, c := range cases {
		got, err := SameSiteFrom(c.raw, c.secure)
		if err != nil || got != c.want {
			t.Fatalf("SameSiteFrom(%q,%v) = %q,%v want %q", c.raw, c.secure, got, err, c.want)
		}
	}
}

func TestSameSiteFromRefusesNoneWithoutSecureAndUnknownWords(t *testing.T) {
	if _, err := SameSiteFrom("none", false); err == nil || !strings.Contains(err.Error(), "WAKALA_COOKIE_SECURE=true") {
		t.Fatalf("none without secure must be refused naming the secure setting, got %v", err)
	}
	if _, err := SameSiteFrom("sideways", true); err == nil || !strings.Contains(err.Error(), `"sideways"`) {
		t.Fatalf("an unknown mode must be refused naming it, got %v", err)
	}
}

func TestCookieConfigMapsModeToBrowserSameSite(t *testing.T) {
	cases := map[string]http.SameSite{
		"strict": http.SameSiteStrictMode,
		"none":   http.SameSiteNoneMode,
		"lax":    http.SameSiteLaxMode,
		"":       http.SameSiteLaxMode,
	}
	for mode, want := range cases {
		if got := (CookieConfig{SameSite: mode}).sameSite(); got != want {
			t.Fatalf("mode %q gave %v want %v", mode, got, want)
		}
	}
}
