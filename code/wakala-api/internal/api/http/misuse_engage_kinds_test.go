package http

import "testing"

const postReadAction = "engage.post.read"

var postKindPermissions = map[string]string{
	"notice":         "notice.post",
	"event":          "event.post",
	"volunteer_call": "volunteer_call.post",
}

var postKindCreateActions = map[string]string{
	"notice":         "engage.post.create_notice",
	"event":          "engage.post.create_event",
	"volunteer_call": "engage.post.create_volunteer_call",
}

var eventOnlyActions = []string{"engage.event.change", "engage.event.cancel"}

func actionsOfKind(kind string) map[string]bool {
	return allowedActions([]string{postKindPermissions[kind]})
}

func TestEngagePostKinds_EachKindAdmitsItsOwnCreateAction(t *testing.T) {
	for kind, create := range postKindCreateActions {
		if !actionsOfKind(kind)[create] {
			t.Errorf("%s admits no %q, so its holder cannot post a %s", postKindPermissions[kind], create, kind)
		}
	}
}

func TestEngagePostKinds_NoKindAdmitsAnotherKindsCreateAction(t *testing.T) {
	for kind := range postKindPermissions {
		held := actionsOfKind(kind)
		for other, create := range postKindCreateActions {
			if other != kind && held[create] {
				t.Errorf("%s admits %q, so a holder of one kind may post a %s", postKindPermissions[kind], create, other)
			}
		}
	}
}

func TestEngagePostKinds_TheOnlyActionKindsShareIsReadingAPost(t *testing.T) {
	kinds := []string{"notice", "event", "volunteer_call"}
	for i, a := range kinds {
		for _, b := range kinds[i+1:] {
			held := actionsOfKind(b)
			for action := range actionsOfKind(a) {
				if held[action] && action != postReadAction {
					t.Errorf("%s and %s both admit %q, so a holder of one kind may do what only the other should", postKindPermissions[a], postKindPermissions[b], action)
				}
			}
		}
	}
}

func TestEngagePostKinds_OnlyAnEventHolderChangesOrCancelsAnEvent(t *testing.T) {
	for _, action := range eventOnlyActions {
		if !actionsOfKind("event")[action] {
			t.Errorf("event.post admits no %q", action)
		}
		for _, kind := range []string{"notice", "volunteer_call"} {
			if actionsOfKind(kind)[action] {
				t.Errorf("%s admits %q, so a holder of another kind may change or cancel an event", postKindPermissions[kind], action)
			}
		}
	}
}
