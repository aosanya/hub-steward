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
