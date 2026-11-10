package mwanachamacatalog_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func bookingManager(t *testing.T) catalog.CatalogManager {
	t.Helper()
	raw, err := os.ReadFile("agency.catalogue.json")
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

func offered(t *testing.T, cm catalog.CatalogManager, subject, starts, ends string, capacity int) catalog.Slot {
	t.Helper()
	s, err := cm.OfferSlot(context.Background(), catalog.Slot{SubjectID: subject, StartsAt: starts, EndsAt: ends, Capacity: capacity})
	if err != nil {
		t.Fatalf("OfferSlot: %v", err)
	}
	return s
}

func TestASlotIsOfferedInUTCWithACapacityOfOneByDefaultAndListedByStartTime(t *testing.T) {
	cm := bookingManager(t)
	ctx := context.Background()

	late := offered(t, cm, "clinic", "2026-03-02T14:00:00+01:00", "2026-03-02T15:00:00+01:00", 0)
	early := offered(t, cm, "clinic", "2026-03-02T08:00:00Z", "2026-03-02T09:00:00Z", 3)
	offered(t, cm, "school", "2026-03-02T08:00:00Z", "2026-03-02T09:00:00Z", 1)

	if late.StartsAt != "2026-03-02T13:00:00Z" || late.EndsAt != "2026-03-02T14:00:00Z" || late.Capacity != 1 || late.ID == "" {
		t.Fatalf("a slot is kept in UTC with a capacity of one: %+v", late)
	}
	listed, err := cm.ListSlots(ctx, "clinic")
	if err != nil || len(listed) != 2 || listed[0].ID != early.ID || listed[1].ID != late.ID {
		t.Fatalf("the clinic's slots by start time: %+v %v", listed, err)
	}
	if _, err := cm.ListSlots(ctx, ""); !errors.Is(err, catalog.ErrInvalidSlot) {
		t.Fatalf("the slots of nothing: %v", err)
	}
}

func TestASlotIsRefusedWithoutASubjectReadableTimesAnEndAfterItsStartOrAPositiveCapacity(t *testing.T) {
	cm := bookingManager(t)
	ctx := context.Background()
	good := catalog.Slot{SubjectID: "clinic", StartsAt: "2026-03-02T08:00:00Z", EndsAt: "2026-03-02T09:00:00Z", Capacity: 1}

	noSubject := good
	noSubject.SubjectID = ""
	badStart := good
	badStart.StartsAt = "morning"
	badEnd := good
	badEnd.EndsAt = "noon"
	backwards := good
	backwards.EndsAt = good.StartsAt
	negative := good
	negative.Capacity = -2
	for name, s := range map[string]catalog.Slot{"no subject": noSubject, "bad start": badStart, "bad end": badEnd, "ends when it starts": backwards, "negative capacity": negative} {
		if _, err := cm.OfferSlot(ctx, s); !errors.Is(err, catalog.ErrInvalidSlot) {
			t.Fatalf("%s: a slot was offered: %v", name, err)
		}
	}
}

func TestABookingFillsASlotOncePerHolderAndNoMoreThanItsCapacity(t *testing.T) {
	cm := bookingManager(t)
	ctx := context.Background()
	slot := offered(t, cm, "clinic", "2026-03-02T08:00:00Z", "2026-03-02T09:00:00Z", 2)

	first, err := cm.Book(ctx, slot.ID, "resident-1")
	if err != nil || first.ID == "" || first.Day != "2026-03-02" || first.SubjectID != "clinic" || first.StartsAt != slot.StartsAt {
		t.Fatalf("book: %+v %v", first, err)
	}
	if _, err := cm.Book(ctx, slot.ID, "resident-1"); !errors.Is(err, catalog.ErrAlreadyBooked) {
		t.Fatalf("one holder booked a slot twice: %v", err)
	}
	if _, err := cm.Book(ctx, slot.ID, "resident-2"); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.Book(ctx, slot.ID, "resident-3"); !errors.Is(err, catalog.ErrSlotFull) {
		t.Fatalf("a full slot took a third booking: %v", err)
	}
	if _, err := cm.Book(ctx, "no-such-slot", "resident-1"); !errors.Is(err, catalog.ErrSlotNotFound) {
		t.Fatalf("a slot that is not there was booked: %v", err)
	}
	if _, err := cm.Book(ctx, "", "resident-1"); !errors.Is(err, catalog.ErrInvalidSlot) {
		t.Fatalf("a booking of nothing: %v", err)
	}
	if _, err := cm.Book(ctx, slot.ID, ""); !errors.Is(err, catalog.ErrInvalidSlot) {
		t.Fatalf("a booking by nobody: %v", err)
	}
}

func TestACancelledBookingFreesItsPlaceAndOnlyItsHolderOrStaffWithAReasonCanCancel(t *testing.T) {
	cm := bookingManager(t)
	ctx := context.Background()
	slot := offered(t, cm, "clinic", "2026-03-02T08:00:00Z", "2026-03-02T09:00:00Z", 1)
	booked, err := cm.Book(ctx, slot.ID, "resident-1")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := cm.CancelBooking(ctx, booked.ID, "resident-2", "mine now"); !errors.Is(err, catalog.ErrBookingNotFound) {
		t.Fatalf("someone else cancelled the booking: %v", err)
	}
	if _, err := cm.CancelBookingAsStaff(ctx, booked.ID, "clerk-1", "  "); !errors.Is(err, catalog.ErrCancelReasonRequired) {
		t.Fatalf("staff cancelled without a reason: %v", err)
	}
	if _, err := cm.CancelBooking(ctx, "", "resident-1", ""); !errors.Is(err, catalog.ErrBookingNotFound) {
		t.Fatalf("a cancel of nothing: %v", err)
	}

	cancelled, err := cm.CancelBooking(ctx, booked.ID, "resident-1", " changed my mind ")
	if err != nil || cancelled.CancelledAt == "" || cancelled.CancelledBy != "resident-1" || cancelled.CancelReason != "changed my mind" {
		t.Fatalf("cancel: %+v %v", cancelled, err)
	}
	if _, err := cm.CancelBooking(ctx, booked.ID, "resident-1", ""); !errors.Is(err, catalog.ErrBookingCancelled) {
		t.Fatalf("a booking was cancelled twice: %v", err)
	}
	if _, err := cm.Book(ctx, slot.ID, "resident-2"); err != nil {
		t.Fatalf("a cancelled booking kept its place: %v", err)
	}
}

func TestStaffCanCancelAnotherHoldersBookingAndBookingsAreListedByHolderAndDay(t *testing.T) {
	cm := bookingManager(t)
	ctx := context.Background()
	monday := offered(t, cm, "clinic", "2026-03-02T08:00:00Z", "2026-03-02T09:00:00Z", 2)
	tuesday := offered(t, cm, "clinic", "2026-03-03T08:00:00Z", "2026-03-03T09:00:00Z", 2)
	school := offered(t, cm, "school", "2026-03-02T10:00:00Z", "2026-03-02T11:00:00Z", 2)

	first, err := cm.Book(ctx, monday.ID, "resident-1")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := cm.Book(ctx, tuesday.ID, "resident-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.Book(ctx, school.ID, "resident-2"); err != nil {
		t.Fatal(err)
	}

	mine, err := cm.ListHolderBookings(ctx, "resident-1")
	if err != nil || len(mine) != 2 || mine[0].Day != "2026-03-02" || mine[1].Day != "2026-03-03" {
		t.Fatalf("a holder's bookings by start time: %+v %v", mine, err)
	}
	if _, err := cm.ListHolderBookings(ctx, ""); !errors.Is(err, catalog.ErrBookingNotFound) {
		t.Fatalf("the bookings of nobody: %v", err)
	}

	clinicDay, err := cm.ListDayBookings(ctx, "clinic", "2026-03-02")
	if err != nil || len(clinicDay) != 1 || clinicDay[0].HolderID != "resident-1" {
		t.Fatalf("the clinic's Monday: %+v %v", clinicDay, err)
	}
	everyone, err := cm.ListDayBookings(ctx, "", "2026-03-02")
	if err != nil || len(everyone) != 2 {
		t.Fatalf("every subject's Monday: %+v %v", everyone, err)
	}
	if _, err := cm.ListDayBookings(ctx, "clinic", "Monday"); !errors.Is(err, catalog.ErrInvalidSlot) {
		t.Fatalf("an unreadable day was taken: %v", err)
	}

	byStaff, err := cm.CancelBookingAsStaff(ctx, first.ID, "clerk-1", "Clinic closed")
	if err != nil || byStaff.CancelledBy != "clerk-1" || byStaff.CancelReason != "Clinic closed" {
		t.Fatalf("staff cancel: %+v %v", byStaff, err)
	}
}

func TestAMountThatBooksNoTimesRefusesEverySlotAndBookingCall(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	slot := catalog.Slot{SubjectID: "clinic", StartsAt: "2026-03-02T08:00:00Z", EndsAt: "2026-03-02T09:00:00Z"}

	if _, err := cm.OfferSlot(ctx, slot); !errors.Is(err, catalog.ErrTimesNotBooked) {
		t.Fatalf("offer: %v", err)
	}
	if _, err := cm.ListSlots(ctx, "clinic"); !errors.Is(err, catalog.ErrTimesNotBooked) {
		t.Fatalf("list slots: %v", err)
	}
	if _, err := cm.Book(ctx, "slot", "resident-1"); !errors.Is(err, catalog.ErrTimesNotBooked) {
		t.Fatalf("book: %v", err)
	}
	if _, err := cm.CancelBooking(ctx, "b", "resident-1", ""); !errors.Is(err, catalog.ErrTimesNotBooked) {
		t.Fatalf("cancel: %v", err)
	}
	if _, err := cm.ListHolderBookings(ctx, "resident-1"); !errors.Is(err, catalog.ErrTimesNotBooked) {
		t.Fatalf("holder bookings: %v", err)
	}
	if _, err := cm.ListDayBookings(ctx, "clinic", "2026-03-02"); !errors.Is(err, catalog.ErrTimesNotBooked) {
		t.Fatalf("day bookings: %v", err)
	}
}
