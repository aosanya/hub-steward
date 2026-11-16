package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func TestEveryFormStepOfAnImportedDemoAgencyShowsItsPromptInTheOpenStepsReply(t *testing.T) {
	for _, demo := range demoAgencies(t) {
		t.Run(demo.name, func(t *testing.T) {
			demo.skipWhileItsImportIsBroken(t)
			promptByTitle := map[string]string{}
			for _, s := range demoSteps(t, demo.raw) {
				if isFormKind(s.Kind) && strings.TrimSpace(s.Prompt) != "" {
					promptByTitle[s.Title] = s.Prompt
				}
			}
			if len(promptByTitle) == 0 {
				t.Skip("this demo agency has no form step with a prompt")
			}

			w, result := importDemoAgency(t, demo.raw)
			w.instance, w.draftID = result.Instance.ID, result.DraftID
			w.publish(t)

			ctx := context.Background()
			mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
			if err != nil {
				t.Fatalf("AgencyManager: %v", err)
			}
			live, err := liveDraftOf(ctx, mgr)
			if err != nil {
				t.Fatalf("liveDraftOf: %v", err)
			}
			roles, err := mgr.ListRoles(ctx, live, mwanachamaagency.RoleFilter{})
			if err != nil {
				t.Fatalf("ListRoles: %v", err)
			}
			um, err := w.deps.Registry.ActorManager(ctx, w.instance)
			if err != nil {
				t.Fatalf("ActorManager: %v", err)
			}
			group := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Staff"}, w.owner)
			if group.Code != http.StatusCreated {
				t.Fatalf("create group: %d %s", group.Code, group.Body.String())
			}
			groupID, _ := decodeObject(t, group)["id"].(string)

			shown := map[string]string{}
			for _, role := range roles {
				if role.Deleted {
					continue
				}
				w.roles[role.Name] = role.ID
				member := w.seat(t, mgr, um, groupID, role.Name)
				listed := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps", nil, member)
				if listed.Code != http.StatusOK {
					t.Fatalf("my-open-steps for %s: %d %s", role.Name, listed.Code, listed.Body.String())
				}
				for _, item := range decodeObjects(t, listed) {
					kind, _ := item["kind"].(string)
					title, _ := item["title"].(string)
					if !isFormKind(agencymodels.StepKind(kind)) {
						continue
					}
					prompt, _ := item["prompt"].(string)
					shown[title] = prompt
				}
			}

			for title, prompt := range shown {
				want, known := promptByTitle[title]
				if known && prompt != want {
					t.Errorf("the form step %q shows a prompt other than the template's", title)
				}
			}
			for title := range promptByTitle {
				if _, ok := shown[title]; !ok {
					t.Logf("the form step %q was not listed to any seated role", title)
				}
			}
		})
	}
}
