package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_TaskEditOwnsStartingChangingAndStoppingARepeatingTask(t *testing.T) {
	requirePermissionCarries(t, "task.edit",
		"taskmanager.repeating_task.create",
		"taskmanager.repeating_task.update",
		"taskmanager.repeating_task.stop",
	)
}

func TestPermissionCatalog_NoOtherPermissionCarriesTheRepeatingTaskWrites(t *testing.T) {
	for _, p := range PermissionCatalog() {
		if p.Code == "task.edit" {
			continue
		}
		for _, action := range []string{"taskmanager.repeating_task.create", "taskmanager.repeating_task.update", "taskmanager.repeating_task.stop"} {
			if slices.Contains(p.Actions, action) {
				t.Errorf("%s also carries %s, so task.edit is not the one owner", p.Code, action)
			}
		}
	}
}

func TestPermissionCatalog_ReadingARepeatingTaskIsNotMadeToNeedTaskEdit(t *testing.T) {
	edit, ok := LookupPermission("task.edit")
	if !ok {
		t.Fatal("catalogue lacks task.edit")
	}
	for _, action := range []string{"taskmanager.repeating_task.read", "taskmanager.repeating_task.list"} {
		if slices.Contains(edit.Actions, action) {
			t.Errorf("task.edit carries %s, which the read permission already covers", action)
		}
	}
}
