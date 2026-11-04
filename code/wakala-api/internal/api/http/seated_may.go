package http

import "slices"

var selfServiceActions = []string{
	"actor.actor.read_mine",
	"actor.actor.read_my_forms_week_split",
	"actor.actor.set_my_forms_week_split",
	"actor.group.list_mine",
	"actor.group.set_my_priority",
	"actor.join_request.list_mine",
	"actor.join_decision.read_mine",
	"actor.invitation.list_mine",
	"forms.form.list_waiting",
	"forms.form.list_answered",
	"forms.submission.read_mine",
	"forms.submission.read_my_send",
	"instance.my_roles.read",
	"instance.my_open_steps.read",
	"instance.live_record.list",
	"instance.live_record_row.list",
	"instance.live_record_row.add",
}

var seatedMayActions = append(append([]string{}, ownInboxActions...), selfServiceActions...)

func everySeatedAgentMay(action string) bool {
	return slices.Contains(seatedMayActions, action)
}
