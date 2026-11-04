package http

import (
	commroutes "wakalaserver/modules/comm/routes"

	"wakalaserver/internal/agencies"
)

var residentCommActions = []string{
	"comm.chat_thread.list",
	"comm.chat_thread.create",
	"comm.chat_thread.open",
	"comm.chat_thread.decline",
	"comm.chat_thread.mark_read",
	"comm.chat_thread.archive",
	"comm.chat_thread.unarchive",
	"comm.chat_thread.list_archived",
	"comm.chat_message.list",
	"comm.chat_message.post",
	"comm.chat_message.read",
	"comm.notification.list",
	"comm.notification.unread",
	"comm.notification.mark_read",
	"comm.notification_preference.list",
	"comm.notification_preference.set",
	"comm.subject_thread.open",
	"comm.subject_thread.list",
	"comm.subject_thread.read",
	"comm.subject_message.list",
	"comm.subject_message.post",
	"comm.push_subscription.subscribe",
	"comm.push_subscription.unsubscribe",
}

func (d *Deps) instanceCommMount(role string) commroutes.Mount {
	mount := d.commMount()
	switch role {
	case agencies.RoleResident:
		mount.Authorize = d.authorizeResident(commScope)
	case roleApplicant:
		mount.Authorize = authorizeApplicant
	}
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize, ownInboxActions...)
	return mount
}
