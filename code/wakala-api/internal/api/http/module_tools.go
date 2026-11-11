package http

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

const listModuleToolsTool = "agency_list_module_tools"

const maxToolSummary = 160

type moduleToolView struct {
	Name        string `json:"name"`
	Module      string `json:"module"`
	Description string `json:"description"`
}

type agencyModuleToolsView struct {
	Tools []moduleToolView `json:"tools"`
}

type toolCatalog struct {
	once  sync.Once
	tools []moduleToolView
	err   error
}

var serverToolCatalog toolCatalog

func (c *toolCatalog) load(ctx context.Context, d *Deps) ([]moduleToolView, error) {
	c.once.Do(func() { c.tools, c.err = d.listServerTools(context.WithoutCancel(ctx)) })
	return c.tools, c.err
}

func (d *Deps) listServerTools(ctx context.Context) ([]moduleToolView, error) {
	return moduleToolsServedBy(ctx, newMCPServer(d))
}

func moduleToolsServedBy(ctx context.Context, server *mcp.Server) ([]moduleToolView, error) {
	serverSide, clientSide := mcp.NewInMemoryTransports()
	serverSession, err := server.Connect(ctx, serverSide, nil)
	if err != nil {
		return nil, err
	}
	defer serverSession.Close()
	client := mcp.NewClient(&mcp.Implementation{Name: "module-tools", Version: "1.0.0"}, nil)
	clientSession, err := client.Connect(ctx, clientSide, nil)
	if err != nil {
		return nil, err
	}
	defer clientSession.Close()
	listed, err := clientSession.ListTools(ctx, nil)
	if err != nil {
		return nil, err
	}
	codes := map[string]bool{}
	for _, entry := range models.ModuleCatalog {
		codes[entry.Code] = true
	}
	out := make([]moduleToolView, 0, len(listed.Tools))
	for _, t := range listed.Tools {
		module, _, found := strings.Cut(t.Name, "_")
		if !found || !codes[module] {
			continue
		}
		out = append(out, moduleToolView{Name: t.Name, Module: module, Description: oneLine(t.Description)})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func oneLine(text string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(text), "\n")
	line = strings.TrimSpace(line)
	if len(line) <= maxToolSummary {
		return line
	}
	return strings.TrimSpace(line[:maxToolSummary]) + "…"
}

func (d *Deps) registerModuleToolsRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/module-tools", auth.require(func(w http.ResponseWriter, r *http.Request) {
		out, err := d.agencyModuleTools(r.Context(), reg, r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}))
}

func (d *Deps) registerModuleToolsTool(server *mcp.Server) {
	server.AddTool(&mcp.Tool{
		Name:        listModuleToolsTool,
		Title:       "List the tools the agency's modules offer",
		Description: "Owners and agents only; a resident is refused. Every tool offered by the modules the agency has switched on, each with its module and a one-line description, so a chat step can tick the tools it may call. Limited to the modules the caller's role may use.",
		InputSchema: map[string]any{
			"type":                 "object",
			"properties":           map[string]any{"instance_id": map[string]any{"type": "string", "description": "The agency to read."}},
			"required":             []string{"instance_id"},
			"additionalProperties": false,
		},
	}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		instanceID, _, err := splitFormsInstance(req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		out, err := d.agencyModuleTools(ctx, d.Registry, instanceID)
		if err != nil {
			return toolError(err), nil
		}
		return &mcp.CallToolResult{
			Content:           []mcp.Content{&mcp.TextContent{Text: listModuleToolsTool + " completed"}},
			StructuredContent: out,
		}, nil
	})
}

func (d *Deps) agencyModuleTools(ctx context.Context, reg agencies.Registry, instanceID string) (agencyModuleToolsView, error) {
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return agencyModuleToolsView{}, err
	}
	set, err := mountedSetOf(ctx, reg, instanceID)
	if err != nil {
		return agencyModuleToolsView{}, err
	}
	may, err := d.moduleVisibility(ctx, reg, instanceID)
	if err != nil {
		return agencyModuleToolsView{}, err
	}
	all, err := serverToolCatalog.load(ctx, d)
	if err != nil {
		return agencyModuleToolsView{}, err
	}
	out := agencyModuleToolsView{Tools: []moduleToolView{}}
	for _, tool := range all {
		if len(set.mountsOf(tool.Module)) == 0 || !may(tool.Module) {
			continue
		}
		out.Tools = append(out.Tools, tool)
	}
	return out, nil
}
