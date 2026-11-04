package main

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

const invitationLifetimeVar = "INVITATION_LIFETIME"

func parseInvitationLifetime(raw string) (time.Duration, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return mwanachamaactor.DefaultInvitationLifetime, nil
	}
	var d time.Duration
	if days, ok := strings.CutSuffix(raw, "d"); ok {
		n, err := strconv.Atoi(days)
		if err != nil {
			return 0, fmt.Errorf("%s=%q: want a whole number of days such as 14d, or a Go duration such as 336h", invitationLifetimeVar, raw)
		}
		d = time.Duration(n) * 24 * time.Hour
	} else {
		parsed, err := time.ParseDuration(raw)
		if err != nil {
			return 0, fmt.Errorf("%s=%q: want a whole number of days such as 14d, or a Go duration such as 336h", invitationLifetimeVar, raw)
		}
		d = parsed
	}
	if d <= 0 {
		return 0, fmt.Errorf("%s=%q: an invitation lifetime must be positive", invitationLifetimeVar, raw)
	}
	return d, nil
}

func invitationLifetime(logger *slog.Logger) agencies.Option {
	d, err := parseInvitationLifetime(os.Getenv(invitationLifetimeVar))
	if err != nil {
		logger.Error("could not read the invitation lifetime", "error", err.Error())
		os.Exit(1)
	}
	logger.Info("group invitations lapse after", "lifetime", d.String())
	return agencies.WithInvitationLifetime(d)
}
