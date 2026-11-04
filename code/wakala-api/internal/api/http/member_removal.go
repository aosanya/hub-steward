package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

var (
	errRemovalNotAllowed = errors.New("an agent removes residents only")
	errLastOwner         = errors.New("the last owner cannot be removed")
)

type agencyRemovalLine struct {
	InstanceID string    `json:"instance_id"`
	AgencyName string    `json:"agency_name"`
	RemovedAt  time.Time `json:"removed_at"`
}

func registerMemberRemovalRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("DELETE /instances/{instanceID}/members/{actorID}/groups/{groupID}", auth.require(removeFromGroup(reg)))
	mux.HandleFunc("DELETE /instances/{instanceID}/members/{actorID}", auth.require(removeFromAgency(reg)))
	mux.HandleFunc("GET /me/agency-removals", auth.require(listOwnRemovals(reg)))
}

func mayRemove(ctx context.Context, reg agencies.Registry, instanceID, target string) (string, error) {
	caller := accounts.IDFromContext(ctx)
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil || (role != agencies.RoleOwner && role != agencies.RoleAgent) {
		return "", agencies.ErrInstanceNotFound
	}
	targetRole, err := reg.RoleOf(ctx, instanceID, target)
	if err != nil {
		return "", agencies.ErrNotAMember
	}
	if role == agencies.RoleAgent && targetRole != agencies.RoleResident {
		return "", errRemovalNotAllowed
	}
	if targetRole == agencies.RoleOwner {
		members, err := reg.Members(ctx, instanceID)
		if err != nil {
			return "", err
		}
		owners := 0
		for _, m := range members {
			if m.Role == agencies.RoleOwner {
				owners++
			}
		}
		if owners <= 1 {
			return "", errLastOwner
		}
	}
	return caller, nil
}

func writeRemovalErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errRemovalNotAllowed):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, errLastOwner):
		writeErr(w, http.StatusConflict, err.Error())
	case errors.Is(err, agencies.ErrNotAMember), errors.Is(err, mwanachamaactor.ErrNotInGroup):
		writeErr(w, http.StatusNotFound, "not found")
	default:
		writeInstanceErr(w, err)
	}
}

func removeFromGroup(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		instanceID, actorID, groupID := r.PathValue("instanceID"), r.PathValue("actorID"), r.PathValue("groupID")
		caller, err := mayRemove(ctx, reg, instanceID, actorID)
		if err != nil {
			writeRemovalErr(w, err)
			return
		}
		directory, err := reg.ActorManager(ctx, instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		removal, err := directory.RemoveFromGroup(ctx, actorID, groupID, caller)
		if err != nil {
			writeRemovalErr(w, err)
			return
		}
		tellGroupRemoval(ctx, reg, instanceID, actorID, groupID)
		writeJSON(w, http.StatusOK, removal)
	}
}

func tellGroupRemoval(ctx context.Context, reg agencies.Registry, instanceID, actorID, groupID string) {
	cm, err := reg.CommManager(ctx, instanceID)
	if err == nil {
		_, err = cm.Raise(ctx, mwanachamacomm.Notification{
			ActorID:     actorID,
			Category:    commmodels.CategoryMembership,
			Event:       commmodels.EventGroupMemberRemoved,
			SubjectKind: commmodels.SubjectGroup,
			SubjectID:   groupID,
		})
	}
	if err != nil && !errors.Is(err, commmodels.ErrNotificationMuted) {
		slog.Default().Warn("a group removal raised no notification", "instance", instanceID, "group", groupID, "error", err.Error())
	}
}

func removeFromAgency(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		instanceID, actorID := r.PathValue("instanceID"), r.PathValue("actorID")
		caller, err := mayRemove(ctx, reg, instanceID, actorID)
		if err != nil {
			writeRemovalErr(w, err)
			return
		}
		removals, ok := reg.(agencies.RemovalRegistry)
		if !ok {
			writeErr(w, http.StatusNotImplemented, "removal is not available")
			return
		}
		if directory, err := reg.ActorManager(ctx, instanceID); err == nil {
			if _, err := directory.RemoveFromAllGroups(ctx, actorID, caller); err != nil {
				writeInstanceErr(w, err)
				return
			}
		}
		removal, err := removals.RemoveFromAgency(ctx, instanceID, actorID, caller)
		if err != nil {
			writeRemovalErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, removal)
	}
}

func listOwnRemovals(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		removals, ok := reg.(agencies.RemovalRegistry)
		if !ok {
			writeJSON(w, http.StatusOK, map[string]any{"items": []agencyRemovalLine{}})
			return
		}
		found, err := removals.RemovalsFor(ctx, accounts.IDFromContext(ctx))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		lines := make([]agencyRemovalLine, 0, len(found))
		for _, rm := range found {
			line := agencyRemovalLine{InstanceID: rm.InstanceID, RemovedAt: rm.RemovedAt}
			if inst, err := reg.GetInstance(ctx, rm.InstanceID); err == nil {
				line.AgencyName = inst.Name
			}
			lines = append(lines, line)
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": lines})
	}
}
