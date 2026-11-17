package http

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func otherAgencyReadMethod(method string) bool {
	return method == "GET"
}

func otherAgencyReadRoutes(w otherAgencyWorld) []otherAgencyRoute {
	return otherAgencyRoutesWhere(w.deps, otherAgencyReadMethod)
}

func TestOtherAgency_ResidentOfAnotherAgencyIsRefusedOnEveryReadRoute(t *testing.T) {
	w := newOtherAgencyWorld(t)
	routes := otherAgencyReadRoutes(w)
	rounds := otherAgencyRounds(routes)
	t.Logf("read routes with an agency id in the path: %d, in %d rounds of %d", len(routes), len(rounds), otherAgencyRoundSize)

	for _, idPass := range []struct{ name, id string }{{"fabricated ids", otherAgencyFakeID}, {"agency A group id", w.groupA}} {
		t.Run(idPass.name, func(t *testing.T) {
			for i, round := range rounds {
				tally := w.probeRound(round, idPass.id, map[string]bool{})
				t.Logf("round %d: %d routes, %d refused, %d not mounted in the test, %d defects", i+1, tally.probed, tally.refused, tally.notMounted, len(tally.defects))
				for _, d := range tally.defects {
					t.Errorf("round %d: %s", i+1, d)
				}
			}
		})
	}
}

func TestOtherAgency_ReadRefusalToAnotherAgencyReadsLikeAnAgencyThatDoesNotExist(t *testing.T) {
	w := newOtherAgencyWorld(t)
	var oracle []string
	routes := otherAgencyReadRoutes(w)
	for _, route := range routes {
		toA := w.send(route, otherAgencyFill(route.pattern, w.instanceA, otherAgencyFakeID), w.residentB)
		toNobody := w.send(route, otherAgencyFill(route.pattern, otherAgencyFakeID, otherAgencyFakeID), w.residentB)
		if toA.panicked || toNobody.panicked || strings.TrimSpace(toA.body) == otherAgencyMuxNotFound {
			continue
		}
		bodyA := strings.ReplaceAll(toA.body, w.instanceA, otherAgencyFakeID)
		if toA.code != toNobody.code || bodyA != toNobody.body {
			oracle = append(oracle, fmt.Sprintf("%s: agency A -> %d %q, unknown agency -> %d %q", route, toA.code, toA.body, toNobody.code, toNobody.body))
		}
	}
	t.Logf("read routes: %d; those whose answer tells a real agency from a missing one: %d", len(routes), len(oracle))
	for _, line := range oracle {
		t.Errorf("%s", line)
	}
}

func TestOtherAgency_ControlTheOwnerOfAReadsWhatTheResidentOfBIsRefused(t *testing.T) {
	w := newOtherAgencyWorld(t)
	routes := otherAgencyReadRoutes(w)
	asB := map[int]int{}
	asOwnerA := map[int]int{}
	differ := 0
	for _, route := range routes {
		path := otherAgencyFill(route.pattern, w.instanceA, otherAgencyFakeID)
		b := w.send(route, path, w.residentB)
		a := w.send(route, path, w.ownerA)
		asB[b.code]++
		asOwnerA[a.code]++
		if a.code != b.code || a.body != b.body {
			differ++
		}
	}
	t.Logf("read routes: %d; resident of B answers %v; owner of A answers %v; routes where the two answers differ: %d", len(routes), asB, asOwnerA, differ)
	if differ < len(routes)/2 {
		t.Fatalf("only %d of %d read routes answer the owner of A differently from the resident of B, the probe may be refused for a reason other than the agency", differ, len(routes))
	}
}

func TestOtherAgency_ResidentOfAnotherAgencyIsRefusedOnEveryReadTool(t *testing.T) {
	w := newOtherAgencyWorld(t)
	server := httptest.NewServer(w.handler)
	t.Cleanup(server.Close)

	ctx := context.Background()
	connect := func(name string, cookie *http.Cookie) *mcp.ClientSession {
		transport := &mcp.StreamableClientTransport{
			Endpoint:   server.URL + mcpPath,
			HTTPClient: &http.Client{Transport: sessionCookie{cookie: cookie}},
		}
		session, err := mcp.NewClient(&mcp.Implementation{Name: name, Version: "1"}, nil).Connect(ctx, transport, nil)
		if err != nil {
			t.Fatalf("connect %s over /mcp: %v", name, err)
		}
		t.Cleanup(func() { session.Close() })
		return session
	}
	session := connect("otherAgencyReads", w.residentB)

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
		if otherAgencyWriteTool(tool.Name) {
			continue
		}
		if _, scoped := otherAgencyToolArguments(tool, w.instanceA, otherAgencyFakeID); scoped {
			probed = append(probed, tool)
		}
	}
	t.Logf("tools served: %d, read tools that take an agency id: %d", len(tools), len(probed))

	answer := func(s *mcp.ClientSession, tool *mcp.Tool, id string) (string, bool) {
		args, _ := otherAgencyToolArguments(tool, w.instanceA, id)
		result, err := s.CallTool(ctx, &mcp.CallToolParams{Name: tool.Name, Arguments: args})
		if err != nil {
			return err.Error(), true
		}
		text := ""
		for _, content := range result.Content {
			if c, ok := content.(*mcp.TextContent); ok {
				text += c.Text
			}
		}
		return text, result.IsError
	}

	for _, idPass := range []struct{ name, id string }{{"fabricated ids", otherAgencyFakeID}, {"agency A group id", w.groupA}} {
		for start := 0; start < len(probed); start += otherAgencyRoundSize {
			end := min(start+otherAgencyRoundSize, len(probed))
			refused := 0
			for _, tool := range probed[start:end] {
				text, isError := answer(session, tool, idPass.id)
				switch {
				case !isError:
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

	owner := connect("otherAgencyReadsOwner", w.ownerA)
	accepted := 0
	for _, tool := range probed {
		if _, isError := answer(owner, tool, otherAgencyFakeID); !isError {
			accepted++
		}
	}
	t.Logf("control: the owner of A is accepted on %d of %d of the same tools", accepted, len(probed))
	if accepted == 0 {
		t.Fatalf("the owner of A is refused on every read tool, the probe cannot tell a refusal for the agency from a refusal for the arguments")
	}
}

func TestOtherAgency_ResidentOfBReadingItsOwnAgencyWithIdsOfAgencyAGetsNothingOfA(t *testing.T) {
	w := newOtherAgencyWorld(t)
	routes := otherAgencyReadRoutes(w)
	opened := 0
	for _, route := range routes {
		path := otherAgencyFill(route.pattern, w.instanceB, w.groupA)
		answer := w.send(route, path, w.residentB)
		if answer.panicked {
			t.Errorf("%s panicked", route)
			continue
		}
		if answer.code >= 500 {
			t.Errorf("%s answered %d %q", route, answer.code, answer.body)
		}
		if answer.code < 300 {
			opened++
		}
		for _, mark := range append(w.leaks(answer.body), w.groupA) {
			if strings.Contains(answer.body, mark) {
				t.Errorf("%s in agency B with agency A's group id answered %d and names %q: %q", route, answer.code, mark, answer.body)
				break
			}
		}
	}
	t.Logf("read routes: %d; answered 2xx in agency B: %d", len(routes), opened)
}
