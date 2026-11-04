package http

import (
	"context"
	"net/http"

	catalog "wakalaserver/modules/catalog"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type ledFormRead struct {
	FormID  string               `json:"form_id"`
	Title   string               `json:"title"`
	Counts  []catalog.FieldTally `json:"counts"`
	Records []catalog.Record     `json:"records"`
}

type ledGroupRead struct {
	GroupID string        `json:"group_id"`
	Name    string        `json:"name"`
	Forms   []ledFormRead `json:"forms"`
}

func registerFormsLedRoute(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if reg == nil {
		return
	}
	mux.HandleFunc("GET "+formsCatalogInstancePrefix+"/led", auth.require(func(w http.ResponseWriter, r *http.Request) {
		items, err := formsSentToGroupsLed(r.Context(), reg, r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	}))
}

func formsSentToGroupsLed(ctx context.Context, reg agencies.Registry, instanceID string) ([]ledGroupRead, error) {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return nil, agencies.ErrInstanceNotFound
	}
	if _, err := reg.RoleOf(ctx, instanceID, caller); err != nil {
		return nil, err
	}
	if err := mustBeMounted(ctx, reg, instanceID, "forms"); err != nil {
		return nil, err
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	groups, err := directory.ListLedGroups(ctx, caller)
	if err != nil {
		return nil, err
	}
	out := []ledGroupRead{}
	if len(groups) == 0 {
		return out, nil
	}
	fm, err := reg.FormManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	cm, err := reg.CatalogManager(ctx, instanceID, formsCatalogMount)
	if err != nil {
		return nil, err
	}
	for _, g := range groups {
		read := ledGroupRead{GroupID: g.ID, Name: g.Name, Forms: []ledFormRead{}}
		sent, err := fm.ListReachable(ctx, []string{g.ID})
		if err != nil {
			return nil, err
		}
		for _, f := range sent {
			records, err := cm.ListRecords(ctx, f.ID, g.ID)
			if err != nil {
				return nil, err
			}
			counts, err := catalog.TallyRecords(records)
			if err != nil {
				return nil, err
			}
			read.Forms = append(read.Forms, ledFormRead{FormID: f.ID, Title: f.Title, Counts: counts, Records: records})
		}
		out = append(out, read)
	}
	return out, nil
}
