package http

import (
	"errors"
	"strings"
	"testing"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"
)

var repeatingTaskWrites = []string{
	"taskmanager.repeating_task.create",
	"taskmanager.repeating_task.update",
	"taskmanager.repeating_task.stop",
}

func TestARoleWithoutTaskEditIsRefusedTheRepeatingTaskWritesAndNamesTaskEdit(t *testing.T) {
	w := residentGateWalk(t)
	reader, _ := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")

	for _, action := range repeatingTaskWrites {
		err := w.deps.admittedHoldingAction(asPerson(reader), w.instance, action)
		if !errors.Is(err, dispatch.ErrForbidden) || !strings.Contains(err.Error(), "task.edit") {
			t.Errorf("a role holding only task.read is let through %s: %v, want a refusal naming task.edit", action, err)
		}
	}
}

func TestARoleHoldingTaskEditMayStartChangeAndStopARepeatingTask(t *testing.T) {
	w := residentGateWalk(t)
	worker, _ := w.resident(t, "Kofi", "Dev")
	w.giveRole(t, "Dev", "Worker")

	for _, action := range repeatingTaskWrites {
		if err := w.deps.admittedHoldingAction(asPerson(worker), w.instance, action); err != nil {
			t.Errorf("a role holding task.edit is refused %s: %v", action, err)
		}
	}
}
