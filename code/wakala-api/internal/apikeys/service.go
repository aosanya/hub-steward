package apikeys

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	serviceCallerPrefix = "service-"
	adminMinter         = "admin"
	maxServiceNameLen   = 32
	maxKeyNameLen       = 100
)

var ErrInvalidService = errors.New("a service name is 1 to 32 lowercase letters, digits or hyphens, starting and ending with a letter or digit")

var ErrInvalidKeyName = errors.New("a key name is 1 to 100 characters")

func ServiceCaller(service string) string { return serviceCallerPrefix + service }

func IsServiceCaller(caller string) bool { return strings.HasPrefix(caller, serviceCallerPrefix) }

func ServiceOf(caller string) string { return strings.TrimPrefix(caller, serviceCallerPrefix) }

func ValidServiceName(service string) bool {
	if service == "" || len(service) > maxServiceNameLen {
		return false
	}
	for i := 0; i < len(service); i++ {
		c := service[i]
		edge := i == 0 || i == len(service)-1
		switch {
		case c >= 'a' && c <= 'z', c >= '0' && c <= '9':
		case c == '-' && !edge:
		default:
			return false
		}
	}
	return true
}

func (m *manager) CreateService(ctx context.Context, service, name string) (Key, string, error) {
	if !ValidServiceName(service) {
		return Key{}, "", ErrInvalidService
	}
	if name == "" || len(name) > maxKeyNameLen {
		return Key{}, "", ErrInvalidKeyName
	}
	cred, err := newCredential()
	if err != nil {
		return Key{}, "", fmt.Errorf("CreateService: %w", err)
	}
	row := keyRow{
		ID:         cred.id,
		Name:       name,
		AccountID:  ServiceCaller(service),
		MintedBy:   adminMinter,
		Service:    service,
		SecretHash: cred.hash,
		CreatedAt:  time.Now().UTC(),
	}
	if err := m.db.WithContext(ctx).Create(&row).Error; err != nil {
		return Key{}, "", fmt.Errorf("CreateService: %w", err)
	}
	return rowToKey(row), cred.token(), nil
}

func (m *manager) ListServices(ctx context.Context) ([]Key, error) {
	var rows []keyRow
	if err := m.db.WithContext(ctx).Where("COALESCE(service, '') <> ''").Order("created_at").Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListServices: %w", err)
	}
	out := make([]Key, len(rows))
	for i, row := range rows {
		out[i] = rowToKey(row)
	}
	return out, nil
}

func (m *manager) LiveServices(ctx context.Context) ([]string, error) {
	var names []string
	if err := m.db.WithContext(ctx).Model(&keyRow{}).
		Where("COALESCE(service, '') <> '' AND revoked_at IS NULL").
		Distinct().Order("service").Pluck("service", &names).Error; err != nil {
		return nil, fmt.Errorf("LiveServices: %w", err)
	}
	if names == nil {
		names = []string{}
	}
	return names, nil
}

func (m *manager) RevokeService(ctx context.Context, id string) error {
	res := m.db.WithContext(ctx).Model(&keyRow{}).
		Where("id = ? AND COALESCE(service, '') <> '' AND revoked_at IS NULL", id).
		Update("revoked_at", time.Now().UTC())
	if res.Error != nil {
		return fmt.Errorf("RevokeService: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrKeyNotFound
	}
	return nil
}
