package agencies

import (
	"context"
	"errors"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type fakeAgency struct {
	mwanachamaagency.AgencyManager
	updateErr error
	deleteErr error
	updated   []agencymodels.Role
	deleted   []string
}

func (f *fakeAgency) UpdateRole(_ context.Context, r agencymodels.Role) (agencymodels.Role, error) {
	f.updated = append(f.updated, r)
	return r, f.updateErr
}

func (f *fakeAgency) DeleteRole(_ context.Context, id string) error {
	f.deleted = append(f.deleted, id)
	return f.deleteErr
}

func TestEditingARoleTellsTheRegistryItChanged(t *testing.T) {
	inner := &fakeAgency{}
	changes := 0
	edits := roleEdits{AgencyManager: inner, changed: func() { changes++ }}

	if _, err := edits.UpdateRole(context.Background(), agencymodels.Role{ID: "r1"}); err != nil {
		t.Fatal(err)
	}
	if err := edits.DeleteRole(context.Background(), "r2"); err != nil {
		t.Fatal(err)
	}
	if changes != 2 || len(inner.updated) != 1 || inner.updated[0].ID != "r1" || len(inner.deleted) != 1 || inner.deleted[0] != "r2" {
		t.Fatalf("changes=%d updated=%v deleted=%v", changes, inner.updated, inner.deleted)
	}
}

func TestAFailedRoleEditStillTellsTheRegistryAndPassesTheError(t *testing.T) {
	boom := errors.New("refused")
	inner := &fakeAgency{updateErr: boom, deleteErr: boom}
	changes := 0
	edits := roleEdits{AgencyManager: inner, changed: func() { changes++ }}

	if _, err := edits.UpdateRole(context.Background(), agencymodels.Role{ID: "r1"}); !errors.Is(err, boom) {
		t.Fatalf("update error lost: %v", err)
	}
	if err := edits.DeleteRole(context.Background(), "r1"); !errors.Is(err, boom) {
		t.Fatalf("delete error lost: %v", err)
	}
	if changes != 2 {
		t.Fatalf("a refused edit may have half-applied, so the cache must drop: %d", changes)
	}
}

func TestRoleEditsUnwrapGivesTheManagerBack(t *testing.T) {
	inner := &fakeAgency{}
	if got := (roleEdits{AgencyManager: inner}).Unwrap(); got != mwanachamaagency.AgencyManager(inner) {
		t.Fatal("Unwrap must return the wrapped manager")
	}
}

func (f *fakeAgency) PublishAgency(_ context.Context, draftID, _, _ string) (agencymodels.AgencyPublication, error) {
	return agencymodels.AgencyPublication{DraftID: draftID}, nil
}

func (f *fakeAgency) SetPublicationChannel(_ context.Context, version int, _ string) (agencymodels.AgencyPublication, error) {
	return agencymodels.AgencyPublication{Version: version}, nil
}

func TestAPublishAndAChannelMoveTellTheRegistryItChanged(t *testing.T) {
	changes := 0
	edits := roleEdits{AgencyManager: &fakeAgency{}, changed: func() { changes++ }}

	if _, err := edits.PublishAgency(context.Background(), "d1", "", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := edits.SetPublicationChannel(context.Background(), 2, "production"); err != nil {
		t.Fatal(err)
	}
	if changes != 2 {
		t.Fatalf("changes=%d, want 2", changes)
	}
}
