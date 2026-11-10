package mcp

import (
	"reflect"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/modules/shared/dispatch"
)

type lineThing struct {
	ID          string
	Code        string
	Name        string
	Severity    string
	RoleID      string
	DraftID     string
	CreatedAt   string
	Count       int64
	hidden      string
	AssignedTo  string
	TargetType  string
	Enabled     bool
	LastUpdated string
}

func TestLineLeadsWithTheCodeAndQuotedNameThenFactsThenReferences(t *testing.T) {
	got := line(reflect.ValueOf(lineThing{
		ID: "r-1", Code: "lead", Name: "Team lead", Severity: "high", RoleID: "role-9",
		DraftID: "skipped", CreatedAt: "skipped", LastUpdated: "skipped", TargetType: "role",
	}))
	want := `lead "Team lead" (severity: high, target type: role, id: r-1, role id: role-9)`
	if got != want {
		t.Fatalf("line = %q, want %q", got, want)
	}
}

func TestLineReadsThroughAPointer(t *testing.T) {
	got := line(reflect.ValueOf(&lineThing{Name: "Only a name"}))
	if got != `"Only a name"` {
		t.Fatalf("line = %q", got)
	}
}

func TestLineWithoutHeadShowsOnlyTheAside(t *testing.T) {
	got := line(reflect.ValueOf(lineThing{ID: "x-1", Severity: "low"}))
	if got != "severity: low, id: x-1" {
		t.Fatalf("line = %q", got)
	}
}

func TestLineWithNothingToShowSaysSo(t *testing.T) {
	if got := line(reflect.ValueOf(lineThing{})); got != "(no identifying fields)" {
		t.Fatalf("line = %q", got)
	}
}

func TestLinePrintsAPlainValueAsItIs(t *testing.T) {
	if got := line(reflect.ValueOf("plain")); got != "plain" {
		t.Fatalf("line = %q", got)
	}
	if got := line(reflect.ValueOf(7)); got != "7" {
		t.Fatalf("line = %q", got)
	}
}

func TestLineQuotesUnprintableValues(t *testing.T) {
	got := line(reflect.ValueOf(lineThing{Code: "a\x00b"}))
	if got != `"a\x00b"` {
		t.Fatalf("line = %q", got)
	}
}

func TestDescribeListsEachItemOrSaysThereAreNone(t *testing.T) {
	got := describe([]lineThing{{Code: "a"}, {Code: "b", Name: "Bee"}})
	if got != "- a\n- b \"Bee\"" {
		t.Fatalf("describe = %q", got)
	}
	if got := describe([]lineThing{}); got != "There are none yet." {
		t.Fatalf("describe of an empty list = %q", got)
	}
	if got := describe(lineThing{Code: "solo"}); got != "solo" {
		t.Fatalf("describe of one value = %q", got)
	}
}

func TestHeadlineCountsAListAndOtherwiseSaysDone(t *testing.T) {
	if got := headline([]int{1, 2, 3}); got != "Found 3." {
		t.Fatalf("headline = %q", got)
	}
	if got := headline([]int{}); got != "Found 0." {
		t.Fatalf("headline = %q", got)
	}
	if got := headline(lineThing{}); got != "Done." {
		t.Fatalf("headline = %q", got)
	}
}

func TestStructuredWrapsAListInItemsAndLeavesAnObjectAlone(t *testing.T) {
	wrapped, ok := structured([]int{1, 2}).(map[string]any)
	if !ok || !reflect.DeepEqual(wrapped["items"], []int{1, 2}) {
		t.Fatalf("a list must come back under items: %#v", wrapped)
	}
	thing := lineThing{Code: "c"}
	if got := structured(thing); !reflect.DeepEqual(got, thing) {
		t.Fatalf("an object must come back as it is: %#v", got)
	}
}

func TestReferenceSpacesAndLowercasesCamelCase(t *testing.T) {
	cases := map[string]string{
		"RoleID":       "role id",
		"TargetType":   "target type",
		"ID":           "id",
		"Code":         "code",
		"WorkItemCode": "work item code",
		"HTTPCode":     "http code",
	}
	for in, want := range cases {
		if got := reference(in); got != want {
			t.Errorf("reference(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestTextReadsStringsAndIntegersOnly(t *testing.T) {
	v := reflect.ValueOf(lineThing{Name: "n", Count: 12, Enabled: true})
	if text(v, "Name") != "n" || text(v, "Count") != "12" {
		t.Fatalf("text read %q and %q", text(v, "Name"), text(v, "Count"))
	}
	if text(v, "Enabled") != "" {
		t.Fatal("a bool field has no text")
	}
	if text(v, "Missing") != "" {
		t.Fatal("a field that does not exist has no text")
	}
}

func TestMetaOfIsEmptyWithoutParams(t *testing.T) {
	if metaOf(nil) != nil {
		t.Fatal("a nil request has no meta")
	}
	if metaOf(&mcp.CallToolRequest{}) != nil {
		t.Fatal("a request without params has no meta")
	}
	req := &mcp.CallToolRequest{Params: &mcp.CallToolParamsRaw{Meta: mcp.Meta{"progressToken": "p1"}}}
	if got := metaOf(req); got["progressToken"] != "p1" {
		t.Fatalf("meta = %#v", got)
	}
}

func TestByNameFindsATool(t *testing.T) {
	tools := []dispatch.Tool{{Name: "a"}, {Name: "b"}}
	if tool, ok := byName(tools, "b"); !ok || tool.Name != "b" {
		t.Fatalf("byName = %v %v", tool, ok)
	}
	if _, ok := byName(tools, "c"); ok {
		t.Fatal("an unknown tool must not be found")
	}
}

func TestSummaryAndSummaryWithContextCarryTheText(t *testing.T) {
	one := summary("Made %d of %s.", 2, "roles")
	if len(one.Content) != 1 || one.Content[0].(*mcp.TextContent).Text != "Made 2 of roles." {
		t.Fatalf("summary = %#v", one.Content)
	}
	two := summaryWithContext("Found 1.", "- a")
	if len(two.Content) != 2 || two.Content[1].(*mcp.TextContent).Text != "- a" || !strings.HasPrefix(two.Content[0].(*mcp.TextContent).Text, "Found") {
		t.Fatalf("summaryWithContext = %#v", two.Content)
	}
}
