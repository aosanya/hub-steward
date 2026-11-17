package models

import "testing"

func TestPermissionCatalog_ReviewRunCanReadBackTheReviewItStarts(t *testing.T) {
	requirePermissionCarries(t, "review.run", "agency.review.start", "agency.review.read", "agency.review.list", "agency.review.list_running")
}
