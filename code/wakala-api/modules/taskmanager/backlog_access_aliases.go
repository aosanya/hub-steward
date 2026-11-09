package mwanachamataskmanager

import "wakalaserver/modules/taskmanager/models"

type (
	BacklogAccess = models.BacklogAccess
	GroupAccess   = models.GroupAccess
	AccessLevel   = models.AccessLevel
)

const (
	AccessSee  = models.AccessSee
	AccessMove = models.AccessMove
)
