package main

import (
	"log/slog"
	"os"
	"strings"

	apihttp "wakalaserver/internal/api/http"
	"wakalaserver/internal/invitemail"
)

const defaultMisuseAddress = "abuse@mwanachama.com"

func invitationMailFrom(get func(string) string) *apihttp.InvitationMail {
	smtp := invitemail.SMTP{
		Addr:     strings.TrimSpace(get("INVITATION_SMTP_ADDR")),
		User:     strings.TrimSpace(get("INVITATION_SMTP_USER")),
		Password: get("INVITATION_SMTP_PASSWORD"),
		From:     strings.TrimSpace(get("INVITATION_MAIL_FROM")),
	}
	if !smtp.Configured() {
		return nil
	}
	misuse := strings.TrimSpace(get("INVITATION_MISUSE_ADDRESS"))
	if misuse == "" {
		misuse = defaultMisuseAddress
	}
	return &apihttp.InvitationMail{
		Sender:          smtp,
		Misuse:          misuse,
		FallbackContact: strings.TrimSpace(get("INVITATION_CONTACT_FALLBACK")),
	}
}

func invitationMail(logger *slog.Logger) *apihttp.InvitationMail {
	mail := invitationMailFrom(os.Getenv)
	if mail == nil {
		logger.Info("invitation emails go through the identity project's one sign-in template",
			"fix", "set INVITATION_SMTP_ADDR and INVITATION_MAIL_FROM to send an email that names the agency and its inviter")
		return nil
	}
	logger.Info("invitation emails are sent by this service", "misuse", mail.Misuse)
	return mail
}
