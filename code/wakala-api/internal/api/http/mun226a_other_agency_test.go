package http

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/formsettings"
	"wakalaserver/internal/languages"
	"wakalaserver/internal/notifyrules"
	accountingroutes "wakalaserver/modules/accounting/routes"
	mwanachamaactor "wakalaserver/modules/actor"
	agencyroutes "wakalaserver/modules/agency/routes"
	airoutes "wakalaserver/modules/ai/routes"
	assetroutes "wakalaserver/modules/assetmanager/routes"
	catalogroutes "wakalaserver/modules/catalog/routes"
	gitroutes "wakalaserver/modules/git/routes"
	"wakalaserver/modules/shared/dispatch"
	sourcesroutes "wakalaserver/modules/sources/routes"
)

const (
	mun226aRoundSize   = 15
	mun226aFakeID      = "00000000-0000-4000-8000-00000000dead"
	mun226aMuxNotFound = "404 page not found"
)

var mun226aPlaceholder = regexp.MustCompile(`\{[^}]+\}`)

type mun226aRoute struct {
	method, pattern string
}

func (r mun226aRoute) String() string { return r.method + " " + r.pattern }

type mun226aWorld struct {
	handler    http.Handler
	deps       *Deps
	reg        agencies.Registry
	ownerA     *http.Cookie
	ownerB     *http.Cookie
	residentB  *http.Cookie
	instanceA  string
	instanceB  string
	groupA     string
	nameA      string
	cookieMint func(subject string) *http.Cookie
}

func newMUN226aWorld(t *testing.T) mun226aWorld {
	t.Helper()
	walk := newStepRunWalk(t, nil)
	walk.deps.AI = NewAIResolver(walk.db, walk.deps.Registry, []byte("0123456789abcdef0123456789abcdef"))
	walk.deps.APIKeys = mun226aMust(apikeys.NewManager(walk.db))
	walk.deps.NotifyRules = mun226aMust(notifyrules.NewStore(walk.db))
	walk.deps.Languages = mun226aMust(languages.NewStore(walk.db))
	walk.deps.FormsSettings = mun226aMust(formsettings.NewStore(walk.db))
	walk.deps.PlatformOwners = []string{"platform-owner"}
	handler := NewRouter(walk.deps)
	walk.handler = handler

	w := mun226aWorld{
		handler: handler,
		deps:    walk.deps,
		reg:     walk.deps.Registry,
		ownerA:  walk.cookieFor(t, "owner-of-agency-a"),
		ownerB:  walk.cookieFor(t, "owner-of-agency-b"),
		nameA:   "Agency A Health",
		cookieMint: func(subject string) *http.Cookie {
			return walk.cookieFor(t, subject)
		},
	}

	w.instanceA = createInstanceFor(t, handler, w.ownerA, w.nameA)
	w.instanceB = createInstanceFor(t, handler, w.ownerB, "Agency B Water")

	group := callOn(handler, "POST", "/instances/"+w.instanceA+"/actor/groups", map[string]any{"name": "Agency A Staff"}, w.ownerA)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group in A: %d %s", group.Code, group.Body.String())
	}
	w.groupA, _ = decodeObject(t, group)["id"].(string)

	ctx := context.Background()
	um, err := w.reg.ActorManager(ctx, w.instanceB)
	if err != nil {
		t.Fatalf("ActorManager B: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident of B"})
	if err != nil {
		t.Fatalf("CreateActor in B: %v", err)
	}
	if err := w.reg.AddMember(ctx, w.instanceB, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember in B: %v", err)
	}
	w.residentB = w.cookieMint(actor.ID)
	return w
}

func createInstanceFor(t *testing.T, handler http.Handler, owner *http.Cookie, name string) string {
	t.Helper()
	rec := callOn(handler, "POST", "/instances", map[string]any{"name": name}, owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create instance %s: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func mun226aWriteMethod(method string) bool {
	return method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE"
}

func mun226aInstanceRoutes(d *Deps) []mun226aRoute {
	seen := map[string]bool{}
	var out []mun226aRoute
	add := func(method, pattern string) {
		if !mun226aWriteMethod(method) || !strings.Contains(pattern, "{instanceID}") {
			return
		}
		key := method + " " + pattern
		if seen[key] {
			return
		}
		seen[key] = true
		out = append(out, mun226aRoute{method, pattern})
	}
	addRoutes := func(prefix string, routes []dispatch.Route) {
		for _, rt := range routes {
			add(rt.Method, prefix+rt.Path)
		}
	}

	for _, mount := range mountedOperations(d) {
		s, err := dispatch.Parse(mount.operations)
		if err != nil {
			continue
		}
		for _, op := range s.Operations {
			add(op.Method, mount.prefix+s.Base+op.Path)
		}
	}
	addRoutes(agencyInstancePrefix, agencyroutes.Shape())
	addRoutes(formsInstancePrefix, formsGatedShape())
	addRoutes(commInstancePrefix, commGatedShape())
	addRoutes(accountingInstancePrefix, accountingroutes.Shape())
	addRoutes(assetManagerInstancePrefix, mun226aMust(assetroutes.Table().Shape()))
	addRoutes(sourcesInstancePrefix, mun226aMust(sourcesroutes.Table.Shape()))
	for _, rt := range mun226aMust(airoutes.Table.Shape()) {
		pattern := strings.Replace(rt.Pattern(aiInstancePrefix), "/agencies/{agencyID}", "", 1)
		method, path, _ := strings.Cut(pattern, " ")
		add(method, path)
	}
	addRoutes(formsCatalogInstancePrefix, catalogroutes.OperatorRoutesFor(formsCatalogShape{}, formsCatalogRouteMount))
	addRoutes(formsGitInstancePrefix, gitroutes.OperatorRoutes(formsGitShape{}, formsGitRouteMount))

	for _, s := range []string{
		"PUT /instances/{instanceID}/members/{memberID}/agency-role",
		"POST /instances/{instanceID}/api-keys",
		"POST /instances/{instanceID}/approvals",
		"POST /instances/{instanceID}/approvals/{approvalID}/decision",
		"POST /instances/{instanceID}/approvals/{approvalID}/amendment",
		"PUT /instances/{instanceID}/listing",
		"PUT " + formsApprovalPath,
		"POST /instances/{instanceID}/group-roles",
		"DELETE /instances/{instanceID}/group-roles/{groupID}/{roleID}",
		"POST /instances/{instanceID}/leave",
		"PUT /instances/{instanceID}/join-mode",
		"PUT /instances/{instanceID}/name",
		"POST /instances/{instanceID}/join-requests/{userID}/approve",
		"POST /instances/{instanceID}/join-requests/{userID}/refuse",
		"PUT /instances/{instanceID}/languages",
		"PUT /instances/{instanceID}/kind",
		"POST /instances/{instanceID}/agents",
		"DELETE /instances/{instanceID}/members/{actorID}/groups/{groupID}",
		"DELETE /instances/{instanceID}/members/{actorID}",
		"POST /instances/{instanceID}/invitations",
		"POST /instances/{instanceID}/invitations/batch",
		"POST /instances/{instanceID}/review-runs",
		"POST /instances/{instanceID}/live-records/{recordCode}/rows",
		"PUT /instances/{instanceID}/me/name",
		"POST /instances/{instanceID}/services",
		"DELETE /instances/{instanceID}/services/{service}",
		"PUT /instances/{instanceID}/notification-rules/{event}",
		"DELETE /instances/{instanceID}/notification-rules/{event}",
		"POST /instances/{instanceID}/notification-rules/{event}/preview",
		"POST /platform/agencies/{instanceID}/approve",
		"POST /platform/agencies/{instanceID}/decline",
		"POST /instances/{instanceID}/steps/{stepID}/answers",
		"POST /instances/{instanceID}/translations/drafts",
		"POST /instances/{instanceID}/translations/answer",
	} {
		method, path, _ := strings.Cut(s, " ")
		add(method, path)
	}

	sort.Slice(out, func(i, j int) bool { return out[i].String() < out[j].String() })
	return out
}

func mun226aMust[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

func mun226aFill(pattern, instanceID, otherID string) string {
	return mun226aPlaceholder.ReplaceAllStringFunc(pattern, func(m string) string {
		if m == "{instanceID}" {
			return instanceID
		}
		return otherID
	})
}

var mun226aValidBodies = map[string]map[string]any{
	"POST /instances/{instanceID}/api-keys": {"name": "probe"},
	"PUT /instances/{instanceID}/name":      {"name": "Hijacked"},
}

type mun226aAnswer struct {
	code     int
	body     string
	panicked bool
}

func (w mun226aWorld) send(route mun226aRoute, path string, as *http.Cookie) (answer mun226aAnswer) {
	defer func() {
		if recover() != nil {
			answer.panicked = true
		}
	}()
	body := map[string]any{}
	if valid, ok := mun226aValidBodies[route.String()]; ok {
		body = valid
	}
	rec := callOn(w.handler, route.method, path, body, as)
	return mun226aAnswer{code: rec.Code, body: rec.Body.String()}
}

func (w mun226aWorld) leaks(body string) []string {
	var found []string
	for _, mark := range []string{w.nameA, "Agency A", "owner-of-agency-a"} {
		if strings.Contains(body, mark) {
			found = append(found, mark)
		}
	}
	return found
}

type mun226aTally struct {
	probed, refused, notMounted int
	defects                     []string
}

func (w mun226aWorld) probeRound(routes []mun226aRoute, otherID string, exempt map[string]bool) mun226aTally {
	var tally mun226aTally
	for _, route := range routes {
		tally.probed++
		pathA := mun226aFill(route.pattern, w.instanceA, otherID)
		answer := w.send(route, pathA, w.residentB)
		switch {
		case answer.panicked:
			tally.defects = append(tally.defects, fmt.Sprintf("%s panicked", route))
		case strings.TrimSpace(answer.body) == mun226aMuxNotFound:
			tally.notMounted++
		case answer.code >= 500:
			tally.defects = append(tally.defects, fmt.Sprintf("%s answered %d %q", route, answer.code, answer.body))
		case answer.code < 400 && !exempt[route.String()]:
			tally.defects = append(tally.defects, fmt.Sprintf("%s answered %d %q to a resident of agency B", route, answer.code, answer.body))
		default:
			tally.refused++
		}
		if answer.code >= 400 && answer.code < 500 {
			if found := w.leaks(answer.body); len(found) > 0 {
				tally.defects = append(tally.defects, fmt.Sprintf("%s refusal %d names agency A (%v): %q", route, answer.code, found, answer.body))
			}
		}
	}
	return tally
}

func mun226aRounds(routes []mun226aRoute) [][]mun226aRoute {
	var rounds [][]mun226aRoute
	for len(routes) > 0 {
		n := min(mun226aRoundSize, len(routes))
		rounds = append(rounds, routes[:n])
		routes = routes[n:]
	}
	return rounds
}

func TestMUN226a_ResidentOfAnotherAgencyIsRefusedOnEveryWriteRoute(t *testing.T) {
	w := newMUN226aWorld(t)
	routes := mun226aInstanceRoutes(w.deps)
	rounds := mun226aRounds(routes)
	t.Logf("write routes with an agency id in the path: %d, in %d rounds of %d", len(routes), len(rounds), mun226aRoundSize)

	exempt := map[string]bool{}
	for _, idPass := range []struct{ name, id string }{{"fabricated ids", mun226aFakeID}, {"agency A group id", w.groupA}} {
		t.Run(idPass.name, func(t *testing.T) {
			for i, round := range rounds {
				tally := w.probeRound(round, idPass.id, exempt)
				t.Logf("round %d: %d routes, %d refused, %d not mounted in the test, %d defects", i+1, tally.probed, tally.refused, tally.notMounted, len(tally.defects))
				for _, d := range tally.defects {
					t.Errorf("round %d: %s", i+1, d)
				}
			}
		})
	}
}

func TestMUN226a_RefusalToAnotherAgencyReadsLikeAnAgencyThatDoesNotExist(t *testing.T) {
	w := newMUN226aWorld(t)
	var oracle []string
	for _, route := range mun226aInstanceRoutes(w.deps) {
		toA := w.send(route, mun226aFill(route.pattern, w.instanceA, mun226aFakeID), w.residentB)
		toNobody := w.send(route, mun226aFill(route.pattern, mun226aFakeID, mun226aFakeID), w.residentB)
		if toA.panicked || toNobody.panicked || strings.TrimSpace(toA.body) == mun226aMuxNotFound {
			continue
		}
		bodyA := strings.ReplaceAll(toA.body, w.instanceA, mun226aFakeID)
		if toA.code != toNobody.code || bodyA != toNobody.body {
			oracle = append(oracle, fmt.Sprintf("%s: agency A -> %d %q, unknown agency -> %d %q", route, toA.code, toA.body, toNobody.code, toNobody.body))
		}
	}
	t.Logf("routes whose answer tells a real agency from a missing one: %d", len(oracle))
	for _, line := range oracle {
		t.Errorf("%s", line)
	}
}

func TestMUN226a_AgencyAIsUntouchedAfterTheSweep(t *testing.T) {
	w := newMUN226aWorld(t)
	before := w.snapshotOfA(t)
	for _, route := range mun226aInstanceRoutes(w.deps) {
		w.send(route, mun226aFill(route.pattern, w.instanceA, w.groupA), w.residentB)
		w.send(route, mun226aFill(route.pattern, w.instanceA, mun226aFakeID), w.residentB)
	}
	after := w.snapshotOfA(t)
	if before != after {
		t.Fatalf("agency A changed under a resident of agency B:\nbefore %s\nafter  %s", before, after)
	}
}

func (w mun226aWorld) snapshotOfA(t *testing.T) string {
	t.Helper()
	var parts []string
	for _, path := range []string{"", "/actor/groups", "/members", "/join-requests", "/services", "/live-records", "/listing", "/join-mode"} {
		rec := callOn(w.handler, "GET", "/instances/"+w.instanceA+path, nil, w.ownerA)
		parts = append(parts, fmt.Sprintf("%s=%d:%s", path, rec.Code, rec.Body.String()))
	}
	return strings.Join(parts, "\n")
}

var mun226aReadSegments = map[string]bool{
	"get": true, "list": true, "read": true, "count": true, "search": true, "find": true,
	"check": true, "resolve": true, "view": true, "traverse": true, "query": true,
	"neighborhood": true, "tree": true, "diff": true, "log": true,
	"balance": true, "descendants": true, "expired": true, "lookup": true, "dashboard": true,
	"counts": true, "trail": true, "rollup": true,
}

func mun226aWriteTool(name string) bool {
	for _, segment := range strings.Split(name, "_") {
		if mun226aReadSegments[segment] {
			return false
		}
	}
	return true
}

func mun226aToolArguments(tool *mcp.Tool, instanceID, otherID string) (map[string]any, bool) {
	schema, ok := tool.InputSchema.(map[string]any)
	if !ok {
		return nil, false
	}
	props, _ := schema["properties"].(map[string]any)
	args := map[string]any{}
	scoped := false
	for name, raw := range props {
		spec, _ := raw.(map[string]any)
		lower := strings.ToLower(name)
		if lower == "instance_id" || lower == "instanceid" {
			args[name] = instanceID
			scoped = true
			continue
		}
		if choices, ok := spec["enum"].([]any); ok && len(choices) > 0 {
			args[name] = choices[0]
			continue
		}
		kind := spec["type"]
		if kinds, ok := kind.([]any); ok {
			for _, k := range kinds {
				if k != "null" {
					kind = k
					break
				}
			}
		}
		switch kind {
		case "string":
			args[name] = otherID
		case "integer", "number":
			args[name] = 1
		case "boolean":
			args[name] = false
		case "array":
			args[name] = []any{}
		case "object":
			args[name] = map[string]any{}
		}
	}
	return args, scoped
}

func TestMUN226a_ResidentOfAnotherAgencyIsRefusedOnEveryWriteTool(t *testing.T) {
	w := newMUN226aWorld(t)
	server := httptest.NewServer(w.handler)
	t.Cleanup(server.Close)

	ctx := context.Background()
	transport := &mcp.StreamableClientTransport{
		Endpoint:   server.URL + mcpPath,
		HTTPClient: &http.Client{Transport: sessionCookie{cookie: w.residentB}},
	}
	session, err := mcp.NewClient(&mcp.Implementation{Name: "mun226a", Version: "1"}, nil).Connect(ctx, transport, nil)
	if err != nil {
		t.Fatalf("connect over /mcp: %v", err)
	}
	t.Cleanup(func() { session.Close() })

	var tools []*mcp.Tool
	for tool, err := range session.Tools(ctx, nil) {
		if err != nil {
			t.Fatalf("list tools: %v", err)
		}
		tools = append(tools, tool)
	}
	sort.Slice(tools, func(i, j int) bool { return tools[i].Name < tools[j].Name })

	var probed []*mcp.Tool
	for _, tool := range tools {
		if !mun226aWriteTool(tool.Name) {
			continue
		}
		if _, scoped := mun226aToolArguments(tool, w.instanceA, mun226aFakeID); scoped {
			probed = append(probed, tool)
		}
	}
	t.Logf("tools served: %d, write tools that take an agency id: %d", len(tools), len(probed))

	before := w.snapshotOfA(t)
	for _, idPass := range []struct{ name, id string }{{"fabricated ids", mun226aFakeID}, {"agency A group id", w.groupA}} {
		for start := 0; start < len(probed); start += mun226aRoundSize {
			end := min(start+mun226aRoundSize, len(probed))
			refused := 0
			for _, tool := range probed[start:end] {
				args, _ := mun226aToolArguments(tool, w.instanceA, idPass.id)
				result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: tool.Name, Arguments: args})
				text := ""
				if err != nil {
					text = err.Error()
				} else {
					for _, content := range result.Content {
						if c, ok := content.(*mcp.TextContent); ok {
							text += c.Text
						}
					}
				}
				switch {
				case err == nil && !result.IsError:
					t.Errorf("%s (%s) answered without error to a resident of agency B: %q", tool.Name, idPass.name, text)
				case strings.Contains(text, "validating"):
					t.Errorf("%s (%s) was refused for its arguments, not for the agency: %q", tool.Name, idPass.name, text)
				case len(w.leaks(text)) > 0:
					t.Errorf("%s (%s) refusal names agency A: %q", tool.Name, idPass.name, text)
				default:
					refused++
				}
			}
			t.Logf("%s, tools %d to %d: %d probed, %d refused", idPass.name, start+1, end, end-start, refused)
		}
	}
	if after := w.snapshotOfA(t); before != after {
		t.Fatalf("agency A changed under a resident of agency B:\nbefore %s\nafter  %s", before, after)
	}

	ownerTransport := &mcp.StreamableClientTransport{
		Endpoint:   server.URL + mcpPath,
		HTTPClient: &http.Client{Transport: sessionCookie{cookie: w.ownerA}},
	}
	ownerSession, err := mcp.NewClient(&mcp.Implementation{Name: "mun226a-owner", Version: "1"}, nil).Connect(ctx, ownerTransport, nil)
	if err != nil {
		t.Fatalf("connect owner of A over /mcp: %v", err)
	}
	t.Cleanup(func() { ownerSession.Close() })
	accepted := 0
	for _, tool := range probed {
		args, _ := mun226aToolArguments(tool, w.instanceA, mun226aFakeID)
		result, err := ownerSession.CallTool(ctx, &mcp.CallToolParams{Name: tool.Name, Arguments: args})
		if err == nil && !result.IsError {
			accepted++
		}
	}
	t.Logf("control: the owner of A is accepted on %d of %d of the same tools", accepted, len(probed))
	if accepted == 0 {
		t.Fatalf("the owner of A is refused on every tool, the probe cannot tell a refusal for the agency from a refusal for the arguments")
	}
}

func TestMUN226a_ControlTheSameRoutesAnswerTheOwnersOfAAndTheResidentOfBDifferently(t *testing.T) {
	w := newMUN226aWorld(t)
	if rec := callOn(w.handler, "PUT", "/instances/"+w.instanceB+"/me/name", map[string]any{"display_name": "Resident B"}, w.residentB); rec.Code >= 400 {
		t.Fatalf("resident of B writing own name in B: %d %s, want success", rec.Code, rec.Body.String())
	}
	if rec := callOn(w.handler, "PUT", "/instances/"+w.instanceA+"/me/name", map[string]any{"display_name": "Resident B"}, w.residentB); rec.Code < 400 {
		t.Fatalf("resident of B writing a name in A: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := callOn(w.handler, "PUT", "/instances/"+w.instanceA+"/name", map[string]any{"name": "Agency A Health"}, w.ownerA); rec.Code >= 400 {
		t.Fatalf("owner of A renaming A: %d %s, want success", rec.Code, rec.Body.String())
	}
	asB := map[int]int{}
	asOwnerA := map[int]int{}
	passed := 0
	routes := mun226aInstanceRoutes(w.deps)
	for _, route := range routes {
		path := mun226aFill(route.pattern, w.instanceA, mun226aFakeID)
		b := w.send(route, path, w.residentB)
		a := w.send(route, path, w.ownerA)
		asB[b.code]++
		asOwnerA[a.code]++
		if a.code != b.code || a.body != b.body {
			passed++
		}
	}
	t.Logf("routes: %d; resident of B answers %v; owner of A answers %v; routes where the two answers differ: %d", len(routes), asB, asOwnerA, passed)
	if passed < len(routes)/2 {
		t.Fatalf("only %d of %d routes answer the owner of A differently from the resident of B, the probe may be refused for a reason other than the agency", passed, len(routes))
	}
}
