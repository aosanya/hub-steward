package http

import (
	"fmt"
	"net/http"
	"strings"
)

const (
	sameSiteLax    = "lax"
	sameSiteStrict = "strict"
	sameSiteNone   = "none"
)

func SameSiteFrom(raw string, secure bool) (string, error) {
	switch mode := strings.ToLower(strings.TrimSpace(raw)); mode {
	case "", sameSiteLax:
		return sameSiteLax, nil
	case sameSiteStrict:
		return sameSiteStrict, nil
	case sameSiteNone:
		if !secure {
			return "", fmt.Errorf("WAKALA_COOKIE_SAMESITE=none needs WAKALA_COOKIE_SECURE=true: a browser drops a SameSite=None cookie that is not Secure")
		}
		return sameSiteNone, nil
	default:
		return "", fmt.Errorf("WAKALA_COOKIE_SAMESITE=%q is not lax, strict or none", raw)
	}
}

func (c CookieConfig) sameSite() http.SameSite {
	switch c.SameSite {
	case sameSiteStrict:
		return http.SameSiteStrictMode
	case sameSiteNone:
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
