package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

type declaredGroupProbe struct {
	walk      stepRunWalk
	forms     string
	door      string
	ward      string
	otherWard string
	targeted  string
	untouched string
	street    string
	link      string
}

func (p declaredGroupProbe) stranger(t *testing.T, path string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	out := httptest.NewRecorder()
	p.walk.handler.ServeHTTP(out, req)
	return out
}

func (p declaredGroupProbe) resident(t *testing.T, id string) *http.Cookie {
	t.Helper()
	if err := p.walk.deps.Registry.AddMember(context.Background(), p.walk.instance, id, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember %s: %v", id, err)
	}
	return p.walk.cookieFor(t, id)
}

func (p declaredGroupProbe) claimedAfterDeclaring(t *testing.T, resident string, group, text string) *http.Cookie {
	t.Helper()
	cookie := p.resident(t, resident)
	registered := p.stranger(t, p.door+"/respondents", map[string]any{})
	if registered.Code != http.StatusOK {
		t.Fatalf("stranger registering: %d %s", registered.Code, registered.Body.String())
	}
	respondent := decodeObject(t, registered)
	declared := p.stranger(t, p.door+"/declarations", map[string]any{
		"respondent_id": respondent["id"], "public_key": respondent["public_key"],
		"declared_chapter_id": group, "declared_text": text,
	})
	if declared.Code != http.StatusCreated {
		t.Fatalf("declaring: %d %s", declared.Code, declared.Body.String())
	}
	claimed := p.walk.call(t, "POST", p.door+"/respondents/claim", map[string]any{"public_key": respondent["public_key"]}, cookie)
	if claimed.Code != http.StatusOK {
		t.Fatalf("claiming: %d %s", claimed.Code, claimed.Body.String())
	}
	return cookie
}

func newDeclaredGroupProbe(t *testing.T) declaredGroupProbe {
	t.Helper()
	w := newStepRunWalk(t, nil)
	p := declaredGroupProbe{walk: w, forms: "/instances/" + w.instance + "/forms", link: "declared-reach-key"}
	p.door = p.forms + "/public-links/" + p.link
	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)

	group := func(name string) string {
		rec := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": name}, w.owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create group %s: %d %s", name, rec.Code, rec.Body.String())
		}
		id, _ := decodeObject(t, rec)["id"].(string)
		return id
	}
	p.ward, p.otherWard = group("Kertváros"), group("Belváros")

	form := func(title, audience, groupID string) string {
		rec := w.call(t, "POST", p.forms+"/forms", map[string]any{"title": title, "audience": audience, "closes_at": closes}, w.owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create form %s: %d %s", title, rec.Code, rec.Body.String())
		}
		id, _ := decodeObject(t, rec)["id"].(string)
		if groupID != "" {
			if rec := w.call(t, "POST", p.forms+"/forms/"+id+"/targets", map[string]any{"chapter_id": groupID}, w.owner); rec.Code != http.StatusCreated {
				t.Fatalf("aim %s: %d %s", title, rec.Code, rec.Body.String())
			}
		}
		if rec := w.call(t, "POST", p.forms+"/forms/"+id+"/questions", map[string]any{"prompt": "How many", "answer_type": "free_text"}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("question %s: %d %s", title, rec.Code, rec.Body.String())
		}
		publish := map[string]any{}
		if audience == "public" {
			publish["candidate_link_key"] = p.link
		}
		if rec := w.call(t, "POST", p.forms+"/forms/"+id+"/publish", publish, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("publish %s: %d %s", title, rec.Code, rec.Body.String())
		}
		return id
	}
	p.street = form("Street survey", "public", "")
	p.targeted = form("Kertváros ward round", "member", p.ward)
	p.untouched = form("Belváros ward round", "member", p.otherWard)
	return p
}

func (p declaredGroupProbe) memberOfWard(t *testing.T) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	directory, err := p.walk.deps.Registry.ActorManager(ctx, p.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Ward member"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := p.walk.deps.Registry.AddMember(ctx, p.walk.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	if _, err := directory.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: p.ward}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	return p.walk.cookieFor(t, actor.ID)
}

func TestPublicFormDoor_DeclaringAWardDoesNotWidenWhatTheClaimedTokenReaches(t *testing.T) {
	p := newDeclaredGroupProbe(t)
	inWords := p.claimedAfterDeclaring(t, "claimer-in-words", "", "Mill Street")
	inWard := p.claimedAfterDeclaring(t, "claimer-in-ward", p.ward, "")
	outsider := p.resident(t, "never-claimed")

	member := p.memberOfWard(t)
	read := func(id string, as *http.Cookie) int {
		return p.walk.call(t, "GET", p.forms+"/forms/"+id, nil, as).Code
	}
	if got := read(p.targeted, member); got != http.StatusOK {
		t.Fatalf("control: a real member of the ward reading the ward's round: %d, want 200", got)
	}
	if got := read(p.street, inWard); got != http.StatusOK {
		t.Fatalf("control: the claimed token reading the form its link opens: %d, want 200", got)
	}
	if got := read(p.street, outsider); got == http.StatusOK {
		t.Fatalf("control: a resident who never claimed reading the link's form: %d, want it hidden", got)
	}
	for _, id := range []string{p.targeted, p.untouched} {
		if got := read(id, inWard); got != http.StatusNotFound {
			t.Errorf("token that declared a ward reading form %s: %d, want 404", id, got)
		}
	}

	instance := "/instances/" + p.walk.instance
	ward := instance + "/actor/groups/" + p.ward
	paths := []string{
		instance + "/actor/groups",
		instance + "/actor/groups/mine",
		instance + "/actor/groups/joinable",
		instance + "/actor/groups/discoverable",
		instance + "/actor/groups/led",
		ward,
		ward + "/dashboard",
		ward + "/leaders",
		ward + "/role-assignments",
		ward + "/assignments",
		ward + "/join-requests",
		ward + "/invitations",
		ward + "/population",
		ward + "/names",
		p.forms + "/forms",
		p.forms + "/forms/waiting",
		p.forms + "/forms/answered",
		p.forms + "/approvals/awaiting",
	}
	for _, id := range []string{p.targeted, p.untouched} {
		base := p.forms + "/forms/" + id
		paths = append(paths, base, base+"/questions", base+"/targets", base+"/answers", base+"/answers/mine",
			base+"/submissions", base+"/submissions/mine", base+"/declarations", base+"/declarations/count",
			base+"/results/latest", base+"/approvals", base+"/propagation")
	}

	for _, path := range paths {
		reference := p.walk.call(t, "GET", path, nil, inWords)
		outsiderSees := p.walk.call(t, "GET", path, nil, outsider)
		declared := p.walk.call(t, "GET", path, nil, inWard)
		if declared.Code != reference.Code {
			t.Errorf("GET %s: token that declared a ward got %d, token that declared in words got %d (%s)", path, declared.Code, reference.Code, declared.Body.String())
		}
		if outsiderSees.Code != declared.Code {
			t.Errorf("GET %s: token that declared a ward got %d, a resident who never claimed got %d", path, declared.Code, outsiderSees.Code)
		}
		for _, id := range []string{p.targeted, p.untouched} {
			if strings.Contains(declared.Body.String(), id) && !strings.Contains(reference.Body.String(), id) {
				t.Errorf("GET %s: declaring a ward made form %s appear", path, id)
			}
		}
	}

	for _, id := range []string{p.targeted, p.untouched} {
		answer := func(as *http.Cookie) int {
			return p.walk.call(t, "POST", p.forms+"/forms/"+id+"/answers", map[string]any{"answers": []map[string]any{}}, as).Code
		}
		if got, want := answer(inWard), answer(inWords); got != want {
			t.Errorf("POST answers to %s: token that declared a ward got %d, token that declared in words got %d", id, got, want)
		}
	}
}
