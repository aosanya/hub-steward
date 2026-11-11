package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/provision"
)

const invitationAccepted = "an invitation is on its way to that address"

type MemberAccounts interface {
	Invite(ctx context.Context, email string) (string, error)
}

type memberInvitations struct {
	reg       agencies.Registry
	accounts  MemberAccounts
	links     *magicLinkSender
	residents residentGrants
	mail      *InvitationMail
	refused   func(ctx context.Context, instanceID, action string) bool
}

const (
	inviteOneAction   = "actor.invitation.create"
	inviteBatchAction = "actor.invitation.send_batch"
)

func (m memberInvitations) refuses(r *http.Request, instanceID, action string) bool {
	return m.refused != nil && m.refused(r.Context(), instanceID, action)
}

func (m memberInvitations) handle(w http.ResponseWriter, r *http.Request) {
	instanceID := r.PathValue("instanceID")
	if err := mustBeMember(r.Context(), m.reg, instanceID); err != nil {
		writeInstanceErr(w, err)
		return
	}
	if m.refuses(r, instanceID, inviteOneAction) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	var in linkRequest
	if err := readJSON(r, &in); err != nil {
		writeReadErr(w, err)
		return
	}
	email, redirect, ok := m.links.address(w, r, in)
	if !ok {
		return
	}
	if m.accounts == nil {
		writeErr(w, http.StatusServiceUnavailable, "member invitations are not configured")
		return
	}
	if !m.links.reserve(w) {
		return
	}
	userID, err := m.accounts.Invite(r.Context(), email)
	if errors.Is(err, provision.ErrInviteFunctionMissing) {
		m.links.release()
		slog.Default().Warn("a member invitation was refused",
			"error", err.Error(),
			"fix", "apply go run ./cmd/identitysql to the identity project, see member-invitations.md")
		writeErr(w, http.StatusServiceUnavailable, "member invitations are not configured")
		return
	}
	if err != nil {
		m.links.release()
		slog.Default().Error("a member account could not be created", "error", err.Error())
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := m.admit(r.Context(), instanceID, userID); err != nil {
		m.links.release()
		slog.Default().Error("an invited member could not be admitted", "instance", instanceID, "error", err.Error())
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	m.deliver(r, instanceID, email, redirect)
	writeJSON(w, http.StatusAccepted, map[string]string{"message": invitationAccepted})
}

func (m memberInvitations) admit(ctx context.Context, instanceID, userID string) error {
	role, err := m.reg.AdmitResident(ctx, instanceID, userID)
	if err != nil {
		return err
	}
	if err := adoptCallerAsActor(ctx, m.reg, instanceID, userID); err != nil {
		return err
	}
	if role != agencies.RoleResident {
		return nil
	}
	return m.residents.admit(ctx, instanceID, userID)
}

func registerMemberInviteRoutes(mux *http.ServeMux, auth callers, m memberInvitations) {
	mux.HandleFunc("POST /instances/{instanceID}/invitations", auth.require(m.handle))
	mux.HandleFunc("POST /instances/{instanceID}/invitations/batch", auth.require(m.handleBatch))
}
