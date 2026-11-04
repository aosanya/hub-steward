package agencies

import "time"

type instanceRow struct {
	ID           string `gorm:"primaryKey"`
	Name         string
	TableSlug    string `gorm:"uniqueIndex"`
	JoinMode     string `gorm:"not null;default:confirmed"`
	Kind         string `gorm:"not null;default:''"`
	Listed       bool   `gorm:"not null;default:false"`
	Purpose      string `gorm:"not null;default:''"`
	Place        string `gorm:"not null;default:''"`
	Audience     string `gorm:"not null;default:''"`
	Approval     string `gorm:"not null;default:approved"`
	ApprovalNote string `gorm:"not null;default:''"`
	CreatedAt    time.Time
}

func (instanceRow) TableName() string { return "agency_instances" }

func rowToInstance(r instanceRow) Instance {
	mode := r.JoinMode
	if !ValidJoinMode(mode) {
		mode = JoinConfirmed
	}
	return Instance{
		ID:           r.ID,
		Name:         r.Name,
		TableSlug:    r.TableSlug,
		JoinMode:     mode,
		Kind:         r.Kind,
		Listed:       r.Listed,
		Purpose:      r.Purpose,
		Place:        r.Place,
		Audience:     r.Audience,
		Approval:     approvalOf(r.Approval),
		ApprovalNote: r.ApprovalNote,
		CreatedAt:    r.CreatedAt,
	}
}
