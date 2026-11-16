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
