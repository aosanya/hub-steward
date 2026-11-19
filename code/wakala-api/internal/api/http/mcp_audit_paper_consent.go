package http

import (
	"context"
	"strings"
	"time"

	mwanachamaaudit "github.com/aosanya/mwanachama-backend-audit"
)

const (
	recordPaperConsentTool   = "custody_record_paper_consent"
	recordPaperConsentAction = "custody.consent.record"
	paperConsentAuditText    = "recorded consent given on paper"
)

func (d *Deps) paperConsentAudit(ctx context.Context, instanceID string, result map[string]any) (string, bool) {
	subject := fieldOf(result, "actor_id")
	if subject == "" || d.Registry == nil {
		return "", false
	}
	agreedAt, err := time.Parse(time.RFC3339Nano, fieldOf(result, "agreed_at"))
	if err != nil {
		return "", false
	}
	listed, err := d.Audit.ListEntries(ctx, mwanachamaaudit.EntryFilter{InstanceID: instanceID, Subject: subject})
	if err != nil {
		return "", false
	}
	for _, entry := range listed {
		at, err := time.Parse(time.RFC3339Nano, entry.At)
		if err == nil && strings.HasPrefix(entry.Action, paperConsentAuditText) && !at.Before(agreedAt) {
			return "", false
		}
	}
	return paperConsentAuditText + ", text " + d.consentVersionLabel(ctx, instanceID, fieldOf(result, "mechanics_version_id")), true
}

func (d *Deps) consentVersionLabel(ctx context.Context, instanceID, versionID string) string {
	cm, err := d.Registry.CustodyManager(context.WithValue(ctx, partitionKey{}, instanceID), instanceID)
	if err != nil {
		return versionID
	}
	version, err := cm.GetConsentVersion(ctx, versionID)
	if err != nil || version.Version == "" {
		return versionID
	}
	return version.Version
}
