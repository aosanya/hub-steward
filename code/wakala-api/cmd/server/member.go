package main

import (
	"log/slog"
	"os"
	"strings"

	"gorm.io/gorm"
	mwanachamaauth "wakalaserver/modules/auth"

	apihttp "wakalaserver/internal/api/http"
	"wakalaserver/internal/provision"
)

func memberOrigins(logger *slog.Logger) []string {
	origins, rejected := apihttp.MemberOriginsFrom(os.Getenv("MEMBER_APP_ORIGINS"))
	if len(rejected) > 0 {
		logger.Warn("ignored entries in MEMBER_APP_ORIGINS that are not origins",
			"entries", strings.Join(rejected, ","),
			"fix", "list each member app origin as scheme://host[:port], comma-separated")
	}
	if len(origins) == 0 {
		logger.Warn("no member app origin is allowed",
			"effect", "POST /auth/magic-link answers 503 and no member app can call this API from a browser",
			"fix", "set MEMBER_APP_ORIGINS")
	} else {
		logger.Info("member app origins allowed", "origins", strings.Join(origins, ","))
	}
	return origins
}

func identityAccounts(logger *slog.Logger, db *gorm.DB) apihttp.MemberAccounts {
	sqlDB, err := db.DB()
	if err != nil {
		logger.Warn("member invitations are off", "error", err.Error())
		return nil
	}
	logger.Info("member invitations create accounts through " + provision.InviteFunction)
	return provision.IdentityAccounts{DB: sqlDB}
}

func identitySessions(logger *slog.Logger, db *gorm.DB) (apihttp.MemberSessions, apihttp.MemberSessionsSeen) {
	sqlDB, err := db.DB()
	if err != nil {
		logger.Warn("member sessions are off", "error", err.Error())
		return nil, nil
	}
	logger.Info("member sessions are read, ended and marked seen through " + mwanachamaauth.ListSignInSessionsFunc + ", " + mwanachamaauth.EndSignInSessionFunc + " and " + mwanachamaauth.TouchSignInSessionFunc)
	sessions := mwanachamaauth.IdentitySessions{DB: sqlDB}
	return sessions, &mwanachamaauth.LastSeen{Sessions: sessions}
}
