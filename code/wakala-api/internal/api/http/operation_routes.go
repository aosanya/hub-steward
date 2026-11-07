package http

import (
	"net/http"
	"sort"
	"strings"
	"sync"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	catalog "wakalaserver/modules/catalog"
	custody "wakalaserver/modules/custody"
	digitaltwin "wakalaserver/modules/digitaltwin"
	engage "wakalaserver/modules/engage"
	market "wakalaserver/modules/market"
	riskmanager "wakalaserver/modules/riskmanager"
	"wakalaserver/modules/shared/dispatch"
	taskmanager "wakalaserver/modules/taskmanager"
	voting "wakalaserver/modules/voting"
	workspace "wakalaserver/modules/workspace"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type declaredOperation struct {
	Module      string `json:"module"`
	Mount       string `json:"mount,omitempty"`
	MountName   string `json:"mountName,omitempty"`
	Role        string `json:"role"`
	Verb        string `json:"verb"`
	Action      string `json:"action"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	Method      string `json:"method"`
	Path        string `json:"path"`
}

type callerOperations struct {
	Subject    string              `json:"subject"`
	Gated      bool                `json:"gated"`
	Operations []declaredOperation `json:"operations"`
}

type operationCatalog struct {
	once sync.Once
	all  []declaredOperation
}

type mountedModule struct {
	module     string
	mount      string
	prefix     string
	operations []byte
}

func mountedOperations(d *Deps) []mountedModule {
	mounted := []mountedModule{
		{module: "agency", prefix: agencyInstancePrefix, operations: mwanachamaagency.Operations()},
		{module: "taskmanager", mount: agencies.MountBoard, prefix: taskmanagerInstancePrefix, operations: taskmanager.Operations()},
		{module: "actor", mount: agencies.MountDirectory, prefix: actorInstancePrefix, operations: mwanachamaactor.Operations()},
		{module: "voting", mount: agencies.MountPolls, prefix: votingInstancePrefix, operations: voting.Operations()},
		{module: "custody", mount: agencies.MountCustody, prefix: custodyInstancePrefix, operations: custody.Operations()},
		{module: "digitaltwin", mount: agencies.MountTwin, prefix: digitaltwinInstancePrefix, operations: digitaltwin.Operations()},
		{module: "engage", mount: agencies.MountPosts, prefix: engageInstancePrefix, operations: engage.Operations()},
		{module: "riskmanager", mount: agencies.MountRisks, prefix: riskInstancePrefix, operations: riskmanager.Operations()},
		{module: "market", mount: agencies.MountMarket, prefix: marketInstancePrefix, operations: market.Operations()},
	}
	if d.Catalog != nil {
		mounted = append(mounted, mountedModule{module: "catalog", prefix: catalogPrefix, operations: catalog.Operations()})
	}
	if d.Workspace != nil {
		mounted = append(mounted, mountedModule{module: "workspace", prefix: workspacePrefix, operations: workspace.Operations()})
	}
	if d.Layouts != nil {
		mounted = append(mounted, mountedModule{module: "workspace", prefix: workspacePrefix, operations: workspace.LayoutOperations()})
	}
	return mounted
}

func (c *operationCatalog) get(d *Deps) []declaredOperation {
	c.once.Do(func() {
		for _, mount := range mountedOperations(d) {
			module := mount.module
			s, err := dispatch.Parse(mount.operations)
			if err != nil {
				continue
			}
			for _, op := range s.Operations {
				if op.Action == "" {
					continue
				}
				c.all = append(c.all, declaredOperation{
					Module:      module,
					Mount:       mount.mount,
					MountName:   mount.mount,
					Role:        actionSegment(op.Action, 1),
					Verb:        actionSegment(op.Action, 2),
					Action:      op.Action,
					Title:       op.Title,
					Description: op.Description,
					Method:      op.Method,
					Path:        mount.prefix + s.Base + op.Path,
				})
			}
		}
		sort.Slice(c.all, func(i, j int) bool { return c.all[i].Action < c.all[j].Action })
	})
	return c.all
}

func actionSegment(action string, at int) string {
	parts := strings.Split(action, ".")
	if at >= len(parts) {
		return ""
	}
	return parts[at]
}

func registerOperationRoutes(mux *http.ServeMux, d *Deps, auth callers, catalogue *operationCatalog) {
	mux.HandleFunc("GET /me/operations", auth.require(func(w http.ResponseWriter, r *http.Request) {
		subject := accounts.IDFromContext(r.Context())
		declared := catalogue.get(d)

		out := callerOperations{Subject: subject, Gated: d.Permissions != nil, Operations: []declaredOperation{}}
		if d.Permissions == nil {
			out.Operations = declared
			writeJSON(w, http.StatusOK, out)
			return
		}

		allowed, err := d.Permissions.ActionsAnywhere(r.Context(), subject)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not read the caller's permissions")
			return
		}
		may := make(map[string]bool, len(allowed))
		for _, a := range allowed {
			may[a] = true
		}
		for _, op := range declared {
			if may[op.Action] {
				out.Operations = append(out.Operations, op)
			}
		}
		writeJSON(w, http.StatusOK, out)
	}))
}
