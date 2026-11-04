package http

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/notifyrules"
)

type notificationPreviewBody struct {
	GroupID string                `json:"group_id"`
	Rule    *notificationRuleBody `json:"rule"`
}

type notificationPreview struct {
	Rule         notifyrules.Rule       `json:"rule"`
	GroupID      string                 `json:"group_id"`
	Told         []string               `json:"told"`
	Fallback     bool                   `json:"fallback"`
	NamedAtRaise []notifyrules.Audience `json:"named_at_raise"`
}

var errPreviewGroupRequired = errors.New("group_id is required")

func previewNotificationRule(reg agencies.Registry, store *notifyrules.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, ok := ownerOfRules(w, r, reg)
		if !ok {
			return
		}
		var body notificationPreviewBody
		if err := readJSON(r, &body); err != nil && !errors.Is(err, io.EOF) {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		body.GroupID = strings.TrimSpace(body.GroupID)
		if body.GroupID == "" {
			writeErr(w, http.StatusBadRequest, errPreviewGroupRequired.Error())
			return
		}
		rule, err := ruleToPreview(r.Context(), store, instanceID, notifyrules.Event(r.PathValue("event")), body.Rule)
		if err != nil {
			writeNotificationRuleErr(w, err)
			return
		}
		roster, err := previewRoster(r.Context(), reg, instanceID, body.GroupID)
		if errors.Is(err, mwanachamaactor.ErrGroupNotFound) {
			writeErr(w, http.StatusNotFound, err.Error())
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		told := notifyrules.Resolve(rule, roster)
		writeJSON(w, http.StatusOK, notificationPreview{
			Rule:         rule,
			GroupID:      body.GroupID,
			Told:         told,
			Fallback:     len(told) > 0 && len(notifyrules.Resolve(notifyrules.Rule{Told: rule.Told}, roster)) == 0,
			NamedAtRaise: namedAtRaise(rule),
		})
	}
}

func ruleToPreview(ctx context.Context, store *notifyrules.Store, instanceID string, event notifyrules.Event, draft *notificationRuleBody) (notifyrules.Rule, error) {
	if draft == nil {
		return store.Rule(ctx, instanceID, event)
	}
	return notifyrules.Validate(notifyrules.Rule{Event: event, Told: draft.Told, Fallback: draft.Fallback, Mutable: draft.Mutable})
}

func previewRoster(ctx context.Context, reg agencies.Registry, instanceID, groupID string) (notifyrules.Roster, error) {
	roster := notifyrules.Roster{}
	members, err := reg.Members(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		switch m.Role {
		case agencies.RoleOwner:
			roster[notifyrules.Owners] = append(roster[notifyrules.Owners], m.UserID)
		case agencies.RoleAgent:
			roster[notifyrules.Agents] = append(roster[notifyrules.Agents], m.UserID)
		}
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	if _, err := directory.GetGroup(ctx, groupID); err != nil {
		return nil, err
	}
	placed, err := directory.ListActorsForGroup(ctx, groupID)
	if err != nil {
		return nil, err
	}
	for _, p := range placed {
		roster[notifyrules.Group] = append(roster[notifyrules.Group], p.ActorID)
		leads, err := directory.IsGroupLeader(ctx, groupID, p.ActorID)
		if err != nil {
			return nil, err
		}
		if leads {
			roster[notifyrules.GroupLeaders] = append(roster[notifyrules.GroupLeaders], p.ActorID)
		}
	}
	return roster, nil
}

func namedAtRaise(rule notifyrules.Rule) []notifyrules.Audience {
	out := []notifyrules.Audience{}
	for _, a := range append(append([]notifyrules.Audience{}, rule.Told...), rule.Fallback...) {
		if a == notifyrules.Subject || a == notifyrules.Thread {
			out = append(out, a)
		}
	}
	return out
}
