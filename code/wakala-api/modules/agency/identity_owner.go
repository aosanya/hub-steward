package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"wakalaserver/modules/shared/identity"

	"wakalaserver/modules/agency/models"
)

const identityModule = "agency"

var ErrNoStableIdentity = errors.New("agency: this object has no stable identity")

var codePrefixes = map[string]string{
	roleGoal:      "G",
	roleObjective: "O",
	roleWorkflow:  "W",
	roleWorkItem:  "WI",
	roleRole:      "R",
	roleRule:      "RU",
	roleControl:   "C",
	roleRecord:    "RC",
	roleValue:     "V",
}

func objectOfCodePrefix(prefix string) (string, bool) {
	for object, p := range codePrefixes {
		if p == prefix {
			return object, true
		}
	}
	return "", false
}

func (m *agencyManager) StableIdentity(ctx context.Context, object, id string) (string, error) {
	if _, ok := codePrefixes[object]; !ok {
		return "", fmt.Errorf("%s: %w", object, ErrNoStableIdentity)
	}
	var rows []map[string]any
	if err := m.q(ctx, object).Select("code").Where("id = ?", id).Limit(1).Find(&rows).Error; err != nil {
		return "", fmt.Errorf("StableIdentity: %w", err)
	}
	if len(rows) == 0 {
		return "", fmt.Errorf("%s %s: %w", object, id, identity.ErrNotFound)
	}
	code, _ := rows[0]["code"].(string)
	raw, err := identity.New(identityModule, m.st.Spec().Instance, code)
	if err != nil {
		return "", fmt.Errorf("%s %s: %w", object, id, err)
	}
	return raw.String(), nil
}

func (m *agencyManager) Resolve(ctx context.Context, raw string) (string, string, error) {
	r, err := identity.Parse(raw)
	if err != nil {
		return "", "", err
	}
	if r.Module != identityModule || r.Instance != m.st.Spec().Instance {
		return "", "", fmt.Errorf("%s: %w", raw, identity.ErrNotOwned)
	}
	prefix, _, _ := strings.Cut(r.Identity, "-")
	object, ok := objectOfCodePrefix(prefix)
	if !ok {
		return "", "", fmt.Errorf("%s: %w", raw, identity.ErrNotFound)
	}
	draftID, err := m.resolvingDraft(ctx)
	if err != nil {
		return "", "", fmt.Errorf("%s: %w", raw, err)
	}
	var rows []map[string]any
	if err := m.q(ctx, object).Select("id").
		Where("draft_id = ? AND code = ?", draftID, r.Identity).Limit(1).Find(&rows).Error; err != nil {
		return "", "", fmt.Errorf("Resolve: %w", err)
	}
	if len(rows) == 0 {
		return "", "", fmt.Errorf("%s: %w", raw, identity.ErrNotFound)
	}
	id, _ := rows[0]["id"].(string)
	return object, id, nil
}

func (m *agencyManager) resolvingDraft(ctx context.Context) (string, error) {
	var rows []map[string]any
	if err := m.q(ctx, roleDraft).Select("id").
		Where("status = ?", string(models.DraftStatusOpen)).
		Order("created_at DESC, id DESC").Limit(1).Find(&rows).Error; err != nil {
		return "", fmt.Errorf("Resolve: %w", err)
	}
	if len(rows) == 0 {
		return "", fmt.Errorf("no open draft: %w", identity.ErrNotFound)
	}
	id, _ := rows[0]["id"].(string)
	return id, nil
}
