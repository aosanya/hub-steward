package sources

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/aosanya/mwanachama-backend-shared/identity"
)

const identityModule = "sources"

var ErrNoStableIdentity = errors.New("sources: this object has no stable identity")

var identifiedRoles = map[string]bool{
	roleSource:       true,
	roleAnnotation:   true,
	roleVerification: true,
	roleChunk:        true,
}

func (m *sourceManager) StableIdentity(ctx context.Context, object, id string) (string, error) {
	if !identifiedRoles[object] {
		return "", fmt.Errorf("%s: %w", object, ErrNoStableIdentity)
	}
	exists, err := m.rowExists(ctx, object, id)
	if err != nil {
		return "", fmt.Errorf("StableIdentity: %w", err)
	}
	if !exists {
		return "", fmt.Errorf("%s %s: %w", object, id, identity.ErrNotFound)
	}
	raw, err := identity.New(identityModule, m.st.Spec().Instance, m.identityOf(object, id))
	if err != nil {
		return "", fmt.Errorf("%s %s: %w", object, id, err)
	}
	return raw.String(), nil
}

func (m *sourceManager) Resolve(ctx context.Context, raw string) (string, string, error) {
	r, err := identity.Parse(raw)
	if err != nil {
		return "", "", err
	}
	if r.Module != identityModule || r.Instance != m.st.Spec().Instance {
		return "", "", fmt.Errorf("%s: %w", raw, identity.ErrNotOwned)
	}
	mount, rest, _ := strings.Cut(r.Identity, "/")
	if mount != m.st.Spec().MountName() {
		return "", "", fmt.Errorf("%s: %w", raw, identity.ErrNotOwned)
	}
	object, id, _ := strings.Cut(rest, "/")
	if !identifiedRoles[object] || id == "" {
		return "", "", fmt.Errorf("%s: %w", raw, identity.ErrNotFound)
	}
	exists, err := m.rowExists(ctx, object, id)
	if err != nil {
		return "", "", fmt.Errorf("Resolve: %w", err)
	}
	if !exists {
		return "", "", fmt.Errorf("%s: %w", raw, identity.ErrNotFound)
	}
	return object, id, nil
}

func (m *sourceManager) identityOf(object, id string) string {
	return m.st.Spec().MountName() + "/" + object + "/" + id
}

func (m *sourceManager) rowExists(ctx context.Context, object, id string) (bool, error) {
	var rows []map[string]any
	if err := m.st.Query(ctx, object).Select("id").Where("id = ?", id).Limit(1).Find(&rows).Error; err != nil {
		return false, err
	}
	return len(rows) > 0, nil
}
