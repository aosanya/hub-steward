package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func (w reachWalk) roleCarrying(t *testing.T, name string, kinds ...string) {
	t.Helper()
	ctx := context.Background()
	role, err := w.manager.CreateRole(ctx, agencymodels.Role{DraftID: w.draftID, Name: name})
	if err != nil {
		t.Fatalf("CreateRole %s: %v", name, err)
	}
	w.roles[name] = role.ID
	w.giveRole(t, name, w.record, kinds...)
	w.publish(t)
}

func (w reachWalk) bare(t *testing.T, role string) {
	t.Helper()
	ctx := context.Background()
	have, err := w.manager.GetRole(ctx, w.roles[role])
	if err != nil {
		t.Fatalf("GetRole %s: %v", role, err)
	}
	have.Permissions = nil
	if _, err := w.manager.UpdateRole(ctx, have); err != nil {
		t.Fatalf("UpdateRole %s: %v", role, err)
	}
	w.publish(t)
}

func (w reachWalk) personWith(t *testing.T, subject, role string) *http.Cookie {
	t.Helper()
	return w.callerIn(t, subject, role, w.groupCarrying(t, "Group of "+subject, "emea"))
}

func (w reachWalk) addBody(tender string) map[string]any {
	return map[string]any{"answers": map[string]string{"Tender": tender}}
}

func TestAnAddStepAsksTheAddCodeAndNotTheRoleTheRecordNames(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Scout", "add.*")
	w.bare(t, "Coordinator")
	scout := w.personWith(t, "scout", "Scout")
	named := w.personWith(t, "named-by-the-record", "Coordinator")

	if rec := w.send(t, scout, "add", w.addBody("Road survey")); rec.Code != http.StatusCreated {
		t.Errorf("a role carrying add.* adds: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, named, "add", w.addBody("Bridge survey")); rec.Code != http.StatusForbidden {
		t.Errorf("the role the record names, carrying no add code, adds: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestAnAddNeedsNoViewOfTheFieldItWrites(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Blind scout", "add.tender")
	scout := w.personWith(t, "blind-scout", "Blind scout")

	if rec := w.send(t, scout, "add", w.addBody("Road survey")); rec.Code != http.StatusCreated {
		t.Errorf("a role carrying add.tender and no view adds: %d %s, want 201", rec.Code, rec.Body.String())
	}
	wantTenders(t, "the blind scout", w.tendersListedFor(t, scout))
}

func TestAnEditStepAsksTheEditCodeAndNeedsNoView(t *testing.T) {
	w := newReachWalk(t)
	row := w.seedTagged(t, "Road survey", "emea")
	w.roleCarrying(t, "Blind editor", "edit.client")
	w.bare(t, "Liaison")
	editor := w.personWith(t, "blind-editor", "Blind editor")
	named := w.personWith(t, "named-by-the-record", "Liaison")
	body := map[string]any{"row_id": row.ID, "answers": w.addBody("Road survey, phase 2")["answers"]}

	if rec := w.send(t, named, "edit", body); rec.Code != http.StatusForbidden {
		t.Errorf("the role the record names, carrying no edit code, edits: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, editor, "edit", body); rec.Code != http.StatusCreated {
		t.Errorf("a role carrying edit.client and no view edits: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestADeleteStepAsksTheDeleteCodeAndNoField(t *testing.T) {
	w := newReachWalk(t)
	row := w.seedTagged(t, "Road survey", "emea")
	w.roleCarrying(t, "Remover", "delete")
	w.roleCarrying(t, "Everything but delete", "add.*", "edit.*", "view.*")
	w.bare(t, "Volunteer")
	why := map[string]any{"row_id": row.ID, "answers": map[string]string{"Why is it removed": "Entered twice"}}

	for _, subject := range []struct{ name, role string }{{"the role the record names", "Volunteer"}, {"a role with every code but delete", "Everything but delete"}} {
		if rec := w.send(t, w.personWith(t, subject.role, subject.role), "delete", why); rec.Code != http.StatusForbidden {
			t.Errorf("%s deletes: %d %s, want 403", subject.name, rec.Code, rec.Body.String())
		}
	}
	if rec := w.send(t, w.personWith(t, "remover", "Remover"), "delete", why); rec.Code != http.StatusCreated {
		t.Errorf("a role carrying delete deletes: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestTheRowListAsksAViewCodeAndNothingElseShowsARow(t *testing.T) {
	w := newReachWalk(t)
	w.seedTagged(t, "Road survey", "emea")
	w.roleCarrying(t, "Reader", "view.client", "view.tender")
	w.bare(t, "Coordinator")

	wantTenders(t, "a role carrying view.client and view.tender", w.tendersListedFor(t, w.personWith(t, "reader", "Reader")), "Road survey")
	wantTenders(t, "the role the record names, carrying no view code", w.tendersListedFor(t, w.personWith(t, "named", "Coordinator")))
}

func TestARowThatNamesAPersonIsNotShownToThemWithoutAViewCode(t *testing.T) {
	w := newReachWalk(t)
	w.seedTagged(t, "Road survey", "emea")
	w.bare(t, "Coordinator")
	named := w.callerIn(t, "named", "Coordinator", w.groupCarrying(t, "EMEA", "emea"))

	wantTenders(t, "a person holding no view code", w.tendersListedFor(t, named))
}

func TestACodeCarriedInAnotherGroupThanTheAssumedOneGivesNothing(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Scout", "add.*")
	w.bare(t, "Coordinator")
	elsewhere := w.groupCarrying(t, "Elsewhere", "emea")
	assumed := w.groupCarrying(t, "Assumed", "emea")
	as := w.callerIn(t, "split", "Scout", elsewhere)
	w.grantSeat(t, "split", assumed, w.roles["Coordinator"])
	w.assumeDirectly(t, as, "split", assumed)

	if rec := w.send(t, as, "add", w.addBody("Road survey")); rec.Code != http.StatusForbidden {
		t.Errorf("a person assuming the group where no seat carries add: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestACodeGivesNothingWhileNoGroupIsAssumed(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Scout", "add.*", "view.*")
	w.seedTagged(t, "Road survey", "emea")
	as := w.personWith(t, "scout", "Scout")
	w.assumeNothing(t, as)

	if rec := w.send(t, as, "add", w.addBody("Bridge survey")); rec.Code != http.StatusForbidden {
		t.Errorf("an add with no assumed group: %d %s, want 403", rec.Code, rec.Body.String())
	}
	rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows", nil, as)
	if rec.Code == http.StatusOK && strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("a person with no assumed group lists %s, want no row", rec.Body.String())
	}
}

func TestTheOwnerNeedsACodeThroughASeatLikeAnyoneElse(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Scout", "add.*", "view.*")
	w.assumeDirectly(t, w.owner, "test-owner", w.groupCarrying(t, "Owner without a seat", "emea"))

	if rec := w.send(t, w.owner, "add", w.addBody("Road survey")); rec.Code != http.StatusForbidden {
		t.Errorf("the owner adds through the step with no seat carrying add: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows", w.addBody("Direct without a seat"), w.owner); rec.Code != http.StatusForbidden {
		t.Errorf("the owner adds directly with no seat carrying add: %d %s, want 403", rec.Code, rec.Body.String())
	}
	wantTenders(t, "the owner with no seat carrying view", w.tendersListedFor(t, w.owner))

	seated := w.groupCarrying(t, "Owner with a seat", "emea")
	w.grantSeat(t, "test-owner", seated, w.roles["Scout"])
	w.assumeDirectly(t, w.owner, "test-owner", seated)
	if rec := w.call(t, "POST", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows", w.addBody("Direct with a seat"), w.owner); rec.Code != http.StatusCreated {
		t.Errorf("the owner adds directly through a seat carrying add: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestAnAgentSeatCarriesTheCodesOfItsGroup(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Scout", "add.*", "view.*")
	w.bare(t, "Coordinator")
	scout := w.personWith(t, "agent-scout", "Scout")
	bare := w.personWith(t, "agent-bare", "Coordinator")

	if rec := w.send(t, scout, "add", w.addBody("Road survey")); rec.Code != http.StatusCreated {
		t.Errorf("an agent seated in a role carrying add.*: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, bare, "add", w.addBody("Bridge survey")); rec.Code != http.StatusForbidden {
		t.Errorf("an agent seated in a role carrying nothing: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestTheLiveRecordsOfferAnAddOnlyToACallerCarryingAnAddCode(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Scout", "add.tender")
	w.bare(t, "Coordinator")
	canAdd := func(as *http.Cookie) bool {
		rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records", nil, as)
		for _, item := range decodeObjects(t, rec) {
			if item["code"] == w.record.Code {
				return item["can_add_rows"] == true
			}
		}
		return false
	}
	if !canAdd(w.personWith(t, "scout", "Scout")) {
		t.Errorf("can_add_rows for a role carrying add.tender = false, want true")
	}
	if canAdd(w.personWith(t, "named", "Coordinator")) {
		t.Errorf("can_add_rows for the role the record names, carrying no add code = true, want false")
	}
}

func TestADesignedStepWritesItsRowOnlyWithAnAddCodeOfItsRecord(t *testing.T) {
	w := referral(t)
	volunteer := w.roles["Volunteer"]
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		if roleID == volunteer {
			return nil, nil
		}
		return w.deps.cachedRolePermissions(withPartitionContext(context.Background(), w.instance), roleID)
	}
	body := map[string]any{"answers": referralAnswers()}

	if rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Report a referral"]+"/answers", body, w.people["Volunteer"]); rec.Code != http.StatusForbidden {
		t.Errorf("the role holding the designed step but no add code of its record: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestTheDesignerRowRoutesAskTheSameCodesAsEveryoneAndThereIsNoOwnerPass(t *testing.T) {
	w := newReachWalk(t)
	w.roleCarrying(t, "Scout", "add.*", "view.*")
	base := "/instances/" + w.instance
	create := map[string]any{"draft_id": w.liveID, "record_id": w.record.ID, "answers": map[string]string{"Tender": "Road survey"}}
	w.assumeDirectly(t, w.owner, "test-owner", w.groupCarrying(t, "Owner without a seat", "emea"))

	if rec := w.call(t, "POST", base+"/record-rows", create, w.owner); rec.Code != http.StatusForbidden {
		t.Errorf("the owner creates a row on the design route with no seat carrying add: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", base+"/record-rows?draft_id="+w.liveID+"&record_id="+w.record.ID, nil, w.owner); rec.Code != http.StatusForbidden {
		t.Errorf("the owner lists rows on the design route with no seat carrying view: %d %s, want 403", rec.Code, rec.Body.String())
	}
	seated := w.groupCarrying(t, "Owner with a seat", "emea")
	w.grantSeat(t, "test-owner", seated, w.roles["Scout"])
	w.assumeDirectly(t, w.owner, "test-owner", seated)
	if rec := w.call(t, "GET", base+"/record-rows?draft_id="+w.liveID+"&record_id="+w.record.ID, nil, w.owner); rec.Code != http.StatusOK {
		t.Errorf("the owner lists rows on the design route through a seat carrying view: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
