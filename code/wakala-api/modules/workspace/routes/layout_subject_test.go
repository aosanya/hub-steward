package routes

import (
	"context"
	"testing"

	workspace "wakalaserver/modules/workspace"
	"wakalaserver/modules/workspace/models"
)

type layoutActors struct {
	workspace.LayoutManager
	named map[string]string
}

func (l *layoutActors) ReadLayout(_ context.Context, _, subject string) (models.ResolvedLayout, error) {
	l.named["read"] = subject
	return models.ResolvedLayout{}, nil
}

func (l *layoutActors) CreateLayout(_ context.Context, layout models.Layout) (models.Layout, error) {
	l.named["create"] = layout.Owner
	return layout, nil
}

func (l *layoutActors) PublishLayout(_ context.Context, _, subject string) (models.Layout, error) {
	l.named["publish"] = subject
	return models.Layout{}, nil
}

func (l *layoutActors) ProposeLayout(_ context.Context, _ string, p models.LayoutProposal) (models.LayoutDiff, error) {
	l.named["propose"] = p.Subject
	return models.LayoutDiff{}, nil
}

func (l *layoutActors) PatchLayout(_ context.Context, _ string, p models.LayoutProposal) (models.LayoutApplied, error) {
	l.named["patch"] = p.Subject
	return models.LayoutApplied{}, nil
}

func (l *layoutActors) RevertLayout(_ context.Context, _ string, r models.LayoutRevert) (models.LayoutApplied, error) {
	l.named["revert"] = r.Subject
	return models.LayoutApplied{}, nil
}

func (l *layoutActors) CopyLayout(_ context.Context, _ string, c models.LayoutCopy) (models.Layout, error) {
	l.named["copy"] = c.Subject
	return models.Layout{}, nil
}

func (l *layoutActors) ChooseLayout(_ context.Context, c models.LayoutChoice) (models.LayoutChoice, error) {
	l.named["choose"] = c.Subject
	return c, nil
}

func (l *layoutActors) ChosenLayout(_ context.Context, _, subject string) (models.LayoutChoice, error) {
	l.named["chosen"] = subject
	return models.LayoutChoice{}, nil
}

func TestEveryLayoutActIsDoneByTheCallerNotTheRequestsSubject(t *testing.T) {
	cases := []struct {
		act, action, method, target, body string
	}{
		{"read", "workspace.layout.read", "GET", "/?subject=forged-clerk", ""},
		{"create", "workspace.layout.create", "POST", "/", `{"scope":"s","title":"t","owner":"forged-clerk"}`},
		{"publish", "workspace.layout.publish", "POST", "/", `{"subject":"forged-clerk"}`},
		{"propose", "workspace.layout.propose", "POST", "/", `{"patch":{},"subject":"forged-clerk"}`},
		{"patch", "workspace.layout.patch", "POST", "/", `{"patch":{},"subject":"forged-clerk"}`},
		{"revert", "workspace.layout.revert", "POST", "/", `{"all":true,"subject":"forged-clerk"}`},
		{"copy", "workspace.layout.share", "POST", "/", `{"to":"x","subject":"forged-clerk"}`},
		{"choose", "workspace.layout.choose", "POST", "/", `{"layout_id":"l1","subject":"forged-clerk"}`},
		{"chosen", "workspace.layout.chosen", "GET", "/?subject=forged-clerk", ""},
	}
	for _, c := range cases {
		t.Run(c.act, func(t *testing.T) {
			manager := &layoutActors{named: map[string]string{}}
			call(layoutRouteOf(t, manager, c.action), c.method, c.target, c.body, map[string]string{"layout_id": "l1", "workbook_id": "w1"})
			if manager.named[c.act] != "the-session" {
				t.Errorf("%s names %q; want the-session, never the request's forged-clerk", c.act, manager.named[c.act])
			}
		})
	}
}

func layoutRouteOf(t *testing.T, manager workspace.LayoutManager, action string) Route {
	t.Helper()
	for _, route := range LayoutRoutesFor(manager, theSession) {
		if route.Action == action {
			return route
		}
	}
	t.Fatalf("no route for %s", action)
	return Route{}
}
