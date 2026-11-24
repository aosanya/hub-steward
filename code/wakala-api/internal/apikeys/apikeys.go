// Package apikeys mints and verifies the bearer credential an MCP client
// authenticates the core API with (decision #4) — issued separately from
// internal/session's browser cookie so an agent that cannot hold a cookie
// still has a way in, ahead of WK9's MCP server.
//
// OAuth, decision #4's other named option, is deliberately not built here:
// a real authorization server (client registration, redirect/consent,
// token issuance/refresh) has no precedent anywhere in this codebase
// family, and nothing on the board needs delegated per-user authorization
// yet — one operator-minted credential per agent is enough. Revisit if an
// MCP client integration ever needs that.
package apikeys

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/throttle"
)

type Key struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	AccountID  string     `json:"-"`
	InstanceID string     `json:"instance_id,omitempty"`
	GroupID    string     `json:"group_id,omitempty"`
	Service    string     `json:"service,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
}

var ErrInvalidKey = errors.New("apikeys: invalid key")

var ErrLookupFailed = errors.New("apikeys: lookup failed")

var ErrKeyNotFound = errors.New("apikeys: not found")

type Manager interface {
	Create(ctx context.Context, name string) (Key, string, error)
	CreateForAgency(ctx context.Context, name, instanceID, groupID string) (Key, string, error)
	List(ctx context.Context) ([]Key, error)
	Revoke(ctx context.Context, id string) error
	Verify(ctx context.Context, token string) (Key, error)
	CreateService(ctx context.Context, service, name string) (Key, string, error)
	ListServices(ctx context.Context) ([]Key, error)
	LiveServices(ctx context.Context) ([]string, error)
	RevokeService(ctx context.Context, id string) error
}

type manager struct {
	db      *gorm.DB
	minting sync.Mutex
}

var ErrTooManyKeys = errors.New("apikeys: too many live keys")

func (m *manager) checkRoom(ctx context.Context, minter string) error {
	var live int64
	err := m.db.WithContext(ctx).Model(&keyRow{}).
		Where("COALESCE(service, '') = '' AND revoked_at IS NULL AND (minted_by = ? OR (COALESCE(minted_by, '') = '' AND account_id = ?))", minter, minter).
		Count(&live).Error
	if err != nil {
		return fmt.Errorf("Create: %w", err)
	}
	if live >= throttle.MaxLiveAPIKeysPerAccount {
		return ErrTooManyKeys
	}
	return nil
}

func NewManager(db *gorm.DB) (Manager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewManager: db must not be nil")
	}
	if err := db.AutoMigrate(&keyRow{}); err != nil {
		return nil, fmt.Errorf("NewManager: migrate: %w", err)
	}
	return &manager{db: db}, nil
}

// tokenPrefix marks a wakala-api API key at a glance (in logs, in a client
// config file) the way "sk_live_"/"ghp_"-style prefixes do elsewhere.
const tokenPrefix = "wak_"

const agencyKeyCallerPrefix = "agency-key-"

func AgencyKeyCaller(keyID string) string { return agencyKeyCallerPrefix + keyID }

func (m *manager) Create(ctx context.Context, name string) (Key, string, error) {
	return m.mint(ctx, name, "", "")
}

func (m *manager) CreateForAgency(ctx context.Context, name, instanceID, groupID string) (Key, string, error) {
	if instanceID == "" {
		return Key{}, "", fmt.Errorf("CreateForAgency: instance must not be empty")
	}
	return m.mint(ctx, name, instanceID, groupID)
}

func (m *manager) mint(ctx context.Context, name, instanceID, groupID string) (Key, string, error) {
	if name == "" {
		return Key{}, "", fmt.Errorf("Create: name must not be empty")
	}
	cred, err := newCredential()
	if err != nil {
		return Key{}, "", fmt.Errorf("Create: %w", err)
	}
	minter := accounts.IDFromContext(ctx)
	m.minting.Lock()
	defer m.minting.Unlock()
	if err := m.checkRoom(ctx, minter); err != nil {
		return Key{}, "", err
	}
	row := keyRow{ID: cred.id, Name: name, AccountID: minter, MintedBy: minter, SecretHash: cred.hash, CreatedAt: time.Now().UTC()}
	if instanceID != "" {
		row.AccountID = AgencyKeyCaller(cred.id)
		row.InstanceID = instanceID
		row.GroupID = groupID
	}
	if err := m.db.WithContext(ctx).Create(&row).Error; err != nil {
		return Key{}, "", fmt.Errorf("Create: %w", err)
	}
	return rowToKey(row), cred.token(), nil
}

func (m *manager) List(ctx context.Context) ([]Key, error) {
	var rows []keyRow
	if err := m.db.WithContext(ctx).
		Where("COALESCE(service, '') = '' AND (minted_by = ? OR (COALESCE(minted_by, '') = '' AND account_id = ?))", accounts.IDFromContext(ctx), accounts.IDFromContext(ctx)).
		Order("created_at").Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("List: %w", err)
	}
	out := make([]Key, len(rows))
	for i, row := range rows {
		out[i] = rowToKey(row)
	}
	return out, nil
}

func (m *manager) Revoke(ctx context.Context, id string) error {
	res := m.db.WithContext(ctx).Model(&keyRow{}).
		Where("id = ? AND COALESCE(service, '') = '' AND (minted_by = ? OR (COALESCE(minted_by, '') = '' AND account_id = ?)) AND revoked_at IS NULL", id, accounts.IDFromContext(ctx), accounts.IDFromContext(ctx)).
		Update("revoked_at", time.Now().UTC())
	if res.Error != nil {
		return fmt.Errorf("Revoke: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrKeyNotFound
	}
	return nil
}

func (m *manager) Verify(ctx context.Context, token string) (Key, error) {
	id, secret, ok := splitToken(token)
	if !ok {
		return Key{}, ErrInvalidKey
	}
	var row keyRow
	if err := m.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Key{}, ErrInvalidKey
		}
		return Key{}, fmt.Errorf("%w: %w", ErrLookupFailed, err)
	}
	if row.RevokedAt != nil {
		return Key{}, ErrInvalidKey
	}
	matched, legacy := secretMatches(row.SecretHash, secret)
	if !matched {
		return Key{}, ErrInvalidKey
	}
	if legacy {
		m.db.WithContext(ctx).Model(&keyRow{}).Where("id = ?", row.ID).Update("secret_hash", secretDigest(secret))
	}
	return rowToKey(row), nil
}

// splitToken pulls the lookup id and secret back out of a token minted by
// Create ("wak_<id>.<secret>") — the same body/signature split
// internal/session's own token format uses, for the same reason: the id
// half needs to be an indexed lookup, not something Verify derives by
// scanning every row's hash.
func splitToken(token string) (id, secret string, ok bool) {
	if !strings.HasPrefix(token, tokenPrefix) {
		return "", "", false
	}
	rest := strings.TrimPrefix(token, tokenPrefix)
	i := strings.LastIndexByte(rest, '.')
	if i < 0 {
		return "", "", false
	}
	return rest[:i], rest[i+1:], true
}

type credential struct {
	id, secret, hash string
}

func newCredential() (credential, error) {
	secret, err := randomSecret()
	if err != nil {
		return credential{}, err
	}
	return credential{id: uuid.New().String(), secret: secret, hash: secretDigest(secret)}, nil
}

func (c credential) token() string { return tokenPrefix + c.id + "." + c.secret }

func randomSecret() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func IsAgencyKeyCaller(caller string) bool { return strings.HasPrefix(caller, agencyKeyCallerPrefix) }
