package models

import "testing"

func TestPermissionCatalog_RegisterEditCarriesTheRegisterWritesAndTheRecordList(t *testing.T) {
	requirePermissionCarries(t, "register.edit", "catalog.entry.upsert", "catalog.entry.delete", "catalog.record.list")
}

func TestPermissionCatalog_ServiceEditCarriesTheEntryDelete(t *testing.T) {
	requirePermissionCarries(t, "service.edit", "catalog.entry.upsert", "catalog.entry.read", "catalog.entry.delete")
}

func TestPermissionCatalog_AppointmentManageCarriesTheSlotOfferAndTheStaffCancel(t *testing.T) {
	requirePermissionCarries(t, "appointment.manage", "catalog.slot.offer", "catalog.booking.cancel_as_staff")
}

func TestPermissionCatalog_AppointmentViewPersonCarriesOnlyTheOnePersonBookingList(t *testing.T) {
	requirePermissionCarries(t, "appointment.view_person", "catalog.booking.list_of_person")
	p, _ := LookupPermission("appointment.view_person")
	if p.Name != "See one person's bookings" || p.Module != "forms" || len(p.Actions) != 1 {
		t.Fatalf("appointment.view_person = %+v, want the forms permission \"See one person's bookings\" carrying one action", p)
	}
}

func TestPermissionCatalog_AppointmentManageIsNotWidenedToThePersonBookingList(t *testing.T) {
	p, ok := LookupPermission("appointment.manage")
	if !ok {
		t.Fatal("catalogue lacks appointment.manage")
	}
	for _, a := range p.Actions {
		if a == "catalog.booking.list_of_person" {
			t.Fatalf("appointment.manage carries %s, has %v", a, p.Actions)
		}
	}
}
