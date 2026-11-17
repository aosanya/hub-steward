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
