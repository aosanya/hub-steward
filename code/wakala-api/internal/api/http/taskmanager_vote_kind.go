package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	caseVoteAction = "taskmanager.case.vote"
	caseVoteTool   = "taskmanager_case_vote"
	voterKindField = "member_kind"
	plainMember    = "member"
	unknownVoter   = "unknown"
)

func voterKindFor(agencyRole string) string {
	switch agencyRole {
	case agencies.RoleResident:
		return plainMember
	case agencies.RoleOwner, agencies.RoleAgent:
		return agencyRole
	}
	return unknownVoter
}

func pinVoterKind(fields map[string]json.RawMessage, agencyRole string) {
	kind, _ := json.Marshal(voterKindFor(agencyRole))
	fields[voterKindField] = kind
}

func pinVoterKindOnRequest(w http.ResponseWriter, r *http.Request, agencyRole string) bool {
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxAssignBodyBytes))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "could not read the request body")
		return false
	}
	fields := map[string]json.RawMessage{}
	if len(bytes.TrimSpace(raw)) > 0 {
		if err := json.Unmarshal(raw, &fields); err != nil {
			r.Body = io.NopCloser(bytes.NewReader(raw))
			return true
		}
	}
	pinVoterKind(fields, agencyRole)
	pinned, err := json.Marshal(fields)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "could not read the request body")
		return false
	}
	r.Body = io.NopCloser(bytes.NewReader(pinned))
	r.ContentLength = int64(len(pinned))
	return true
}

func callerAgencyRole(ctx context.Context, reg agencies.Registry, instanceID string) string {
	role, err := reg.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return ""
	}
	return role
}
