package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

var (
	errAssumedGroupsNotServed = errors.New("assumed groups are not available")
	errNoLoginSession         = errors.New("this sign-in has no session to assume a group in")
	errNoSeatInGroup          = errors.New("you hold no seat in that group")
	errAssumedGroupNeedsID    = errors.New("a group is needed")
)

type seatedGroup struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Roles []string `json:"roles"`
}

type assumedGroupRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type myGroupsView struct {
	InstanceID     string        `json:"instance_id"`
	Groups         []seatedGroup `json:"groups"`
	AssumedGroupID string        `json:"assumed_group_id"`
}

type assumedGroupView struct {
	InstanceID string           `json:"instance_id"`
	Group      *assumedGroupRef `json:"group"`
}

type assumeGroupRequest struct {
	GroupID string `json:"group_id"`
}

func registerAssumedGroupRoutes(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/my-groups", auth.require(d.listMyGroupsRoute(auth)))
	mux.HandleFunc("GET /instances/{instanceID}/my-group", auth.require(d.readMyGroupRoute(auth)))
	mux.HandleFunc("PUT /instances/{instanceID}/my-group", auth.require(d.assumeMyGroupRoute(auth)))
}

func (d *Deps) listMyGroupsRoute(auth callers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		groups, assumed, err := d.seatedGroupsAndChoice(r, auth, instanceID)
		if err != nil {
			writeAssumedGroupErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, myGroupsView{InstanceID: instanceID, Groups: groups, AssumedGroupID: assumed})
	}
}

func (d *Deps) readMyGroupRoute(auth callers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		groups, assumed, err := d.seatedGroupsAndChoice(r, auth, instanceID)
		if err != nil {
			writeAssumedGroupErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, assumedGroupViewOf(instanceID, groups, assumed))
	}
}

func (d *Deps) assumeMyGroupRoute(auth callers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		var in assumeGroupRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		groups, err := d.assumeGroup(r, auth, instanceID, strings.TrimSpace(in.GroupID))
		if err != nil {
			writeAssumedGroupErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, assumedGroupViewOf(instanceID, groups, strings.TrimSpace(in.GroupID)))
	}
}

func assumedGroupViewOf(instanceID string, groups []seatedGroup, assumed string) assumedGroupView {
	view := assumedGroupView{InstanceID: instanceID}
	for _, g := range groups {
		if g.ID == assumed {
			view.Group = &assumedGroupRef{ID: g.ID, Name: g.Name}
		}
	}
	return view
}

func (d *Deps) assumedGroupStore() (agencies.AssumedGroups, error) {
	kept, ok := d.Registry.(agencies.AssumedGroups)
	if !ok {
		return nil, errAssumedGroupsNotServed
	}
	return kept, nil
}

func (d *Deps) seatedGroupsAndChoice(r *http.Request, auth callers, instanceID string) ([]seatedGroup, string, error) {
	ctx := withPartitionContext(r.Context(), instanceID)
	if _, err := admittedRole(ctx, d.Registry, instanceID); err != nil {
		return nil, "", err
	}
	caller := accounts.IDFromContext(ctx)
	groups, err := d.seatedGroups(ctx, instanceID, caller)
	if err != nil {
		return nil, "", err
	}
	session, ok := d.loginSessionOf(r, auth)
	if !ok {
		return nil, "", errNoLoginSession
	}
	kept, err := d.assumedGroupStore()
	if err != nil {
		return nil, "", err
	}
	assumed, err := kept.AssumedGroupOf(ctx, session.key, instanceID, caller)
	if err != nil {
		return nil, "", err
	}
	if !holdsSeatIn(groups, assumed) {
		assumed = ""
	}
	return groups, assumed, nil
}

func (d *Deps) assumeGroup(r *http.Request, auth callers, instanceID, groupID string) ([]seatedGroup, error) {
	ctx := withPartitionContext(r.Context(), instanceID)
	if _, err := admittedRole(ctx, d.Registry, instanceID); err != nil {
		return nil, err
	}
	session, ok := d.loginSessionOf(r, auth)
	if !ok {
		return nil, errNoLoginSession
	}
	if groupID == "" {
		return nil, errAssumedGroupNeedsID
	}
	caller := accounts.IDFromContext(ctx)
	groups, err := d.seatedGroups(ctx, instanceID, caller)
	if err != nil {
		return nil, err
	}
	if !holdsSeatIn(groups, groupID) {
		return nil, errNoSeatInGroup
	}
	kept, err := d.assumedGroupStore()
	if err != nil {
		return nil, err
	}
	if err := kept.AssumeGroup(ctx, session.key, instanceID, caller, groupID, session.endsAt); err != nil {
		return nil, err
	}
	return groups, nil
}

func holdsSeatIn(groups []seatedGroup, groupID string) bool {
	for _, g := range groups {
		if g.ID == groupID {
			return true
		}
	}
	return false
}

func (d *Deps) seatedGroups(ctx context.Context, instanceID, personID string) ([]seatedGroup, error) {
	seats, err := agencies.SeatsInAnyGroup(ctx, d.Registry, instanceID, personID)
	if err != nil {
		return nil, err
	}
	out := []seatedGroup{}
	at := map[string]int{}
	for _, seat := range seats {
		i, listed := at[seat.Group.ID]
		if !listed {
			out = append(out, seatedGroup{ID: seat.Group.ID, Name: seat.Group.Name, Roles: []string{}})
			i = len(out) - 1
			at[seat.Group.ID] = i
		}
		out[i].Roles = append(out[i].Roles, seat.Kind.Name)
	}
	return d.enabledGroups(ctx, instanceID, out)
}

func writeAssumedGroupErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, agencies.ErrInstanceNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errNoSeatInGroup), errors.Is(err, errNoLoginSession):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, errAssumedGroupNeedsID):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, errAssumedGroupsNotServed):
		writeErr(w, http.StatusNotImplemented, err.Error())
	default:
		writeErr(w, http.StatusInternalServerError, "internal error")
	}
}
