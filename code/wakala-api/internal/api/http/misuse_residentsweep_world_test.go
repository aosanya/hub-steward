package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

const (
	ownerAccount = "test-owner"
)

type sweepWorld struct {
	probe     declaredGroupProbe
	walk      stepRunWalk
	clerk     *http.Cookie
	clerkID   string
	resident  *http.Cookie
	residentA string
	neighbour *http.Cookie
	params    map[string]string
	byAction  map[string]map[string]string
	queries   map[string]string
}

func (w *sweepWorld) seedActor(t *testing.T, name, group string) (*http.Cookie, string) {
	t.Helper()
	ctx := context.Background()
	directory, err := w.walk.deps.Registry.ActorManager(ctx, w.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor %s: %v", name, err)
	}
	if err := w.walk.deps.Registry.AddMember(ctx, w.walk.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember %s: %v", name, err)
	}
	if group != "" {
		if _, err := directory.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: group}); err != nil {
			t.Fatalf("AssignGroup %s: %v", name, err)
		}
	}
	return w.walk.cookieFor(t, actor.ID), actor.ID
}

func (w *sweepWorld) created(t *testing.T, what, method, path string, body any, as *http.Cookie) map[string]any {
	t.Helper()
	rec := w.walk.call(t, method, path, body, as)
	if rec.Code >= 400 {
		t.Fatalf("seeding %s: %s %s answered %d %s", what, method, path, rec.Code, rec.Body.String())
	}
	if rec.Body.Len() == 0 || rec.Body.Bytes()[0] != '{' {
		return map[string]any{}
	}
	return decodeObject(t, rec)
}

func (w *sweepWorld) idOf(t *testing.T, what, method, path string, body any, as *http.Cookie) string {
	t.Helper()
	id, _ := w.created(t, what, method, path, body, as)["id"].(string)
	if id == "" {
		t.Fatalf("seeding %s: no id came back", what)
	}
	return id
}

func newSweepWorld(t *testing.T) *sweepWorld {
	t.Helper()
	p := newDeclaredGroupProbe(t)
	w := &sweepWorld{probe: p, walk: p.walk, params: map[string]string{}, queries: map[string]string{}, byAction: map[string]map[string]string{}}
	instance := "/instances/" + w.walk.instance

	w.seedClerk(t)
	w.resident, w.residentA = w.seedActor(t, "Resident Anna", p.ward)
	w.neighbour, _ = w.seedActor(t, "Resident Bela", p.ward)
	w.params["actor_id"] = w.residentA

	w.seedForms(t, instance)
	w.seedPoll(t, instance)
	w.seedChat(t, instance)
	w.seedGroups(t, instance)
	w.seedMarket(t, instance)
	w.seedConsent(t, instance)
	w.seedCatalog(t)
	return w
}

func (w *sweepWorld) seedForms(t *testing.T, instance string) {
	p := w.probe
	forms := instance + "/forms"
	owner := w.walk.owner
	targeted := forms + "/forms/" + p.targeted
	w.params["form_id"] = p.targeted
	w.params["key"] = p.link

	questions := w.walk.call(t, "GET", targeted+"/questions", nil, owner)
	questionID, _ := decodeObjects(t, questions)[0]["id"].(string)
	w.params["question_id"] = questionID

	answered := w.walk.call(t, "POST", targeted+"/answers", map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": "two"}}}, w.resident)
	if answered.Code != http.StatusOK {
		t.Fatalf("resident answers the ward round: %d %s", answered.Code, answered.Body.String())
	}
	sends := w.walk.call(t, "GET", forms+"/forms/answered", nil, w.resident)
	if rows := decodeObjects(t, sends); len(rows) > 0 {
		w.params["send_id"], _ = rows[0]["send_id"].(string)
	}
	w.walk.call(t, "PUT", targeted+"/submissions/"+w.residentA+"/paid", map[string]any{"paid": true}, owner)

	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	open := w.idOf(t, "second round", "POST", forms+"/forms", map[string]any{"title": "Second round", "audience": "member", "closes_at": closes}, owner)
	w.created(t, "second round target", "POST", forms+"/forms/"+open+"/targets", map[string]any{"chapter_id": p.ward}, owner)
	w.created(t, "second round question", "POST", forms+"/forms/"+open+"/questions", map[string]any{"prompt": "How many", "answer_type": "free_text"}, owner)
	w.created(t, "second round publish", "POST", forms+"/forms/"+open+"/publish", map[string]any{}, owner)

	w.created(t, "close", "POST", targeted+"/close", map[string]any{}, owner)
	w.created(t, "results", "POST", targeted+"/results", map[string]any{"git_path": "reports/kertvaros.md", "git_commit": "abc1234"}, owner)
}

func (w *sweepWorld) seedPoll(t *testing.T, instance string) {
	owner := w.walk.owner
	polls := instance + "/voting/polls"
	made := w.created(t, "poll", "POST", polls, map[string]any{
		"question": "Bench colour", "mode": "one", "per_group": "once", "group_ids": []string{w.probe.ward},
		"opens_at": time.Now().Add(-time.Hour).UTC().Format(time.RFC3339), "closes_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		"choices": []map[string]any{{"label": "green"}, {"label": "blue"}},
	}, owner)
	pollID, _ := made["id"].(string)
	w.params["pollID"] = pollID
	choices := w.walk.call(t, "GET", polls+"/"+pollID+"/choices", nil, w.resident)
	choiceID, _ := decodeObjects(t, choices)[0]["id"].(string)
	w.created(t, "poll answer", "POST", polls+"/"+pollID+"/answers", map[string]any{"votes": map[string]int{choiceID: 1}}, w.resident)
	w.created(t, "poll result", "POST", polls+"/"+pollID+"/result", map[string]any{"group_ids": []string{w.probe.ward}}, owner)
}

func (w *sweepWorld) seedChat(t *testing.T, instance string) {
	owner := w.walk.owner
	room := instance + "/comm/groups/" + w.probe.ward + "/chat/threads"
	w.params["structure_id"] = w.probe.ward

	thread := w.idOf(t, "private thread", "POST", room, map[string]any{"label": "Rent arrears question"}, w.resident)
	w.params["thread_id"] = thread
	w.created(t, "staff opens the thread", "POST", room+"/"+thread+"/open", map[string]any{}, owner)
	w.walk.call(t, "POST", room+"/"+thread+"/messages", map[string]any{"body": "We will look at it on Monday"}, owner)
	message := w.idOf(t, "resident message", "POST", room+"/"+thread+"/messages", map[string]any{"body": "Thank you"}, w.resident)
	w.params["message_id"] = message

	standing := w.walk.call(t, "POST", instance+"/comm/groups/"+w.probe.ward+"/chat/standing", map[string]any{"body": "Bins on Thursday", "rule": "weekly"}, owner)
	if standing.Code < 400 {
		w.params["standing_id"], _ = decodeObject(t, standing)["id"].(string)
	}

}

func (w *sweepWorld) seedGroups(t *testing.T, instance string) {
	owner := w.walk.owner
	actor := instance + "/actor"
	w.created(t, "confirmed join mode", "PUT", actor+"/groups/"+w.probe.otherWard+"/join-mode", map[string]any{"join_mode": "confirmed"}, owner)
	w.params["group_id"] = w.probe.ward
	otherCode, _ := w.created(t, "other ward", "GET", actor+"/groups/"+w.probe.otherWard, nil, owner)["public_code"].(string)
	w.queries["actor.group.find_by_code"] = "code=" + otherCode

	asked := w.created(t, "resident asks to join", "POST", actor+"/groups/"+w.probe.otherWard+"/join", map[string]any{"message": "May I?"}, w.resident)
	request, _ := asked["request"].(map[string]any)
	requestID, _ := request["id"].(string)
	w.params["request_id"] = requestID
	decided := w.walk.call(t, "POST", actor+"/join-requests/"+requestID+"/operator-approve", map[string]any{}, owner)
	if decided.Code >= 400 {
		t.Logf("operator approve: %d %s", decided.Code, decided.Body.String())
	}
	declined := w.created(t, "neighbour asks to join", "POST", actor+"/groups/"+w.probe.otherWard+"/join", map[string]any{"message": "And me?"}, w.neighbour)
	declinedRequest, _ := declined["request"].(map[string]any)
	declinedID, _ := declinedRequest["id"].(string)
	if rec := w.walk.call(t, "POST", actor+"/join-requests/"+declinedID+"/operator-decline", map[string]any{"reason": "full"}, owner); rec.Code >= 400 {
		t.Logf("operator decline: %d %s", rec.Code, rec.Body.String())
	}

	thirdGroup := w.created(t, "third group", "POST", actor+"/groups", map[string]any{"name": "Újváros"}, owner)
	code, _ := thirdGroup["public_code"].(string)
	batch := w.walk.call(t, "POST", actor+"/invitations/batch", map[string]any{"rows": []map[string]any{{"first_name": "Anna", "last_name": "Resident", "email": "anna@example.test", "group_code": code, "actor_id": w.residentA}}}, owner)
	if batch.Code != http.StatusOK {
		t.Fatalf("owner sends the invitation batch: %d %s", batch.Code, batch.Body.String())
	}
	w.params["invited_group"], _ = thirdGroup["id"].(string)
	invitations := decodeObjects(t, w.walk.call(t, "GET", actor+"/invitations/mine", nil, w.resident))
	if len(invitations) == 0 {
		t.Fatalf("the invitation batch left the resident with no invitation (group code %q)", code)
	}
	w.params["invitation_id"], _ = invitations[0]["id"].(string)

	fourth := w.idOf(t, "fourth group", "POST", actor+"/groups", map[string]any{"name": "Zugló"}, owner)
	w.created(t, "confirmed join mode", "PUT", actor+"/groups/"+fourth+"/join-mode", map[string]any{"join_mode": "confirmed"}, owner)
	pending := w.created(t, "resident asks to join", "POST", actor+"/groups/"+fourth+"/join", map[string]any{"message": "May I too?"}, w.resident)
	pendingRequest, _ := pending["request"].(map[string]any)
	pendingID, _ := pendingRequest["id"].(string)
	subject := instance + "/comm/subjects/group_join_request/" + pendingID + "/threads"
	w.makeClerkLead(t, fourth)
	opened := w.walk.call(t, "POST", subject, map[string]any{"audience": "private"}, w.resident)
	if opened.Code >= 400 {
		t.Fatalf("resident opens the join request thread: %d %s", opened.Code, opened.Body.String())
	}
	subjectThread, _ := decodeObject(t, opened)["id"].(string)
	w.params["subject_kind"], w.params["subject_id"] = "group_join_request", pendingID
	own := map[string]string{"thread_id": subjectThread}
	w.byAction["comm.subject_thread.read"], w.byAction["comm.subject_message.list"] = own, own
	w.created(t, "owner writes", "POST", instance+"/comm/subject-threads/"+subjectThread+"/messages", map[string]any{"body": "Which street do you live on?"}, w.clerk)

	directory, err := w.walk.deps.Registry.ActorManager(context.Background(), w.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	decisions, err := directory.ListJoinDecisions(context.Background(), w.params["request_id"])
	if err != nil || len(decisions) == 0 {
		t.Logf("no join decision for %s: %v", w.params["request_id"], err)
	} else {
		w.params["decision_id"] = decisions[0].ID
	}

}

func (w *sweepWorld) seedCatalog(t *testing.T) {
	manager, err := w.walk.deps.Registry.CatalogManager(context.Background(), w.walk.instance, agencies.MountCatalog)
	if err != nil {
		t.Fatalf("catalog manager: %v", err)
	}
	deps := w.walk.deps
	deps.Catalog = manager
	deps.Permissions = everyoneMay{}
	seeding := stepRunWalk{handler: NewRouter(deps), deps: deps, owner: w.walk.owner, instance: w.walk.instance, db: w.walk.db}

	owner := w.walk.owner
	filed := w.created2(t, seeding, "raised item", "POST", "/catalog/raised-items/filed", map[string]any{"title": "Broken street lamp", "topic": "Lighting", "raised_by": w.residentA, "channel": "phone", "publishable": true}, owner)
	itemID, _ := filed["id"].(string)
	w.created2(t, seeding, "reply", "POST", "/catalog/raised-items/"+itemID+"/replies", map[string]any{"body": "A crew is booked"}, owner)
	followKey, _ := w.created2(t, seeding, "follow key", "POST", "/catalog/raised-items/"+itemID+"/follow-key", nil, owner)["key"].(string)
	board, _ := w.created2(t, seeding, "board item", "POST", "/catalog/board-items", map[string]any{"title": "Street lighting"}, owner)["id"].(string)
	w.created2(t, seeding, "group onto board", "PUT", "/catalog/raised-items/"+itemID+"/board-item", map[string]any{"board_item_id": board}, owner)
	w.created2(t, seeding, "entry", "PUT", "/catalog/entries/street-lights", map[string]any{"slug": "street-lights", "name": "Street lights", "summary": "Ward lights", "doc": "{}", "visibility": "public"}, owner)

	w.queries["catalog.raised_item.open_followed"] = "instance_id=" + w.walk.instance
	w.queries["catalog.board_item.open_shared"] = "instance_id=" + w.walk.instance
	w.byAction["catalog.raised_item.open_followed"] = map[string]string{"key": followKey}
	w.byAction["catalog.board_item.open_shared"] = map[string]string{"key": board}
	w.params["slug"] = "street-lights"
	w.params["raisedItemID"] = itemID
	w.params["boardItemID"] = board

	deps.Permissions = nil
	w.walk.handler = NewRouter(deps)
	w.walk.deps = deps
}

func (w *sweepWorld) created2(t *testing.T, via stepRunWalk, what, method, path string, body any, as *http.Cookie) map[string]any {
	t.Helper()
	rec := via.call(t, method, path, body, as)
	if rec.Code >= 400 {
		t.Fatalf("seeding %s: %s %s answered %d %s", what, method, path, rec.Code, rec.Body.String())
	}
	if rec.Body.Len() == 0 || rec.Body.Bytes()[0] != '{' {
		return map[string]any{}
	}
	return decodeObject(t, rec)
}

func (w *sweepWorld) seedMarket(t *testing.T, instance string) {
	market := instance + "/market"
	owner := w.walk.owner
	poster := w.idOf(t, "poster", "POST", market+"/posters", map[string]any{"name": "Bela's orchard", "area": "Belváros"}, w.neighbour)
	w.created(t, "poster approved", "POST", market+"/posters/"+poster+"/approve", map[string]any{}, owner)
	offer := w.idOf(t, "offer", "POST", market+"/offers", map[string]any{"poster_id": poster, "product_words": "apples", "unit_words": "kg", "price": 2.5}, w.neighbour)
	order := w.idOf(t, "order", "POST", market+"/offers/"+offer+"/buy", map[string]any{"quantity": 3}, w.resident)
	w.params["posterID"], w.params["orderID"], w.params["offerID"] = poster, order, offer
	w.created(t, "order paid", "POST", market+"/orders/"+order+"/paid", map[string]any{}, w.neighbour)
}

func (w *sweepWorld) seedConsent(t *testing.T, instance string) {
	custody := instance + "/custody"
	version := w.idOf(t, "consent version", "POST", custody+"/consent/versions", map[string]any{"scope": "mechanics", "version": "v1", "language": "en", "clauses": []map[string]any{}}, w.walk.owner)
	w.created(t, "consent published", "POST", custody+"/consent/versions/"+version+"/publish", map[string]any{}, w.walk.owner)
	w.params["versionID"], w.params["scope"], w.params["language"] = version, "mechanics", "en"
}

func (w *sweepWorld) seedClerk(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	directory, err := w.walk.deps.Registry.ActorManager(ctx, w.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	clerk, err := directory.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Clerk Kata"})
	if err != nil {
		t.Fatalf("CreateActor clerk: %v", err)
	}
	if err := w.walk.deps.Registry.AddMember(ctx, w.walk.instance, clerk.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember clerk: %v", err)
	}
	w.clerkID = clerk.ID
	w.clerk = w.walk.cookieFor(t, clerk.ID)
}

func (w *sweepWorld) makeClerkLead(t *testing.T, group string) {
	t.Helper()
	ctx := context.Background()
	directory, err := w.walk.deps.Registry.ActorManager(ctx, w.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	kind, err := directory.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: "Ward lead", LeadsGroup: true})
	if err != nil {
		t.Fatalf("CreateRoleKind: %v", err)
	}
	if _, err := directory.SetRoleKindLeadsGroup(ctx, kind.ID, true); err != nil {
		t.Fatalf("SetRoleKindLeadsGroup: %v", err)
	}
	if _, err := directory.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: w.clerkID, GroupID: group, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole clerk: %v", err)
	}
}
