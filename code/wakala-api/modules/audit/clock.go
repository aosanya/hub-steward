package mwanachamaaudit

import (
	"time"

	"wakalaserver/modules/shared/specstore"
)

type Clock func() time.Time

func SystemClock() time.Time { return time.Now().UTC() }

func formatTime(t time.Time) string { return t.UTC().Format(specstore.TimeLayout) }
