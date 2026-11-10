package http

import (
	"slices"
	"testing"
)

func TestMountListToolIsHiddenUntilTheCallerHoldsMountList(t *testing.T) {
	w := newGroupRoleWalk(t)
	m := newMCPServers(w.deps)
	if hidden := m.hiddenTools([]string{"taskmanager.task.list"}, nil); !slices.Contains(hidden, listMountsTool) {
		t.Fatalf("a caller without instance.mount.list sees %s", listMountsTool)
	}
	if hidden := m.hiddenTools(nil, nil); !slices.Contains(hidden, listMountsTool) {
		t.Fatalf("a caller with no permissions sees %s", listMountsTool)
	}
	if hidden := m.hiddenTools([]string{listMountsAction}, nil); slices.Contains(hidden, listMountsTool) {
		t.Fatalf("a caller who holds %s does not see %s", listMountsAction, listMountsTool)
	}
}
