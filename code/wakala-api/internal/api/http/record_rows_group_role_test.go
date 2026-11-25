package http

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
)

func (b businessRegisterWalk) makeViewer(t *testing.T, role string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := b.deps.Registry.AgencyManager(ctx, b.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	record, err := liveRecordByCode(ctx, mgr, live, b.register)
	if err != nil {
		t.Fatalf("liveRecordByCode: %v", err)
	}
	letRoleDo(t, mgr, b.roles[role], record, mwanachamaagency.RecordViewAction)
	b.publish(t)
}

func (b businessRegisterWalk) groupSeated(t *testing.T) groupRoleWalk {
	t.Helper()
	return groupRoleWalk{stepRunWalk: b.stepRunWalk, groups: map[string]string{}}
}

func (b businessRegisterWalk) addBusinessAs(t *testing.T, as *http.Cookie, business, owner string) int {
	t.Helper()
	body := map[string]any{"answers": map[string]string{"Business": business, "Owner": owner, "Contact": "front desk"}}
	return b.call(t, "POST", "/instances/"+b.instance+"/live-records/"+b.register+"/rows", body, as).Code
}

func (b businessRegisterWalk) addBusinessThroughTheGeneratedStep(t *testing.T, as *http.Cookie, business, owner string) int {
	t.Helper()
	ctx := context.Background()
	mgr, err := b.deps.Registry.AgencyManager(ctx, b.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	record, err := liveRecordByCode(ctx, mgr, live, b.register)
	if err != nil {
		t.Fatalf("liveRecordByCode: %v", err)
	}
	steps, err := mgr.ListWorkItems(ctx, live, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	for _, step := range steps {
		if step.Code == mwanachamaagency.RecordPermissionCode(record.Code, "add")+".1" {
			body := map[string]any{"answers": map[string]string{"Business": business, "Owner": owner, "Contact": "front desk"}}
			return b.call(t, "POST", "/instances/"+b.instance+"/steps/"+step.ID+"/answers", body, as).Code
		}
	}
	t.Fatalf("the live version has no add step of %s", b.register)
	return 0
}

func (b businessRegisterWalk) canAddRowsAs(t *testing.T, as *http.Cookie) bool {
	t.Helper()
	rec := b.call(t, "GET", "/instances/"+b.instance+"/live-records", nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("listing records: %d %s", rec.Code, rec.Body.String())
	}
	for _, record := range decodeObjects(t, rec) {
		if record["key"] == b.register {
			allowed, _ := record["can_add_rows"].(bool)
			return allowed
		}
	}
	t.Fatalf("record %s is not listed", b.register)
	return false
}

func TestLiveRecordRowsGroupRole_AResidentSeatedInTheRecordsRoleThroughAGroupListsEveryRow(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")
	w := b.groupSeated(t)
	_, coordinator := w.resident(t, "Coordinator Cora", "Coordinators")
	w.giveRole(t, "Coordinators", "Coordinator")

	expectBusinesses(t, "the group-seated coordinator", b.businessesOverHTTP(t, coordinator, nil), "Alpha Bakery", "Beta Garage")
}

func TestLiveRecordRowsGroupRole_AResidentSeatedInTheRecordsRoleThroughAGroupMayAddRows(t *testing.T) {
	b := businessRegister(t)
	w := b.groupSeated(t)
	_, coordinator := w.resident(t, "Coordinator Cora", "Coordinators")
	w.giveRole(t, "Coordinators", "Coordinator")

	if !b.canAddRowsAs(t, coordinator) {
		t.Error("the group-seated coordinator is told it cannot add rows")
	}
	if code := b.addBusinessAs(t, coordinator, "Gamma Florist", b.alpha); code != http.StatusForbidden {
		t.Fatalf("adding a row as the group-seated coordinator through the direct route: %d, want 403", code)
	}
	if code := b.addBusinessThroughTheGeneratedStep(t, coordinator, "Gamma Florist", b.alpha); code != http.StatusCreated {
		t.Fatalf("adding a row as the group-seated coordinator through the generated add workflow: %d, want 201", code)
	}
	expectBusinesses(t, "the group-seated coordinator after adding", b.businessesOverHTTP(t, coordinator, nil), "Gamma Florist")
}

func TestLiveRecordRowsGroupRole_AResidentSeatedInAnotherRoleThroughAGroupSeesOnlyRowsNamingThem(t *testing.T) {
	b := businessRegister(t)
	w := b.groupSeated(t)
	liaison, liaisonCookie := w.resident(t, "Liaison Lee", "Liaisons")
	w.giveRole(t, "Liaisons", "Liaison")
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Lee Laundry", liaison, "front desk", "", "")

	expectBusinesses(t, "the group-seated liaison", b.businessesOverHTTP(t, liaisonCookie, nil), "Lee Laundry")
	if b.canAddRowsAs(t, liaisonCookie) {
		t.Error("the group-seated liaison is told it can add rows")
	}
	if code := b.addBusinessAs(t, liaisonCookie, "Gamma Florist", liaison); code != http.StatusForbidden {
		t.Errorf("adding a row as the group-seated liaison: %d, want 403", code)
	}
}

func TestLiveRecordRowsGroupRole_AResidentWithNoRoleStillSeesOnlyRowsNamingThem(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")

	expectBusinesses(t, "the resident without a role", b.businessesOverHTTP(t, b.alphaCookie, nil), "Alpha Bakery")
	expectBusinesses(t, "the resident without a role asking for another's rows", b.businessesOverHTTP(t, b.alphaCookie, url.Values{"answer_actor_id": {b.beta}}))
}

func TestLiveRecordRowsGroupRole_AResidentSeatedInTheRecordsViewerRoleThroughAGroupListsEveryRowButMayNotAdd(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")
	b.makeViewer(t, "Liaison")
	w := b.groupSeated(t)
	liaison, liaisonCookie := w.resident(t, "Liaison Lee", "Liaisons")
	w.giveRole(t, "Liaisons", "Liaison")

	expectBusinesses(t, "the group-seated viewer", b.businessesOverHTTP(t, liaisonCookie, nil), "Alpha Bakery", "Beta Garage")
	if code := b.addBusinessAs(t, liaisonCookie, "Gamma Florist", liaison); code != http.StatusForbidden {
		t.Errorf("adding a row as the group-seated viewer: %d, want 403", code)
	}
}
