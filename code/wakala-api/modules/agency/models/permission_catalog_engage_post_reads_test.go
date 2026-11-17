package models

import "testing"

func TestPermissionCatalog_EachPostKindCanReadBackThePostItCreates(t *testing.T) {
	for _, code := range []string{"notice.post", "event.post", "volunteer_call.post"} {
		requirePermissionCarries(t, code, "engage.post.read")
	}
}

func TestPermissionCatalog_EventPostCanChangeAndCancelTheEventItCreates(t *testing.T) {
	requirePermissionCarries(t, "event.post", "engage.event.change", "engage.event.cancel")
}
