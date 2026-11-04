package http

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/invitemail"
	"wakalaserver/internal/shopauth"
)

type InvitationMail struct {
	Sender          invitemail.Sender
	Misuse          string
	FallbackContact string
}

func (c *InvitationMail) ready() bool {
	return c != nil && c.Sender != nil
}

func (m memberInvitations) deliver(r *http.Request, instanceID, email, redirect string) {
	if !m.mail.ready() {
		m.links.sendReserved(email, redirect)
		return
	}
	message := invitemail.Compose(m.mail.describe(r, m.reg, m.links.project, instanceID, email, redirect))
	m.links.sendMailReserved(m.mail.Sender, message)
}

func (c *InvitationMail) describe(r *http.Request, reg agencies.Registry, project shopauth.Verifier, instanceID, email, redirect string) invitemail.Invitation {
	ctx := r.Context()
	caller := accounts.IDFromContext(ctx)
	in := invitemail.Invitation{Recipient: email, OpenURL: redirect, Misuse: c.Misuse}
	if instance, err := reg.GetInstance(ctx, instanceID); err == nil {
		in.Agency = instance.Name
	}
	if role, err := reg.RoleOf(ctx, instanceID, caller); err == nil {
		in.SenderRole = role
	}
	if token, ok := bearerToken(r); ok {
		in.Contact = project.UserEmail(ctx, token)
	}
	if in.Contact == "" {
		in.Contact = c.FallbackContact
	}
	if in.Contact == "" {
		in.Contact = c.Misuse
	}
	in.Sender = inviterName(ctx, reg, instanceID, caller, in.Contact)
	return in
}

func inviterName(ctx context.Context, reg agencies.Registry, instanceID, caller, contact string) string {
	directory, err := reg.ActorManager(ctx, instanceID)
	if err == nil {
		if held, err := directory.GetActor(ctx, caller); err == nil {
			if full := strings.TrimSpace(held.FirstName + " " + held.LastName); full != "" {
				return full
			}
			if strings.TrimSpace(held.DisplayName) != "" {
				return held.DisplayName
			}
		}
	}
	if contact != "" {
		return contact
	}
	return "An operator"
}

func (s *magicLinkSender) sendMailReserved(sender invitemail.Sender, message invitemail.Message) {
	go func() {
		defer s.release()
		ctx, cancel := context.WithTimeout(context.Background(), magicLinkSendTimeout)
		defer cancel()
		if err := sender.Send(ctx, message); err != nil {
			slog.Default().Warn("a member invitation email was not sent", "error", err.Error())
		}
	}()
}
