package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const maxInvitationBatchRows = 500

type invitationBatchRequest struct {
	Rows       []mwanachamaactor.InvitationBatchRow `json:"rows"`
	RedirectTo string                               `json:"redirect_to"`
}

type invitationBatchAnswer struct {
	Results []mwanachamaactor.InvitationBatchResult `json:"results"`
}

func (m memberInvitations) handleBatch(w http.ResponseWriter, r *http.Request) {
	instanceID := r.PathValue("instanceID")
	um, role, err := actorManagerFor(r.Context(), m.reg, instanceID)
	if err == nil && role != agencies.RoleOwner && role != agencies.RoleAgent {
		err = agencies.ErrInstanceNotFound
	}
	if err != nil {
		writeInstanceErr(w, err)
		return
	}
	if m.refuses(r, instanceID, inviteBatchAction) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	var in invitationBatchRequest
	if err := readJSON(r, &in); err != nil {
		writeReadErr(w, err)
		return
	}
	if len(in.Rows) == 0 || len(in.Rows) > maxInvitationBatchRows {
		writeErr(w, http.StatusBadRequest, "a list of 1 to 500 rows is required")
		return
	}
	if m.accounts == nil || len(m.links.origins) == 0 || !m.links.project.Configured() {
		writeErr(w, http.StatusServiceUnavailable, "member invitations are not configured")
		return
	}
	redirect, ok := m.links.redirectFor(in.RedirectTo, r.Header.Get("Origin"))
	if !ok {
		writeErr(w, http.StatusBadRequest, "that redirect is not one of the member app's addresses")
		return
	}
	for i := range in.Rows {
		in.Rows[i].ActorID = ""
	}
	checks, err := um.CheckInvitationBatch(r.Context(), in.Rows)
	if err != nil {
		slog.Default().Error("an invitation list could not be checked", "instance", instanceID, "error", err.Error())
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	for _, c := range checks {
		if c.Status != actormodels.BatchRowReady || c.ActorID != "" {
			continue
		}
		userID, err := m.accountFor(r.Context(), instanceID, c.Input.Email)
		if err != nil {
			slog.Default().Error("an invited member could not be admitted", "instance", instanceID, "error", err.Error())
			continue
		}
		in.Rows[c.Row-1].ActorID = userID
	}
	for _, c := range checks {
		if c.ActorID != "" {
			in.Rows[c.Row-1].ActorID = c.ActorID
		}
	}
	results, err := um.SendInvitationBatch(r.Context(), in.Rows, accounts.IDFromContext(r.Context()))
	if err != nil {
		slog.Default().Error("an invitation list could not be sent", "instance", instanceID, "error", err.Error())
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	go m.sendPaced(sentEmails(results), redirect)
	writeJSON(w, http.StatusOK, invitationBatchAnswer{Results: results})
}

func (m memberInvitations) accountFor(ctx context.Context, instanceID, email string) (string, error) {
	userID, err := m.accounts.Invite(ctx, email)
	if err != nil {
		return "", err
	}
	if err := m.admit(ctx, instanceID, userID); err != nil {
		return "", err
	}
	if userID == "" {
		return "", errors.New("no account id")
	}
	return userID, nil
}

func sentEmails(results []mwanachamaactor.InvitationBatchResult) []string {
	var emails []string
	for _, res := range results {
		if res.Status == actormodels.BatchRowSent {
			emails = append(emails, res.Input.Email)
		}
	}
	return emails
}

func (m memberInvitations) sendPaced(emails []string, redirect string) {
	for _, email := range emails {
		m.links.slots <- struct{}{}
		ctx, cancel := context.WithTimeout(context.Background(), magicLinkSendTimeout)
		m.links.sent(m.links.project.SendMagicLink(ctx, email, redirect))
		cancel()
		m.links.release()
	}
}
