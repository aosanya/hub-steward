package agencies

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	JoinOpen      = "open"
	JoinConfirmed = "confirmed"
)

const (
	RequestPending = "pending"
	RequestRefused = "refused"
)

const MaxJoinMessageLength = 500

const (
	JoinedNow      = "joined"
	JoinRequested  = "requested"
	AlreadyAMember = "member"
)

var (
	ErrInvalidJoinMode     = errors.New("agencies: join mode must be open or confirmed")
	ErrInvalidInstanceName = errors.New("agencies: a name is 1 to 120 characters")
	ErrJoinRequestNotFound = errors.New("agencies: no such join request")
	ErrJoinMessageTooLong  = errors.New("agencies: a join request's message is at most 500 characters")
	ErrNothingToLeave      = errors.New("agencies: not a resident of that instance")
	ErrOperatorCannotLeave = errors.New("agencies: an operator does not leave as a resident")
	errJoinNeedsCaller     = errors.New("agencies: joining needs an instance and a caller")
)

type joinRequestRow struct {
	InstanceID string `gorm:"primaryKey"`
	UserID     string `gorm:"primaryKey"`
	CreatedAt  time.Time
	Status     string `gorm:"not null;default:pending"`
	Appeal     bool   `gorm:"not null;default:false"`
	Message    string `gorm:"not null;default:''"`
}

func (joinRequestRow) TableName() string { return "agency_instance_join_requests" }

type JoinRequest struct {
	InstanceID string    `json:"instance_id"`
	UserID     string    `json:"user_id"`
	CreatedAt  time.Time `json:"created_at"`
	Status     string    `json:"status"`
	Appeal     bool      `json:"appeal"`
	Message    string    `json:"message"`
}

type JoinOutcome struct {
	Status string `json:"status"`
	Role   string `json:"role,omitempty"`
	Appeal bool   `json:"appeal,omitempty"`
}

func ValidJoinMode(mode string) bool { return mode == JoinOpen || mode == JoinConfirmed }

func (r *registry) SetJoinMode(ctx context.Context, instanceID, mode string) (Instance, error) {
	if !ValidJoinMode(mode) {
		return Instance{}, ErrInvalidJoinMode
	}
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return Instance{}, err
	}
	err := r.db.WithContext(ctx).Model(&instanceRow{}).
		Where("id = ?", instanceID).Update("join_mode", mode).Error
	r.tenantChanged(instanceID)
	if err != nil {
		return Instance{}, err
	}
	return r.GetInstance(ctx, instanceID)
}

const MaxInstanceNameLength = 120

func (r *registry) RenameInstance(ctx context.Context, instanceID, name string) (Instance, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > MaxInstanceNameLength {
		return Instance{}, ErrInvalidInstanceName
	}
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return Instance{}, err
	}
	err := r.db.WithContext(ctx).Model(&instanceRow{}).
		Where("id = ?", instanceID).Update("name", name).Error
	r.tenantChanged(instanceID)
	if err != nil {
		return Instance{}, err
	}
	return r.GetInstance(ctx, instanceID)
}

func (r *registry) Join(ctx context.Context, instanceID, userID, message string) (JoinOutcome, error) {
	instanceID, userID, message = strings.TrimSpace(instanceID), strings.TrimSpace(userID), strings.TrimSpace(message)
	if instanceID == "" || userID == "" {
		return JoinOutcome{}, errJoinNeedsCaller
	}
	if utf8.RuneCountInString(message) > MaxJoinMessageLength {
		return JoinOutcome{}, ErrJoinMessageTooLong
	}
	inst, err := r.GetInstance(ctx, instanceID)
	if err != nil {
		return JoinOutcome{}, err
	}
	role, err := r.RoleOf(ctx, instanceID, userID)
	if err != nil {
		return JoinOutcome{}, err
	}
	if role != "" {
		return JoinOutcome{Status: AlreadyAMember, Role: role}, nil
	}
	now := time.Now().UTC()
	if inst.JoinMode == JoinOpen {
		if err := r.admit(r.db.WithContext(ctx), instanceID, userID, now); err != nil {
			return JoinOutcome{}, err
		}
		return JoinOutcome{Status: JoinedNow, Role: RoleResident}, nil
	}
	var appeal bool
	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing joinRequestRow
		found := tx.Where("instance_id = ? AND user_id = ?", instanceID, userID).Limit(1).Find(&existing)
		if found.Error != nil {
			return found.Error
		}
		if found.RowsAffected == 0 {
			row := joinRequestRow{InstanceID: instanceID, UserID: userID, CreatedAt: now, Status: RequestPending, Message: message}
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
		}
		appeal = existing.Appeal || existing.Status == RequestRefused
		return tx.Model(&joinRequestRow{}).
			Where("instance_id = ? AND user_id = ?", instanceID, userID).
			Updates(map[string]any{"status": RequestPending, "appeal": appeal, "message": message}).Error
	})
	if err != nil {
		return JoinOutcome{}, err
	}
	return JoinOutcome{Status: JoinRequested, Appeal: appeal}, nil
}

func (r *registry) AdmitResident(ctx context.Context, instanceID, userID string) (string, error) {
	instanceID, userID = strings.TrimSpace(instanceID), strings.TrimSpace(userID)
	if instanceID == "" || userID == "" {
		return "", errJoinNeedsCaller
	}
	if _, err := r.GetInstance(ctx, instanceID); err != nil {
		return "", err
	}
	role, err := r.RoleOf(ctx, instanceID, userID)
	if err != nil || role != "" {
		return role, err
	}
	if err := r.admit(r.db.WithContext(ctx), instanceID, userID, time.Now().UTC()); err != nil {
		return "", err
	}
	return r.RoleOf(ctx, instanceID, userID)
}

func (r *registry) admit(db *gorm.DB, instanceID, userID string, at time.Time) error {
	defer r.tenantChanged(instanceID)
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("instance_id = ? AND user_id = ?", instanceID, userID).Delete(&joinRequestRow{}).Error; err != nil {
			return err
		}
		return r.insertResident(tx, instanceID, userID, at)
	})
}

func (r *registry) insertResident(db *gorm.DB, instanceID, userID string, at time.Time) error {
	row := memberRow{InstanceID: instanceID, UserID: userID, Role: RoleResident, CreatedAt: at}
	return db.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}

func (r *registry) Leave(ctx context.Context, instanceID, userID string) error {
	defer r.tenantChanged(instanceID)
	role, err := r.RoleOf(ctx, instanceID, userID)
	if err != nil {
		return err
	}
	if role != "" && role != RoleResident {
		return ErrOperatorCannotLeave
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		left := tx.Where("instance_id = ? AND user_id = ? AND role = ?", instanceID, userID, RoleResident).
			Delete(&memberRow{})
		if left.Error != nil {
			return left.Error
		}
		withdrawn, err := withdrawRequest(tx, instanceID, userID)
		if err != nil {
			return err
		}
		if left.RowsAffected == 0 && !withdrawn {
			return ErrNothingToLeave
		}
		return nil
	})
}

func withdrawRequest(tx *gorm.DB, instanceID, userID string) (bool, error) {
	mine := "instance_id = ? AND user_id = ? AND status = ? AND appeal = ?"
	appealed := tx.Model(&joinRequestRow{}).Where(mine, instanceID, userID, RequestPending, true).
		Update("status", RequestRefused)
	if appealed.Error != nil {
		return false, appealed.Error
	}
	fresh := tx.Where(mine, instanceID, userID, RequestPending, false).Delete(&joinRequestRow{})
	if fresh.Error != nil {
		return false, fresh.Error
	}
	return appealed.RowsAffected+fresh.RowsAffected > 0, nil
}

func (r *registry) JoinRequests(ctx context.Context, instanceID string) ([]JoinRequest, error) {
	var rows []joinRequestRow
	if err := r.db.WithContext(ctx).Where("instance_id = ? AND status = ?", instanceID, RequestPending).
		Order("created_at").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]JoinRequest, 0, len(rows))
	for _, row := range rows {
		out = append(out, JoinRequest{
			InstanceID: row.InstanceID,
			UserID:     row.UserID,
			CreatedAt:  row.CreatedAt,
			Status:     row.Status,
			Appeal:     row.Appeal,
			Message:    row.Message,
		})
	}
	return out, nil
}

func (r *registry) DecideJoinRequest(ctx context.Context, instanceID, userID string, approve bool) error {
	defer r.tenantChanged(instanceID)
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		pending := "instance_id = ? AND user_id = ? AND status = ?"
		if !approve {
			refused := tx.Model(&joinRequestRow{}).Where(pending, instanceID, userID, RequestPending).
				Update("status", RequestRefused)
			if refused.Error != nil {
				return refused.Error
			}
			if refused.RowsAffected == 0 {
				return ErrJoinRequestNotFound
			}
			return nil
		}
		taken := tx.Where(pending, instanceID, userID, RequestPending).Delete(&joinRequestRow{})
		if taken.Error != nil {
			return taken.Error
		}
		if taken.RowsAffected == 0 {
			return ErrJoinRequestNotFound
		}
		return r.insertResident(tx, instanceID, userID, time.Now().UTC())
	})
}
