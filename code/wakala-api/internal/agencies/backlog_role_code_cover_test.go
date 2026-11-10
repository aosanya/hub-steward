package agencies

import (
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

func TestBacklogRoleCodeOfReadsTheCodeOrTheNameInSnakeCase(t *testing.T) {
	cases := []struct {
		name string
		role agencymodels.DocumentRole
		want string
	}{
		{"code member", agencymodels.DocumentRole{Code: "backlog_member"}, "backlog_member"},
		{"code worker", agencymodels.DocumentRole{Code: "backlog_worker", Name: "Anything"}, "backlog_worker"},
		{"name manager", agencymodels.DocumentRole{Code: "x", Name: "Backlog Manager"}, "backlog_manager"},
		{"name padded and shouting", agencymodels.DocumentRole{Name: "  BACKLOG WORKER "}, "backlog_worker"},
		{"other role", agencymodels.DocumentRole{Code: "treasurer", Name: "Treasurer"}, ""},
		{"empty role", agencymodels.DocumentRole{}, ""},
	}
	for _, c := range cases {
		if got := backlogRoleCodeOf(c.role); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}
