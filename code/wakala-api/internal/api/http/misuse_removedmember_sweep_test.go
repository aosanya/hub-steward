package http

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	accountingroutes "wakalaserver/modules/accounting/routes"
	actorroutes "wakalaserver/modules/actor/routes"
	agencyroutes "wakalaserver/modules/agency/routes"
	airoutes "wakalaserver/modules/ai/routes"
	assetroutes "wakalaserver/modules/assetmanager/routes"
	catalogroutes "wakalaserver/modules/catalog/routes"
	custodyroutes "wakalaserver/modules/custody/routes"
	twinroutes "wakalaserver/modules/digitaltwin/routes"
	engageroutes "wakalaserver/modules/engage/routes"
	gitroutes "wakalaserver/modules/git/routes"
	marketroutes "wakalaserver/modules/market/routes"
	riskroutes "wakalaserver/modules/riskmanager/routes"
	"wakalaserver/modules/shared/httpwire"
	sourcesroutes "wakalaserver/modules/sources/routes"
	taskmanagerroutes "wakalaserver/modules/taskmanager/routes"
	votingroutes "wakalaserver/modules/voting/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
)

type probeRoute struct {
	method string
	path   string
}

var routeParam = regexp.MustCompile(`\{([A-Za-z_]+)(\.\.\.)?\}`)

func mustShape(t *testing.T, routes []httpwire.Route, err error) []httpwire.Route {
	t.Helper()
	if err != nil {
		t.Fatalf("route shape: %v", err)
	}
	return routes
}

func instanceProbeRoutes(t *testing.T) []probeRoute {
	t.Helper()
	var out []probeRoute
	add := func(prefix string, routes []httpwire.Route) {
		for _, rt := range routes {
			out = append(out, probeRoute{method: rt.Method, path: prefix + rt.Path})
		}
	}
	add(actorInstancePrefix, actorroutes.Shape())
	add(agencyInstancePrefix, agencyroutes.Shape())
	add(taskmanagerInstancePrefix, taskmanagerroutes.Shape())
	add(accountingInstancePrefix, accountingroutes.Shape())
	add(commInstancePrefix, commGatedShape())
	add(formsInstancePrefix, formsGatedShape())
	add(formsCatalogInstancePrefix, catalogroutes.OperatorRoutesFor(formsCatalogShape{}, formsCatalogRouteMount))
	add(formsGitInstancePrefix, gitroutes.OperatorRoutes(formsGitShape{}, formsGitRouteMount))
	shape, err := airoutes.Table.Shape()
	add(aiInstancePrefix, mustShape(t, shape, err))
	shape, err = assetroutes.Table().Shape()
	add(assetManagerInstancePrefix, mustShape(t, shape, err))
	shape, err = custodyroutes.Table.Shape()
	add(custodyInstancePrefix, mustShape(t, shape, err))
	shape, err = twinroutes.Table.Shape()
	add(digitaltwinInstancePrefix, mustShape(t, shape, err))
	shape, err = engageroutes.Table.Shape()
	add(engageInstancePrefix, mustShape(t, shape, err))
	shape, err = marketroutes.Table.Shape()
	add(marketInstancePrefix, mustShape(t, shape, err))
	shape, err = riskroutes.Table.Shape()
	add(riskInstancePrefix, mustShape(t, shape, err))
	shape, err = sourcesroutes.Table.Shape()
	add(sourcesInstancePrefix, mustShape(t, shape, err))
	shape, err = votingroutes.Table.Shape()
	add(votingInstancePrefix, mustShape(t, shape, err))
	for _, line := range []string{
		"GET /instances/{instanceID}",
		"GET /instances/{instanceID}/approvals",
		"GET /instances/{instanceID}/approvals/{approvalID}",
		"POST /instances/{instanceID}/approvals",
		"POST /instances/{instanceID}/approvals/{approvalID}/amendment",
		"POST /instances/{instanceID}/approvals/{approvalID}/decision",
		"GET /instances/{instanceID}/group-roles",
		"POST /instances/{instanceID}/group-roles",
		"DELETE /instances/{instanceID}/group-roles/{groupID}/{roleID}",
		"GET /instances/{instanceID}/join-requests",
		"POST /instances/{instanceID}/join-requests/{userID}/approve",
		"POST /instances/{instanceID}/join-requests/{userID}/refuse",
		"GET /instances/{instanceID}/languages",
		"PUT /instances/{instanceID}/languages",
		"GET /instances/{instanceID}/me/name",
		"PUT /instances/{instanceID}/me/name",
		"GET /instances/{instanceID}/me/studio-language",
		"GET /instances/{instanceID}/module-tools",
		"GET /instances/{instanceID}/mounts",
		"GET /instances/{instanceID}/my-open-steps",
		"GET /instances/{instanceID}/my-roles",
		"GET /instances/{instanceID}/names",
		"GET /instances/{instanceID}/notification-rules",
		"GET /instances/{instanceID}/notification-rules/{event}",
		"PUT /instances/{instanceID}/notification-rules/{event}",
		"DELETE /instances/{instanceID}/notification-rules/{event}",
		"POST /instances/{instanceID}/notification-rules/{event}/preview",
		"GET /instances/{instanceID}/services",
		"POST /instances/{instanceID}/services",
		"DELETE /instances/{instanceID}/services/{service}",
		"POST /instances/{instanceID}/agents",
		"POST /instances/{instanceID}/api-keys",
		"POST /instances/{instanceID}/invitations",
		"POST /instances/{instanceID}/invitations/batch",
		"POST /instances/{instanceID}/join",
		"POST /instances/{instanceID}/review-runs",
		"POST /instances/{instanceID}/steps/{stepID}/answers",
		"POST /instances/{instanceID}/translations/answer",
		"POST /instances/{instanceID}/translations/drafts",
		"PUT /instances/{instanceID}/join-mode",
		"PUT /instances/{instanceID}/kind",
		"PUT /instances/{instanceID}/listing",
		"PUT /instances/{instanceID}/name",
		"PUT /instances/{instanceID}/members/{memberID}/agency-role",
		"DELETE /instances/{instanceID}/members/{actorID}",
		"DELETE /instances/{instanceID}/members/{actorID}/groups/{groupID}",
		"GET /me/agency-removals",
	} {
		method, path, _ := strings.Cut(line, " ")
		out = append(out, probeRoute{method: method, path: path})
	}
	return out
}

type probeIDs struct {
	instance string
	group    string
	step     string
	role     string
	workflow string
	draft    string
	member   string
}

func (ids probeIDs) fill(path string, real bool) string {
	return routeParam.ReplaceAllStringFunc(path, func(token string) string {
		name := strings.ToLower(routeParam.FindStringSubmatch(token)[1])
		switch {
		case name == "instanceid":
			return ids.instance
		case !real:
			return "no-such-thing"
		case strings.Contains(name, "group"):
			return ids.group
		case strings.Contains(name, "step"):
			return ids.step
		case strings.Contains(name, "role"):
			return ids.role
		case strings.Contains(name, "workflow"):
			return ids.workflow
		case strings.Contains(name, "draft"):
			return ids.draft
		case strings.Contains(name, "member"), strings.Contains(name, "user"), strings.Contains(name, "actor"):
			return ids.member
		}
		return "no-such-thing"
	})
}

type probeAnswer struct {
	code int
	body string
}

func (w stepRunWalk) ask(t *testing.T, route probeRoute, path string, as *http.Cookie) probeAnswer {
	t.Helper()
	var body any
	if route.method != "GET" {
		body = map[string]any{}
	}
	rec := w.call(t, route.method, path, body, as)
	return probeAnswer{code: rec.Code, body: strings.TrimSpace(rec.Body.String())}
}

func newRemovedProbe(t *testing.T) (stepRunWalk, probeIDs, *http.Cookie, *http.Cookie, *http.Cookie) {
	t.Helper()
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison")
	groups := w.call(t, "GET", "/instances/"+w.instance+"/actor/groups", nil, w.owner)
	list := decodeObjects(t, groups)
	groupID, _ := list[0]["id"].(string)
	var stepID string
	for _, id := range w.steps {
		stepID = id
		break
	}
	var roleID string
	for _, id := range w.roles {
		roleID = id
		break
	}
	ids := probeIDs{instance: w.instance, group: groupID, step: stepID, role: roleID, workflow: w.workflow, draft: w.draftID, member: w.subjectOf(t, w.people["Liaison"])}
	stranger := w.cookieFor(t, "stranger-never-a-member")
	return w, ids, w.people["Volunteer"], w.people["Liaison"], stranger
}

func TestRemovedMember_EveryInstanceRouteAnswersAsAStranger(t *testing.T) {
	w, ids, gone, _, stranger := newRemovedProbe(t)
	routes := instanceProbeRoutes(t)
	goneID := w.subjectOf(t, gone)

	beforeOK := 0
	for _, route := range routes {
		if route.method == "GET" && w.ask(t, route, ids.fill(route.path, true), gone).code < 300 {
			beforeOK++
		}
	}
	if beforeOK == 0 {
		t.Fatalf("the member read nothing before removal: the sweep would prove nothing")
	}
	t.Logf("before removal the member read %d GET routes with 2xx", beforeOK)

	if rec := w.call(t, "DELETE", "/instances/"+w.instance+"/members/"+goneID, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner removing the member: %d %s", rec.Code, rec.Body.String())
	}

	fakeInstance := ids
	fakeInstance.instance = "no-such-agency"
	var sameAsStranger, strangerLeaks []string
	for _, route := range routes {
		for _, real := range []bool{true, false} {
			path := ids.fill(route.path, real)
			g, s := w.ask(t, route, path, gone), w.ask(t, route, path, stranger)
			if g.code != s.code {
				sameAsStranger = append(sameAsStranger, fmt.Sprintf("%s %s: removed %d %.80q, stranger %d %.80q", route.method, path, g.code, g.body, s.code, s.body))
			}
			if strings.HasSuffix(route.path, "/join") {
				continue
			}
			f := w.ask(t, route, fakeInstance.fill(route.path, real), stranger)
			if f.code != s.code {
				strangerLeaks = append(strangerLeaks, fmt.Sprintf("%s %s: stranger on a real agency %d %.80q, on a missing agency %d %.80q", route.method, path, s.code, s.body, f.code, f.body))
			}
		}
	}
	sort.Strings(sameAsStranger)
	sort.Strings(strangerLeaks)
	t.Logf("%d routes probed, %d answered the removed member unlike a stranger, %d told a stranger the agency exists", len(routes), len(sameAsStranger), len(strangerLeaks))
	for _, line := range sameAsStranger {
		t.Errorf("removed member differs: %s", line)
	}
	for _, line := range strangerLeaks {
		t.Errorf("agency id leak: %s", line)
	}
}

type mcpPeer struct {
	client *mcp.ClientSession
}

func (w stepRunWalk) openMCP(t *testing.T, subject string) mcpPeer {
	t.Helper()
	ctx := accounts.WithID(t.Context(), subject)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(w.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "probe", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	return mcpPeer{client: client}
}

func (p mcpPeer) call(t *testing.T, tool string, args map[string]any) (bool, string) {
	t.Helper()
	out, err := p.client.CallTool(t.Context(), &mcp.CallToolParams{Name: tool, Arguments: args})
	if err != nil {
		return true, err.Error()
	}
	return out.IsError, toolErrorText(out)
}

func (p mcpPeer) tools(t *testing.T) []string {
	t.Helper()
	var names []string
	for tool, err := range p.client.Tools(t.Context(), nil) {
		if err != nil {
			t.Fatalf("list tools: %v", err)
		}
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	return names
}

func TestRemovedMember_OpenMCPSessionAndEveryToolAreRefused(t *testing.T) {
	w, ids, gone, _, _ := newRemovedProbe(t)
	goneID := w.subjectOf(t, gone)
	open := w.openMCP(t, goneID)
	tools := open.tools(t)

	before := 0
	for _, tool := range tools {
		if failed, _ := open.call(t, tool, map[string]any{"instance_id": ids.instance}); !failed {
			before++
		}
	}
	if before == 0 {
		t.Fatalf("the member's tools all failed before removal: the sweep would prove nothing")
	}
	t.Logf("before removal %d of %d tools answered the member with only instance_id", before, len(tools))

	if rec := w.call(t, "DELETE", "/instances/"+w.instance+"/members/"+goneID, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner removing the member: %d %s", rec.Code, rec.Body.String())
	}

	fresh := w.openMCP(t, goneID)
	stranger := w.openMCP(t, "stranger-never-a-member")
	var allowed []string
	for _, tool := range tools {
		for name, peer := range map[string]mcpPeer{"open session": open, "new session": fresh, "stranger": stranger} {
			if failed, text := peer.call(t, tool, map[string]any{"instance_id": ids.instance}); !failed {
				allowed = append(allowed, fmt.Sprintf("%s via %s: %.80q", tool, name, text))
			}
		}
	}
	sort.Strings(allowed)
	t.Logf("%d tool answers succeeded for someone outside the agency", len(allowed))
	for _, line := range allowed {
		t.Errorf("tool answered a non-member: %s", line)
	}
}

func TestRemovedMember_ReadmittedKeepsOnlyWhatTheNewSeatGives(t *testing.T) {
	w, ids, gone, _, _ := newRemovedProbe(t)
	goneID := w.subjectOf(t, gone)
	path := "/instances/" + w.instance
	if activeSeats(t, w, goneID) == 0 {
		t.Fatalf("the member held no seat before removal")
	}
	if rec := w.call(t, "DELETE", path+"/members/"+goneID, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner removing the member: %d %s", rec.Code, rec.Body.String())
	}
	if err := w.deps.Registry.AddMember(t.Context(), w.instance, goneID, agencies.RoleResident); err != nil {
		t.Fatalf("readmit: %v", err)
	}
	if n := activeSeats(t, w, goneID); n != 0 {
		t.Errorf("readmitted member holds %d active seats from before removal, want 0", n)
	}
	if rec := w.call(t, "GET", path+"/my-roles", nil, gone); rec.Code != http.StatusOK {
		t.Fatalf("readmitted member reading my-roles with the old session: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", path+"/actor/groups/"+ids.group+"/assignments", nil, gone); rec.Code < 400 {
		t.Logf("readmitted resident reads the group roster: %d", rec.Code)
	}
}

func (w stepRunWalk) callWithKey(t *testing.T, route probeRoute, path, token string) probeAnswer {
	t.Helper()
	var reader *strings.Reader
	if route.method != "GET" {
		reader = strings.NewReader("{}")
	} else {
		reader = strings.NewReader("")
	}
	req := httptest.NewRequest(route.method, path, reader)
	req.Header.Set("Authorization", "Bearer "+token)
	if route.method != "GET" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return probeAnswer{code: rec.Code, body: strings.TrimSpace(rec.Body.String())}
}

func TestRemovedAgencyKey_TokenIsRefusedOnEveryInstanceRoute(t *testing.T) {
	w, ids, _, _, _ := newRemovedProbe(t)
	keys, err := apikeys.NewManager(w.db)
	if err != nil {
		t.Fatalf("apikeys.NewManager: %v", err)
	}
	w.deps.APIKeys = keys
	ApplyCaches(w.deps)
	w.handler = NewRouter(w.deps)

	made := w.call(t, "POST", "/instances/"+w.instance+"/api-keys", map[string]any{"name": "probe key"}, w.owner)
	if made.Code != http.StatusCreated {
		t.Fatalf("owner minting an agency key: %d %s", made.Code, made.Body.String())
	}
	minted := decodeObject(t, made)
	token, _ := minted["token"].(string)
	keyID, _ := minted["id"].(string)
	account := apikeys.AgencyKeyCaller(keyID)
	if token == "" || keyID == "" {
		t.Fatalf("agency key reply carries no token or id: %s", made.Body.String())
	}

	routes := instanceProbeRoutes(t)
	read := probeRoute{method: "GET", path: "/instances/{instanceID}"}
	if got := w.callWithKey(t, read, ids.fill(read.path, true), token); got.code != http.StatusOK {
		t.Fatalf("agency key reading its agency: %d %s, want 200", got.code, got.body)
	}
	warmed := 0
	for _, route := range routes {
		if route.method == "GET" && w.callWithKey(t, route, ids.fill(route.path, true), token).code < 300 {
			warmed++
		}
	}
	t.Logf("before removal the key read %d GET routes with 2xx", warmed)

	if rec := w.call(t, "DELETE", "/instances/"+w.instance+"/members/"+account, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner removing the key's agent: %d %s", rec.Code, rec.Body.String())
	}

	stranger := w.cookieFor(t, "stranger-never-a-member")
	var differ []string
	for _, route := range routes {
		if strings.HasSuffix(route.path, "/api-keys") {
			continue
		}
		path := ids.fill(route.path, true)
		k, s := w.callWithKey(t, route, path, token), w.ask(t, route, path, stranger)
		if k.code != s.code {
			differ = append(differ, fmt.Sprintf("%s %s: removed key %d %.80q, stranger %d %.80q", route.method, path, k.code, k.body, s.code, s.body))
		}
	}
	sort.Strings(differ)
	t.Logf("%d routes probed, %d answered the removed agency key unlike a stranger", len(routes), len(differ))
	for _, line := range differ {
		t.Errorf("removed key differs: %s", line)
	}
}
