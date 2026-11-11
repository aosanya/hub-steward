package http

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	maxDisplayNameLength = 120
	maxNamesPerLookup    = 100
)

var errNoNameGiven = errors.New("give at least one of display_name, first_name and last_name")

type knownName struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
}

type fullName struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
}

func fullNameOf(a mwanachamaactor.Actor) fullName {
	return fullName{ID: a.ID, DisplayName: a.DisplayName, FirstName: a.FirstName, LastName: a.LastName}
}

type ownNameRequest struct {
	DisplayName *string `json:"display_name"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
}

func registerMemberNameRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/me/name", auth.require(readOwnName(reg)))
	mux.HandleFunc("PUT /instances/{instanceID}/me/name", auth.require(setOwnName(reg)))
	mux.HandleFunc("GET /instances/{instanceID}/names", auth.require(lookUpNames(reg)))
}

func memberDirectoryFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaactor.UserManager, string, error) {
	role, err := admittedRole(ctx, reg, instanceID)
	if err != nil {
		return nil, "", err
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	return directory, role, err
}

func readOwnName(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		directory, _, err := memberDirectoryFor(r.Context(), reg, r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		held, err := directory.GetActor(r.Context(), accounts.IDFromContext(r.Context()))
		if err != nil {
			writeActorErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, fullNameOf(held))
	}
}

func setOwnName(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		directory, _, err := memberDirectoryFor(ctx, reg, r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		var in ownNameRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		cleaned, err := in.clean()
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		held, err := cleaned.applyTo(ctx, directory, accounts.IDFromContext(ctx))
		if err != nil {
			writeActorErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, fullNameOf(held))
	}
}

func (in ownNameRequest) clean() (ownNameRequest, error) {
	if in.DisplayName == nil && in.FirstName == nil && in.LastName == nil {
		return in, errNoNameGiven
	}
	out := ownNameRequest{}
	for _, f := range []struct {
		label string
		raw   *string
		into  **string
	}{
		{"display name", in.DisplayName, &out.DisplayName},
		{"first name", in.FirstName, &out.FirstName},
		{"last name", in.LastName, &out.LastName},
	} {
		if f.raw == nil {
			continue
		}
		name, err := cleanName(f.label, *f.raw)
		if err != nil {
			return in, err
		}
		*f.into = &name
	}
	return out, nil
}

func (in ownNameRequest) applyTo(ctx context.Context, directory mwanachamaactor.UserManager, actorID string) (mwanachamaactor.Actor, error) {
	held, err := directory.GetActor(ctx, actorID)
	if err != nil {
		return held, err
	}
	if in.DisplayName != nil {
		if held, err = directory.SetActorDisplayName(ctx, actorID, *in.DisplayName); err != nil {
			return held, err
		}
	}
	if in.FirstName != nil || in.LastName != nil {
		first, last := held.FirstName, held.LastName
		if in.FirstName != nil {
			first = *in.FirstName
		}
		if in.LastName != nil {
			last = *in.LastName
		}
		if held, err = directory.SetActorName(ctx, actorID, first, last); err != nil {
			return held, err
		}
	}
	return held, nil
}

func writeActorErr(w http.ResponseWriter, err error) {
	if errors.Is(err, mwanachamaactor.ErrActorNotFound) {
		err = agencies.ErrInstanceNotFound
	}
	writeInstanceErr(w, err)
}

func cleanName(label, raw string) (string, error) {
	name := strings.TrimSpace(raw)
	switch {
	case name == "":
		return "", fmt.Errorf("a %s is required", label)
	case utf8.RuneCountInString(name) > maxDisplayNameLength:
		return "", fmt.Errorf("a %s is at most %d characters", label, maxDisplayNameLength)
	case strings.IndexFunc(name, isUnseenOrLineBreaking) >= 0:
		return "", fmt.Errorf("a %s is one line with no control characters", label)
	}
	return name, nil
}

func isUnseenOrLineBreaking(r rune) bool {
	return unicode.IsControl(r) || unicode.In(r, unicode.Cf, unicode.Zl, unicode.Zp)
}

func lookUpNames(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		directory, role, err := memberDirectoryFor(ctx, reg, r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		ids := r.URL.Query()["id"]
		if len(ids) > maxNamesPerLookup {
			writeErr(w, http.StatusBadRequest, "at most 100 ids in one lookup")
			return
		}
		if role == agencies.RoleResident {
			ids, err = sharingAGroup(ctx, directory, accounts.IDFromContext(ctx), ids)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
		}
		held, err := directory.GetActors(ctx, ids)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		if role == agencies.RoleResident {
			writeJSON(w, http.StatusOK, screenNamesOf(held))
			return
		}
		out := make([]fullName, 0, len(held))
		for _, a := range held {
			out = append(out, fullNameOf(a))
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func sharingAGroup(ctx context.Context, directory mwanachamaactor.UserManager, caller string, ids []string) ([]string, error) {
	visible := map[string]bool{caller: true}
	held, err := directory.ListGroupsForActor(ctx, caller)
	if err != nil {
		return nil, err
	}
	for _, mine := range held {
		if mine.Deleted {
			continue
		}
		members, err := directory.ListActorsForGroup(ctx, mine.GroupID)
		if err != nil {
			return nil, err
		}
		for _, m := range members {
			if !m.Deleted {
				visible[m.ActorID] = true
			}
		}
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if visible[id] {
			out = append(out, id)
		}
	}
	return out, nil
}

func screenNamesOf(held []mwanachamaactor.Actor) []knownName {
	out := make([]knownName, 0, len(held))
	for _, a := range held {
		out = append(out, knownName{ID: a.ID, DisplayName: a.DisplayName})
	}
	return out
}
