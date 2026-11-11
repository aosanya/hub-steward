package http

import (
	"context"
	"net/http"
	"testing"

	workspace "wakalaserver/modules/workspace"
	workspacemodels "wakalaserver/modules/workspace/models"
)

type workbooksKept struct {
	workspace.WorkspaceManager
	createdFor, listedFor, usedBy string
}

func (w *workbooksKept) CreateWorkbook(_ context.Context, b workspacemodels.Workbook) (workspacemodels.Workbook, error) {
	w.createdFor = b.Owner
	return b, nil
}

func (w *workbooksKept) ListWorkbooks(_ context.Context, owner string, _ workspacemodels.WorkbookFilter) ([]workspacemodels.Workbook, error) {
	w.listedFor = owner
	return nil, nil
}

func (w *workbooksKept) Record(_ context.Context, u workspacemodels.Use) (workspacemodels.Use, error) {
	w.usedBy = u.Subject
	return u, nil
}

func TestWorkspaceWorkbook_ItBelongsToTheSignedInPersonNotTheBodysOwner(t *testing.T) {
	w := newStepRunWalk(t, nil)
	manager := &workbooksKept{}
	w.deps.Workspace = manager
	w.handler = NewRouter(w.deps)

	created := w.call(t, "POST", "/workspace/workbooks", map[string]any{"title": "Ward", "owner": "forged-keeper"}, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create workbook: %d %s, want 201", created.Code, created.Body.String())
	}
	if manager.createdFor != "test-owner" {
		t.Errorf("the workbook belongs to %q; want the signed-in test-owner, never the body's forged-keeper", manager.createdFor)
	}

	listed := w.call(t, "GET", "/workspace/workbooks?owner=forged-keeper", nil, w.owner)
	if listed.Code != http.StatusOK {
		t.Fatalf("list workbooks: %d %s, want 200", listed.Code, listed.Body.String())
	}
	if manager.listedFor != "test-owner" {
		t.Errorf("the list was read for %q; want the signed-in test-owner, never the query's forged-keeper", manager.listedFor)
	}

	used := w.call(t, "POST", "/workspace/workbooks/w1/uses", map[string]any{"action": "forms.form.read", "subject": "forged-keeper"}, w.owner)
	if used.Code != http.StatusCreated {
		t.Fatalf("record use: %d %s, want 201", used.Code, used.Body.String())
	}
	if manager.usedBy != "test-owner" {
		t.Errorf("the use names %q; want the signed-in test-owner, never the body's forged-keeper", manager.usedBy)
	}
}

type layoutsKept struct {
	workspace.LayoutManager
	named map[string]string
}

func (l *layoutsKept) CreateLayout(_ context.Context, layout workspacemodels.Layout) (workspacemodels.Layout, error) {
	l.named["create"] = layout.Owner
	return layout, nil
}

func (l *layoutsKept) PatchLayout(_ context.Context, _ string, p workspacemodels.LayoutProposal) (workspacemodels.LayoutApplied, error) {
	l.named["patch"] = p.Subject
	return workspacemodels.LayoutApplied{}, nil
}

func (l *layoutsKept) ChooseLayout(_ context.Context, c workspacemodels.LayoutChoice) (workspacemodels.LayoutChoice, error) {
	l.named["choose"] = c.Subject
	return c, nil
}

func TestWorkspaceLayout_ItIsMadeAndChangedBySignedInPersonNotTheBodysSubject(t *testing.T) {
	w := newStepRunWalk(t, nil)
	manager := &layoutsKept{named: map[string]string{}}
	w.deps.Workspace = &workbooksKept{}
	w.deps.Layouts = manager
	w.handler = NewRouter(w.deps)

	made := w.call(t, "POST", "/workspace/layouts", map[string]any{"scope": "w1", "title": "Ward", "owner": "forged-keeper"}, w.owner)
	if made.Code != http.StatusCreated {
		t.Fatalf("make layout: %d %s, want 201", made.Code, made.Body.String())
	}
	patched := w.call(t, "POST", "/workspace/layouts/l1/patch", map[string]any{"patch": map[string]any{}, "subject": "forged-keeper"}, w.owner)
	if patched.Code != http.StatusOK {
		t.Fatalf("patch layout: %d %s, want 200", patched.Code, patched.Body.String())
	}
	chosen := w.call(t, "PUT", "/workspace/workbooks/w1/layout", map[string]any{"layout_id": "l1", "subject": "forged-keeper"}, w.owner)
	if chosen.Code != http.StatusOK && chosen.Code != http.StatusCreated {
		t.Fatalf("choose layout: %d %s, want 2xx", chosen.Code, chosen.Body.String())
	}
	for act, who := range manager.named {
		if who != "test-owner" {
			t.Errorf("layout %s names %q; want the signed-in test-owner, never the body's forged-keeper", act, who)
		}
	}
	if len(manager.named) != 3 {
		t.Errorf("the layout manager saw %d of the 3 acts", len(manager.named))
	}
}
