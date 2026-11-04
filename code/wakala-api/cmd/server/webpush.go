package main

import (
	"log/slog"
	"os"

	mwanachamacomm "wakalaserver/modules/comm"

	"wakalaserver/internal/agencies"
)

func webPushSender(getenv func(string) string) (mwanachamacomm.PushSender, error) {
	v, configured := mwanachamacomm.VAPIDFromEnv(getenv)
	if !configured {
		return nil, nil
	}
	sender, err := mwanachamacomm.NewWebPushSender(v, nil)
	if err != nil {
		return nil, err
	}
	return sender, nil
}

func webPush(logger *slog.Logger) agencies.Option {
	sender, err := webPushSender(os.Getenv)
	if err != nil {
		logger.Error("could not configure Web Push", "variables", "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT", "error", err.Error())
		os.Exit(1)
	}
	if sender == nil {
		logger.Info("Web Push is off", "reason", "neither VAPID_PUBLIC_KEY nor VAPID_PRIVATE_KEY is set")
		return agencies.WithWebPush(nil, nil)
	}
	logger.Info("Web Push is on")
	return agencies.WithWebPush(sender, func(err error) {
		logger.Warn("a Web Push was not delivered", "error", err.Error())
	})
}
