package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

const (
	registerDetailsKeyPrefix = "register_details:"
	ownersOpeningHours       = "Opening hours"
)

func (b businessRegisterWalk) chooseDetails(t *testing.T, details string) {
	t.Helper()
	ctx := context.Background()
	cm, err := b.deps.Registry.CatalogManager(ctx, b.instance, agencies.MountFormRecords)
	if err != nil {
		t.Fatalf("CatalogManager: %v", err)
	}
	if _, err := cm.PutSetting(ctx, registerDetailsKeyPrefix+b.register, details); err != nil {
		t.Fatalf("PutSetting: %v", err)
	}
}

func (b businessRegisterWalk) postRow(t *testing.T, answers map[string]string) int {
	t.Helper()
	rec := b.call(t, "POST", "/instances/"+b.instance+"/live-records/"+b.register+"/rows", map[string]any{"answers": answers}, b.owner)
	return rec.Code
}

func TestARecordTakesTheDetailsTheOwnerChose(t *testing.T) {
	t.Run("refuses a detail nobody chose, as today", func(t *testing.T) {
		w := businessRegister(t)

		got := w.postRow(t, map[string]string{"Business": "Malomsor Bakery", "Owner": w.alpha, ownersOpeningHours: "6 to 14"})

		if got != http.StatusBadRequest {
			t.Fatalf("a detail the owner never chose: got %d, want 400", got)
		}
	})

	t.Run("takes the owner's own text detail once the owner has added it", func(t *testing.T) {
		w := businessRegister(t)
		w.chooseDetails(t, `{"details":[{"prompt":"Opening hours","on":true,"required":false,"own":true}]}`)

		got := w.postRow(t, map[string]string{"Business": "Malomsor Bakery", "Owner": w.alpha, ownersOpeningHours: "6 to 14"})

		if got != http.StatusCreated {
			t.Fatalf("an added detail: got %d, want 201", got)
		}
	})

	t.Run("keeps asking for the details the owner left on", func(t *testing.T) {
		w := businessRegister(t)
		w.chooseDetails(t, `{"details":[{"prompt":"Opening hours","on":true,"required":true,"own":true}]}`)

		got := w.postRow(t, map[string]string{"Business": "Malomsor Bakery", "Owner": w.alpha})

		if got != http.StatusBadRequest {
			t.Fatalf("an own detail marked required and left empty: got %d, want 400", got)
		}
	})

	t.Run("stops asking for a required detail the owner switched off", func(t *testing.T) {
		w := businessRegister(t)
		w.chooseDetails(t, `{"details":[{"prompt":"Owner","on":false,"required":true,"own":false}]}`)

		got := w.postRow(t, map[string]string{"Business": "Malomsor Bakery"})

		if got != http.StatusCreated {
			t.Fatalf("a switched off required detail left empty: got %d, want 201", got)
		}
	})

	t.Run("keeps a row saved before as it was", func(t *testing.T) {
		w := businessRegister(t)
		w.addBusiness(t, "Malomsor Bakery", w.alpha, "06 30 000 0001", "", "")
		w.chooseDetails(t, `{"details":[{"prompt":"Opening hours","on":true,"required":false,"own":true}]}`)

		got := w.businessesOverHTTP(t, w.owner, nil)

		if len(got) != 1 || got[0] != "Malomsor Bakery" {
			t.Fatalf("rows after the choice: %v, want the one saved before", got)
		}
	})
}
