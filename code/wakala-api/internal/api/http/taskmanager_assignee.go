package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/agencies"
)

const (
	assigneeKindActor   = "actor"
	assigneeRefusalText = "an assignee must be an owner or an agent of this agency"
)

var assigneeGatedActions = map[string]bool{
	"taskmanager.task.assign_holder":    true,
	"taskmanager.repeating_task.create": true,
	"taskmanager.repeating_task.update": true,
}

var assigneeGatedTools = map[string]bool{
	"taskmanager_task_assign_holder":    true,
	"taskmanager_repeating_task_create": true,
	"taskmanager_repeating_task_update": true,
}

var assignedToGatedActions = map[string]bool{
	"taskmanager.task.create":            true,
	"taskmanager.task.update":            true,
	"taskmanager.task.create_in_project": true,
}

var assignedToGatedTools = map[string]bool{
	"taskmanager_task_create":            true,
	"taskmanager_task_update":            true,
	"taskmanager_task_create_in_project": true,
}

type assignedToClaim struct {
	AssignedTo string `json:"assigned_to"`
}

type assigneeClaim struct {
	AssigneeKind string `json:"assignee_kind"`
	AssigneeID   string `json:"assignee_id"`
}

func readWholeBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	raw, err := io.ReadAll(r.Body)
	if err == nil {
		return raw, true
	}
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
		return nil, false
	}
	writeErr(w, http.StatusBadRequest, "could not read the request body")
	return nil, false
}

func peekBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	raw, ok := readWholeBody(w, r)
	if !ok {
		return nil, false
	}
	r.Body = io.NopCloser(bytes.NewReader(raw))
	return raw, true
}

func admitAssignee(w http.ResponseWriter, r *http.Request, reg agencies.Registry) bool {
	raw, read := peekBody(w, r)
	if !read {
		return false
	}
	var claim assigneeClaim
	if err := json.Unmarshal(raw, &claim); err != nil {
		return true
	}
	if strings.TrimSpace(claim.AssigneeKind) == "" && strings.TrimSpace(claim.AssigneeID) == "" {
		return true
	}
	ok, err := assigneeIsStaff(r.Context(), reg, r.PathValue("instanceID"), claim)
	return answerStaffCheck(w, ok, err)
}

func admitAssignedTo(w http.ResponseWriter, r *http.Request, reg agencies.Registry) bool {
	raw, read := peekBody(w, r)
	if !read {
		return false
	}
	var claim assignedToClaim
	if err := json.Unmarshal(raw, &claim); err != nil {
		return true
	}
	if strings.TrimSpace(claim.AssignedTo) == "" {
		return true
	}
	ok, err := isStaff(r.Context(), reg, r.PathValue("instanceID"), claim.AssignedTo)
	return answerStaffCheck(w, ok, err)
}

func answerStaffCheck(w http.ResponseWriter, ok bool, err error) bool {
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return false
	}
	if !ok {
		writeErr(w, http.StatusUnprocessableEntity, assigneeRefusalText)
		return false
	}
	return true
}

func refuseAssigneeArgs(ctx context.Context, reg agencies.Registry, instanceID string, args map[string]json.RawMessage) *mcp.CallToolResult {
	var claim assigneeClaim
	_ = json.Unmarshal(args["assignee_kind"], &claim.AssigneeKind)
	_ = json.Unmarshal(args["assignee_id"], &claim.AssigneeID)
	ok, err := assigneeIsStaff(ctx, reg, instanceID, claim)
	return staffRefusal(ok, err)
}

func refuseAssignedToArgs(ctx context.Context, reg agencies.Registry, instanceID string, args map[string]json.RawMessage) *mcp.CallToolResult {
	var assignedTo string
	_ = json.Unmarshal(args["assigned_to"], &assignedTo)
	if strings.TrimSpace(assignedTo) == "" {
		return nil
	}
	ok, err := isStaff(ctx, reg, instanceID, assignedTo)
	return staffRefusal(ok, err)
}

func staffRefusal(ok bool, err error) *mcp.CallToolResult {
	if err != nil {
		return toolError(err)
	}
	if !ok {
		return toolError(errors.New(assigneeRefusalText))
	}
	return nil
}

func assigneeIsStaff(ctx context.Context, reg agencies.Registry, instanceID string, claim assigneeClaim) (bool, error) {
	if claim.AssigneeKind != assigneeKindActor {
		return false, nil
	}
	return isStaff(ctx, reg, instanceID, claim.AssigneeID)
}
