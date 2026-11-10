package http

import "testing"

func TestTheAssistantShareTreatsOnlyTheInstanceOwnerAsTheOwner(t *testing.T) {
	w := residentGateWalk(t)
	id, _ := w.resident(t, "Kofi", "Dev")
	w.giveRole(t, "Dev", "Worker")
	isOwner := registryOwnerCheck(w.deps.Registry, w.instance)
	cases := []struct {
		name   string
		person string
		want   bool
	}{
		{"the owner", "test-owner", true},
		{"a resident whose group holds a role", id, false},
		{"a stranger", "nobody-at-all", false},
	}
	for _, c := range cases {
		got, err := isOwner(asPerson(c.person), c.person)
		if err != nil {
			t.Errorf("%s: %v", c.name, err)
		}
		if got != c.want {
			t.Errorf("%s: owner = %v, want %v", c.name, got, c.want)
		}
	}
}
