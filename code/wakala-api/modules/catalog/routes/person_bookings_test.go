package routes

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"github.com/aosanya/mwanachama-backend-shared/spec"
)

func bookingsManager(t *testing.T) catalog.CatalogManager {
	t.Helper()
	raw, err := os.ReadFile("../agency.catalogue.json")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	doc["instance"] = "bookings"
	doc["objects"] = append(doc["objects"].([]any),
		map[string]any{"role": "slot", "name": "slot", "table": "slots", "description": "One time a service is offered."},
		map[string]any{"role": "booking", "name": "booking", "table": "bookings", "description": "One holder's place at one time."},
	)
	withTimes, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.ParseSpec(withTimes)
	if err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm
}

func toolNamed(t *testing.T, cm catalog.CatalogManager, name string) Tool {
	t.Helper()
	for _, tool := range ToolsFor(cm, theSession) {
		if tool.Name == name {
			return tool
		}
	}
	t.Fatalf("no tool named %s", name)
	return Tool{}
}

func offeredSlot(t *testing.T, cm catalog.CatalogManager, subject, starts, ends string) catalog.Slot {
	t.Helper()
	s, err := cm.OfferSlot(context.Background(), catalog.Slot{SubjectID: subject, StartsAt: starts, EndsAt: ends, Capacity: 3})
	if err != nil {
		t.Fatalf("OfferSlot: %v", err)
	}
	return s
}

func TestThePersonBookingsToolExistsAndAsksForTheActorAlone(t *testing.T) {
	tool := toolNamed(t, bookingsManager(t), "catalog_booking_list_of_person")

	if tool.Action != "catalog.booking.list_of_person" {
		t.Fatalf("action = %q, want catalog.booking.list_of_person", tool.Action)
	}
	var schema struct {
		Properties map[string]json.RawMessage `json:"properties"`
		Required   []string                   `json:"required"`
	}
	if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	if _, asked := schema.Properties["actor_id"]; !asked {
		t.Fatalf("the tool does not take actor_id: %s", tool.InputSchema)
	}
	if len(schema.Required) != 1 || schema.Required[0] != "actor_id" {
		t.Fatalf("required = %v, want exactly actor_id", schema.Required)
	}
}

func TestThePersonBookingsToolListsOnlyThatActorsStandingAndCancelledBookingsEarliestFirst(t *testing.T) {
	cm := bookingsManager(t)
	ctx := context.Background()
	later := offeredSlot(t, cm, "clinic", "2026-03-03T08:00:00Z", "2026-03-03T09:00:00Z")
	earlier := offeredSlot(t, cm, "clinic", "2026-03-02T08:00:00Z", "2026-03-02T09:00:00Z")
	school := offeredSlot(t, cm, "school", "2026-03-02T10:00:00Z", "2026-03-02T11:00:00Z")
	for _, slot := range []catalog.Slot{later, earlier} {
		if _, err := cm.Book(ctx, slot.ID, "resident-1"); err != nil {
			t.Fatal(err)
		}
	}
	cancelled, err := cm.Book(ctx, school.ID, "resident-1")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := cm.CancelBooking(ctx, cancelled.ID, "resident-1", "away"); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.Book(ctx, earlier.ID, "resident-2"); err != nil {
		t.Fatal(err)
	}

	out, err := toolNamed(t, cm, "catalog_booking_list_of_person").Invoke(ctx, json.RawMessage(`{"actor_id":"resident-1"}`))
	if err != nil {
		t.Fatal(err)
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	var rows []catalog.Booking
	if err := json.Unmarshal(encoded, &rows); err != nil {
		t.Fatalf("%s: %v", encoded, err)
	}
	if len(rows) != 3 {
		t.Fatalf("rows = %s, want the three bookings of resident-1", encoded)
	}
	for _, row := range rows {
		if row.HolderID != "resident-1" {
			t.Errorf("a booking of %q came back for resident-1: %s", row.HolderID, encoded)
		}
	}
	if rows[0].StartsAt != earlier.StartsAt || rows[1].StartsAt != school.StartsAt || rows[2].StartsAt != later.StartsAt {
		t.Errorf("not earliest first: %s", encoded)
	}
	standing, withdrawn := 0, 0
	for _, row := range rows {
		if row.CancelledAt == "" {
			standing++
		} else {
			withdrawn++
		}
	}
	if standing != 2 || withdrawn != 1 {
		t.Errorf("standing = %d, cancelled = %d, want 2 and 1: %s", standing, withdrawn, encoded)
	}
}

func TestThePersonBookingsToolRefusesACallThatNamesNoActor(t *testing.T) {
	tool := toolNamed(t, bookingsManager(t), "catalog_booking_list_of_person")

	for _, body := range []string{`{}`, `{"actor_id":""}`} {
		if _, err := tool.Invoke(context.Background(), json.RawMessage(body)); err == nil {
			t.Errorf("%s was answered", body)
		}
	}
}
