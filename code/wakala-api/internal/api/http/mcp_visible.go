package http

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	ai "wakalaserver/modules/ai"
	airoutes "wakalaserver/modules/ai/routes"
	catalogroutes "wakalaserver/modules/catalog/routes"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
)

type toolActions struct {
	once   sync.Once
	byName map[string]string
	scoped map[string]string
}

func (t *toolActions) scopeOf(d *Deps, name string) string {
	t.get(d)
	return t.scoped[name]
}

func (t *toolActions) get(d *Deps) map[string]string {
	t.once.Do(func() {
		t.byName = map[string]string{}
		t.scoped = map[string]string{}
		if s, err := dispatch.Parse(mwanachamaagency.Operations()); err == nil {
			for _, op := range s.Operations {
				if name := op.Tool; name != "" {
					t.byName[name] = op.Action
				}
			}
		}
		if d.Catalog != nil {
			for _, tool := range catalogroutes.Tools(d.Catalog) {
				t.byName[tool.Name] = tool.Action
			}
		}
		if d.AI != nil {
			for _, tool := range airoutes.Tools(struct{ ai.Manager }{}) {
				t.byName[tool.Name] = tool.Action
			}
		}
		if d.Reports != nil {
			for _, tool := range catalogroutes.ToolsFor(d.Reports, d.reportsMount()) {
				name := reportsToolName(tool.Name)
				t.byName[name] = tool.Action
				t.scoped[name] = reportsScope
			}
		}
		for name, action := range routePackageToolActions() {
			t.byName[name] = action
		}
		for name, action := range hostToolActions() {
			t.byName[name] = action
		}
		for name, action := range marketToolActions() {
			t.byName[name] = action
		}
		for name, action := range riskToolActions() {
			t.byName[name] = action
		}
		for name, action := range liveRecordToolActions() {
			t.byName[name] = action
		}
		for name, action := range LocalActions() {
			t.byName[name] = action
		}
	})
	return t.byName
}

type mcpServers struct {
	deps    *Deps
	full    *mcp.Server
	actions toolActions

	mu    sync.Mutex
	byKey map[string]*mcp.Server
}

func newMCPServers(d *Deps) *mcpServers {
	m := &mcpServers{deps: d, full: newMCPServer(d), byKey: map[string]*mcp.Server{}}
	if d.Permissions != nil {
		m.full.AddReceivingMiddleware(m.gateToolCalls)
	}
	return m
}

func (m *mcpServers) forRequest(r *http.Request) *mcp.Server {
	if m.deps.Permissions == nil {
		return m.full
	}
	ctx := r.Context()
	subject := accounts.IDFromContext(ctx)
	if subject == "" {
		return m.full
	}

	permitted, err := m.deps.Permissions.ActionsAnywhere(ctx, subject)
	if err != nil {
		return m.full
	}
	inScope := map[string][]string{}
	for _, scope := range m.scopes() {
		held, err := m.deps.Permissions.ActionsFor(ctx, subject, scope)
		if err != nil {
			return m.full
		}
		inScope[scope] = held
	}
	return m.serverFor(ctx, permitted, inScope)
}

func (m *mcpServers) scopes() []string {
	m.actions.get(m.deps)
	seen := map[string]bool{}
	var out []string
	for _, scope := range m.actions.scoped {
		if !seen[scope] {
			seen[scope] = true
			out = append(out, scope)
		}
	}
	sort.Strings(out)
	return out
}

func (m *mcpServers) serverFor(ctx context.Context, permitted []string, inScope map[string][]string) *mcp.Server {
	hidden := m.hiddenTools(permitted, inScope)
	if len(hidden) == 0 {
		return m.full
	}
	key := strings.Join(hidden, "\n")

	m.mu.Lock()
	defer m.mu.Unlock()
	if held, ok := m.byKey[key]; ok {
		return held
	}
	built := newMCPServer(m.deps)
	built.AddReceivingMiddleware(m.gateToolCalls)
	built.RemoveTools(hidden...)
	m.byKey[key] = built
	return built
}

func (m *mcpServers) hiddenTools(permitted []string, inScope map[string][]string) []string {
	allowed := make(map[string]bool, len(permitted))
	for _, a := range permitted {
		allowed[a] = true
	}
	allowedIn := make(map[string]map[string]bool, len(inScope))
	for scope, held := range inScope {
		allowedIn[scope] = make(map[string]bool, len(held))
		for _, a := range held {
			allowedIn[scope][a] = true
		}
	}

	var hidden []string
	for name, action := range m.actions.get(m.deps) {
		if action == "" {
			continue
		}
		if scope := m.actions.scoped[name]; scope != "" {
			if !allowedIn[scope][action] {
				hidden = append(hidden, name)
			}
			continue
		}
		if !allowed[action] {
			hidden = append(hidden, name)
		}
	}
	sort.Strings(hidden)
	return hidden
}
