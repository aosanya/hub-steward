package apikeys

import "time"

type keyRow struct {
	ID         string `gorm:"primaryKey"`
	Name       string
	AccountID  string
	MintedBy   string
	InstanceID string
	GroupID    string
	Service    string `gorm:"not null;default:''"`
	SecretHash string
	CreatedAt  time.Time
	RevokedAt  *time.Time
}

func (keyRow) TableName() string { return "wakala_api_keys" }

func rowToKey(r keyRow) Key {
	return Key{ID: r.ID, Name: r.Name, AccountID: r.AccountID, InstanceID: r.InstanceID, GroupID: r.GroupID, Service: r.Service, CreatedAt: r.CreatedAt, RevokedAt: r.RevokedAt}
}
