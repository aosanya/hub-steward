package http

import "testing"

func TestMountedCustodyRecordPaperConsent_TheOwnerRecordsConsentForAResidentWhoThenReadsAsAgreed(t *testing.T) {
	cw := newConsentWalk(t)
	cw.mcpOK(t, "test-owner", "custody_publish_consent_version", map[string]any{"instance_id": cw.instance, "text": "We keep your answers."})

	before := cw.mcpOK(t, cw.actorID, "custody_get_my_consent", map[string]any{"instance_id": cw.instance})
	if before["status"] == "agreed" {
		t.Fatalf("resident reads as agreed before anyone recorded consent: %v", before)
	}

	recorded := cw.mcpOK(t, "test-owner", "custody_record_paper_consent", map[string]any{"instance_id": cw.instance, "actor_id": cw.actorID})
	if recorded["actor_id"] != cw.actorID || recorded["recorded_by"] != "test-owner" {
		t.Fatalf("record = %v, want the resident recorded by test-owner", recorded)
	}

	after := cw.mcpOK(t, cw.actorID, "custody_get_my_consent", map[string]any{"instance_id": cw.instance})
	if after["status"] != "agreed" {
		t.Fatalf("resident reads %v after the clerk recorded consent, want agreed", after)
	}

	again := cw.mcpOK(t, "test-owner", "custody_record_paper_consent", map[string]any{"instance_id": cw.instance, "actor_id": cw.actorID})
	if again["id"] != recorded["id"] {
		t.Fatalf("second record = %v, want the first record %v back", again, recorded)
	}
}

func TestMountedCustodyRecordPaperConsent_AResidentWithoutConsentRecordIsRefused(t *testing.T) {
	cw := newConsentPermissionWalk(t)
	cw.mcpOK(t, "test-owner", "custody_publish_consent_version", map[string]any{"instance_id": cw.instance, "text": "We keep your answers."})
	for name, subject := range map[string]string{"publisher": cw.publisher, "reader": cw.reader, "resident with no role": cw.actorID} {
		t.Run(name, func(t *testing.T) {
			cw.mcpRefused(t, subject, "custody_record_paper_consent", map[string]any{"instance_id": cw.instance, "actor_id": cw.reader}, "consent.record")
		})
	}
}

func TestAuditRecords_RecordingConsentOnPaperAddsOneEntryNamingTheClerkTheResidentAndTheTextVersion(t *testing.T) {
	w := newDesignAgentWalk(t)
	cacheMountedSet(t, w.instance, mountedSet{modules: map[string]bool{"custody": true}})
	resident := createdIDOf(t, w.mcpCall(t, "test-owner", "actor_create_actor", map[string]any{"instance_id": w.instance, "display_name": "Takács Erzsébet"}))
	if out := w.mcpCall(t, "test-owner", "custody_publish_consent_version", map[string]any{"instance_id": w.instance, "text": "We keep your answers."}); out.IsError {
		t.Fatalf("publishing the consent text: %s", toolErrorText(out))
	}
	if out := w.mcpCall(t, "test-owner", "custody_record_paper_consent", map[string]any{"instance_id": w.instance, "actor_id": resident}); out.IsError {
		t.Fatalf("recording the consent: %s", toolErrorText(out))
	}
	if out := w.mcpCall(t, "test-owner", "custody_record_paper_consent", map[string]any{"instance_id": w.instance, "actor_id": resident}); out.IsError {
		t.Fatalf("recording the consent again: %s", toolErrorText(out))
	}

	var recorded []auditEntryRow
	for _, entry := range w.auditEntries(t) {
		if entry.Subject == resident {
			recorded = append(recorded, entry)
		}
	}
	if len(recorded) != 1 {
		t.Fatalf("two recordings left %d audit entries about the resident, want 1: %+v", len(recorded), recorded)
	}
	entry := recorded[0]
	if entry.Actor != "test-owner" || entry.Action != "recorded consent given on paper, text v1" || entry.At == "" {
		t.Fatalf("entry = %+v, want the clerk, \"recorded consent given on paper, text v1\" and a time", entry)
	}
}
