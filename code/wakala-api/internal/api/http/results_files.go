package http

import (
	"context"
	"errors"
	"slices"
	"sort"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaforms "github.com/aosanya/mwanachama-backend-forms"
	mwanachamagit "wakalaserver/modules/git"

	"wakalaserver/internal/agencies"
)

const (
	resultsFilesAction = "forms.results.files"
	resultsFilesTool   = "forms_results_files"

	largestResultsFiles = 200
)

type resultsFile struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Version     string `json:"version"`
	CommittedAt string `json:"committed_at"`
}

type resultsFiles struct {
	Items []resultsFile `json:"items"`
}

type mcpResultsFilesParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
	FormID     string `json:"form_id" jsonschema:"the form whose stored report files to list"`
}

type datedResultsFile struct {
	file resultsFile
	at   time.Time
}

func (d *Deps) registerResultsFilesMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        resultsFilesTool,
		Title:       "List A Form's Report Files",
		Description: "List the report files stored for a form with their versions, newest first: file name, full path in the reports repository, version (the commit SHA) and committed_at. One item per file and commit, 200 at most. An empty list when the form has no stored report. Needs the report.publish permission.",
	}, d.mcpListResultsFiles)
}

func (d *Deps) mcpListResultsFiles(ctx context.Context, _ *mcp.CallToolRequest, p mcpResultsFilesParams) (*mcp.CallToolResult, resultsFiles, error) {
	out, err := d.resultsFilesOf(ctx, p.InstanceID, p.FormID)
	if err != nil {
		return nil, resultsFiles{}, err
	}
	return textResult("Found %d report file version(s)", len(out.Items)), out, nil
}

func (d *Deps) resultsFilesOf(ctx context.Context, instanceID, formID string) (resultsFiles, error) {
	none := resultsFiles{Items: []resultsFile{}}
	if err := d.admittedHoldingAction(ctx, instanceID, resultsFilesAction); err != nil {
		return none, err
	}
	if err := d.requireAgentMay(ctx, instanceID, resultsFilesAction); err != nil {
		return none, err
	}
	fm, _, err := formsManagerFor(ctx, d.Registry, instanceID)
	if err != nil {
		return none, err
	}
	if _, err := fm.Get(ctx, formID); err != nil {
		if errors.Is(err, mwanachamaforms.ErrFormNotFound) {
			return none, nil
		}
		return none, err
	}
	gm, err := d.Registry.GitManager(ctx, instanceID)
	if err != nil {
		return none, err
	}
	branchID, found, err := agencies.ReportsBranch(ctx, gm)
	if err != nil || !found {
		return none, err
	}
	dated, err := reportFileVersions(ctx, gm, branchID, formID)
	if err != nil {
		return none, err
	}
	sort.SliceStable(dated, func(i, j int) bool { return dated[i].at.After(dated[j].at) })
	dated = dated[:min(len(dated), largestResultsFiles)]
	for _, v := range dated {
		none.Items = append(none.Items, v.file)
	}
	return none, nil
}

func reportFileVersions(ctx context.Context, gm mwanachamagit.GitManager, branchID, formID string) ([]datedResultsFile, error) {
	entries, err := gm.ListDirectory(ctx, branchID, formID)
	if err != nil {
		if errors.Is(err, mwanachamagit.ErrFileNotFound) || errors.Is(err, mwanachamagit.ErrBranchNotFound) {
			return nil, nil
		}
		return nil, err
	}
	chain, err := gm.Log(ctx, branchID, mwanachamagit.LogFilter{})
	if err != nil {
		return nil, err
	}
	parents := map[string]string{}
	for i := 0; i+1 < len(chain); i++ {
		parents[chain[i].SHA] = chain[i+1].SHA
	}
	var versions []datedResultsFile
	for _, entry := range entries {
		if entry.IsDir {
			continue
		}
		holding, err := gm.Log(ctx, branchID, mwanachamagit.LogFilter{Path: entry.Path})
		if err != nil {
			return nil, err
		}
		held := map[string]bool{}
		for _, c := range holding {
			held[c.SHA] = true
		}
		for _, c := range holding {
			changed, err := changesFile(ctx, gm, parents[c.SHA], c.SHA, entry.Path, held)
			if err != nil {
				return nil, err
			}
			if !changed {
				continue
			}
			at := c.Timestamp.UTC()
			versions = append(versions, datedResultsFile{
				file: resultsFile{Name: entry.Name, Path: entry.Path, Version: c.SHA, CommittedAt: at.Format(time.RFC3339)},
				at:   at,
			})
		}
	}
	return versions, nil
}

func changesFile(ctx context.Context, gm mwanachamagit.GitManager, parent, commit, path string, held map[string]bool) (bool, error) {
	if parent == "" || !held[parent] {
		return true, nil
	}
	diffs, err := gm.Diff(ctx, parent, commit)
	if err != nil {
		return false, err
	}
	return slices.ContainsFunc(diffs, func(f mwanachamagit.FileDiff) bool { return f.Path == path }), nil
}
