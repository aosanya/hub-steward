package http

import (
	"context"

	formsroutes "wakalaserver/modules/forms/routes"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/agencies"
)

var residentFormsActions = []string{
	"forms.form.list_waiting",
	"forms.form.list_answered",
	"forms.form.read",
	"forms.question.list",
	"forms.question_option.list",
	"forms.answer.submit",
	"forms.answer.list",
	"forms.answer.list_previous",
	"forms.submission.read_mine",
	"forms.respondent.claim",
	"forms.results.read",
}

func (d *Deps) instanceFormsMount(role string) formsroutes.Mount {
	mount := d.formsMount()
	if role == agencies.RoleResident {
		mount.Authorize = d.authorizeResident(formsScope)
		mount.ReachedOnly = true
	}
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) authorizeResident(scope string) dispatch.Authorizer {
	granted := d.authorizer(scope)
	return func(ctx context.Context, action string) error {
		if !residentMay(scope, action) {
			return dispatch.ErrForbidden
		}
		if granted == nil {
			return nil
		}
		return granted(ctx, action)
	}
}
