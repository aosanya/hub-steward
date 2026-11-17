package routes

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	audit "wakalaserver/modules/audit"
)

func newManager(t *testing.T) audit.AuditManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := audit.SpecFor("routes")
	if err != nil {
		t.Fatal(err)
	}
	if err := audit.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	am, err := audit.NewAuditManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return am
}

func TestTheDeclaredOperationBecomesTheAuditListEntriesTool(t *testing.T) {
	tools := Tools(newManager(t))

	if len(tools) != 1 || tools[0].Name != "audit_list_entries" || tools[0].Action != "audit.entry.list" {
		t.Fatalf("tools = %+v", tools)
	}
}

func TestShapeIsOneGetRoute(t *testing.T) {
	shape := Shape()

	if len(shape) != 1 || shape[0].Method != "GET" || shape[0].Path != "/audit/entries" {
		t.Fatalf("shape = %+v", shape)
	}
}

func TestToolListsTheInstancesEntriesNewestFirst(t *testing.T) {
	am := newManager(t)
	ctx := context.Background()
	for _, subject := range []string{"First", "Second"} {
		if _, err := am.Record(ctx, "agency-1", "owner", "renamed the agency", subject); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := am.Record(ctx, "agency-2", "owner", "renamed the agency", "Elsewhere"); err != nil {
		t.Fatal(err)
	}

	out, err := Tools(am)[0].Invoke(ctx, json.RawMessage(`{"instance_id":"agency-1"}`))
	if err != nil {
		t.Fatal(err)
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	var rows []struct {
		Actor   string `json:"actor"`
		Action  string `json:"action"`
		Subject string `json:"subject"`
		At      string `json:"at"`
	}
	if err := json.Unmarshal(encoded, &rows); err != nil {
		t.Fatalf("%s: %v", encoded, err)
	}
	if len(rows) != 2 || rows[0].Subject != "Second" || rows[1].Subject != "First" || rows[0].At == "" || rows[0].Actor != "owner" {
		t.Fatalf("rows = %s", encoded)
	}
}

func TestToolRefusesACallThatNamesNoInstance(t *testing.T) {
	if _, err := Tools(newManager(t))[0].Invoke(context.Background(), json.RawMessage(`{}`)); err == nil {
		t.Fatal("a call naming no instance was answered")
	}
}

func TestToolTakesAnOptionalActorAndSubjectBesideTheInstance(t *testing.T) {
	var schema struct {
		Properties map[string]json.RawMessage `json:"properties"`
		Required   []string                   `json:"required"`
	}
	if err := json.Unmarshal(Tools(newManager(t))[0].InputSchema, &schema); err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"instance_id", "actor", "subject"} {
		if _, asked := schema.Properties[name]; !asked {
			t.Errorf("the tool does not take %s: %v", name, schema.Properties)
		}
	}
	for _, name := range schema.Required {
		if name != "instance_id" {
			t.Errorf("%s is required, only instance_id may be", name)
		}
	}
}

func TestToolNarrowsTheInstancesEntriesByActorAndSubject(t *testing.T) {
	am := newManager(t)
	ctx := context.Background()
	for _, in := range [][3]string{
		{"owner", "renamed the agency", "Alpha"},
		{"agent-1", "renamed the agency", "Beta"},
		{"agent-1", "set the join mode", "open"},
	} {
		if _, err := am.Record(ctx, "agency-1", in[0], in[1], in[2]); err != nil {
			t.Fatal(err)
		}
	}

	for body, want := range map[string]int{
		`{"instance_id":"agency-1","actor":"agent-1"}`:                   2,
		`{"instance_id":"agency-1","subject":"Alpha"}`:                   1,
		`{"instance_id":"agency-1","actor":"agent-1","subject":"Alpha"}`: 0,
		`{"instance_id":"agency-1","actor":"agent-1","subject":"open"}`:  1,
		`{"instance_id":"agency-1","actor":"stranger"}`:                  0,
	} {
		out, err := Tools(am)[0].Invoke(ctx, json.RawMessage(body))
		if err != nil {
			t.Fatalf("%s: %v", body, err)
		}
		encoded, err := json.Marshal(out)
		if err != nil {
			t.Fatal(err)
		}
		var rows []map[string]any
		if err := json.Unmarshal(encoded, &rows); err != nil {
			t.Fatalf("%s: %v", encoded, err)
		}
		if len(rows) != want {
			t.Errorf("%s answered %d entries, want %d: %s", body, len(rows), want, encoded)
		}
	}
}
