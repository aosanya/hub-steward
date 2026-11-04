package main

import (
	"log/slog"
	"os"
	"strings"

	apihttp "wakalaserver/internal/api/http"
)

func studioOrigins(logger *slog.Logger) []string {
	members, _ := apihttp.MemberOriginsFrom(os.Getenv("MEMBER_APP_ORIGINS"))
	origins, rejected, err := apihttp.CheckedStudioOrigins(os.Getenv("STUDIO_ORIGINS"), members)
	if err != nil {
		logger.Error("STUDIO_ORIGINS is not usable", "error", err.Error(), "fix", "list an origin under STUDIO_ORIGINS or MEMBER_APP_ORIGINS, never both")
		os.Exit(1)
	}
	if len(rejected) > 0 {
		logger.Warn("ignored entries in STUDIO_ORIGINS that are not origins",
			"entries", strings.Join(rejected, ","),
			"fix", "list each console origin as scheme://host[:port], comma-separated")
	}
	if len(origins) == 0 {
		logger.Info("no console origin is allowed", "effect", "a browser console on another origin cannot sign in or call /mcp", "fix", "set STUDIO_ORIGINS")
	} else {
		logger.Info("console origins allowed with credentials", "origins", strings.Join(origins, ","))
	}
	return origins
}

func cookieSecureFrom(env func(string) string) bool {
	switch env("WAKALA_COOKIE_SECURE") {
	case "true":
		return true
	case "false":
		return false
	}
	return env("WAKALA_DEV_MODE") != "true" && strings.HasPrefix(env("PUBLIC_BASE_URL"), "https://")
}

func sessionCookie(logger *slog.Logger) apihttp.CookieConfig {
	secure := cookieSecureFrom(os.Getenv)
	sameSite, err := apihttp.SameSiteFrom(os.Getenv("WAKALA_COOKIE_SAMESITE"), secure)
	if err != nil {
		logger.Error("the session cookie is not configured", "error", err.Error(), "fix", "set WAKALA_COOKIE_SAMESITE to lax, strict or none")
		os.Exit(1)
	}
	if sameSite == "none" {
		logger.Warn("the session cookie is SameSite=None",
			"effect", "a cross-site page can post to routes that ignore Content-Type with the member's session",
			"fix", "host the console on the same registrable domain as this API and set WAKALA_COOKIE_DOMAIN instead")
	}
	return apihttp.CookieConfig{
		Domain:   os.Getenv("WAKALA_COOKIE_DOMAIN"),
		Secure:   secure,
		SameSite: sameSite,
	}
}
