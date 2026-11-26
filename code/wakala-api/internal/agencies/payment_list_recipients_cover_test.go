package agencies

import (
	"context"
	"reflect"
	"sort"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

func TestTheUnpaidListIsNotWidenedUntilTheSettingSaysAnyone(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	widened, err := reg.paymentListWidenedIn(ctx, id)
	if err != nil || widened {
		t.Fatalf("with no setting the list stays with staff: widened=%v err=%v", widened, err)
	}
	catalog, err := settingsCatalog(ctx, reg, id)
	if err != nil {
		t.Fatalf("CatalogManager: %v", err)
	}
	cases := []struct {
		value string
		want  bool
	}{
		{"anyone", true},
		{"staff", false},
		{"Anyone", false},
		{"", false},
	}
	for _, c := range cases {
		if _, err := catalog.PutSetting(ctx, PaymentListRecipientsSetting, c.value); err != nil {
			t.Fatalf("PutSetting %q: %v", c.value, err)
		}
		got, err := reg.paymentListWidenedIn(ctx, id)
		if err != nil || got != c.want {
			t.Errorf("setting %q: widened=%v err=%v, want %v", c.value, got, err, c.want)
		}
	}
}

func TestTheUnpaidListSettingOfOneAgencyDoesNotWidenAnother(t *testing.T) {
	reg, first := registryWithMembers(t, nil)
	ctx := context.Background()
	second, err := reg.CreateInstance(ctx, "Other")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	catalog, err := settingsCatalog(ctx, reg, first)
	if err != nil {
		t.Fatalf("CatalogManager: %v", err)
	}
	if _, err := catalog.PutSetting(ctx, PaymentListRecipientsSetting, "anyone"); err != nil {
		t.Fatalf("PutSetting: %v", err)
	}
	if widened, err := reg.paymentListWidenedIn(ctx, first); err != nil || !widened {
		t.Fatalf("first agency widened=%v err=%v", widened, err)
	}
	if widened, err := reg.paymentListWidenedIn(ctx, second.ID); err != nil || widened {
		t.Fatalf("second agency must stay narrow: widened=%v err=%v", widened, err)
	}
}

func TestTheUnpaidListWidenedReadFailsForAnUnknownAgency(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	if widened, err := reg.paymentListWidenedIn(context.Background(), "no-such-agency"); err == nil || widened {
		t.Fatalf("an unknown agency must fail the read, got widened=%v err=%v", widened, err)
	}
}

func TestActorIDsAreListedPerAgencyAndEmptyNeverNil(t *testing.T) {
	f := newGroupRoleFixture(t)
	ctx := context.Background()
	empty, err := f.reg.actorIDsIn(f.instanceID)(ctx)
	if err != nil || empty == nil || len(empty) != 0 {
		t.Fatalf("an agency with no people lists %v, %v", empty, err)
	}
	a := f.actor(t, "Amina")
	b := f.actor(t, "Baraka")
	got, err := f.reg.actorIDsIn(f.instanceID)(ctx)
	if err != nil {
		t.Fatalf("actorIDsIn: %v", err)
	}
	want := []string{a, b}
	sort.Strings(got)
	sort.Strings(want)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ids = %v, want %v", got, want)
	}

	other, err := f.reg.CreateInstance(ctx, "Other")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	foreign, err := f.reg.actorIDsIn(other.ID)(ctx)
	if err != nil || len(foreign) != 0 {
		t.Fatalf("another agency must not see these people: %v, %v", foreign, err)
	}
	directory, err := f.reg.ActorManager(ctx, other.ID)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	c, err := directory.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Chidi"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	foreign, err = f.reg.actorIDsIn(other.ID)(ctx)
	if err != nil || !reflect.DeepEqual(foreign, []string{c.ID}) {
		t.Fatalf("other agency ids = %v, %v", foreign, err)
	}
}

func TestActorIDsFailForAnUnknownAgency(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	if ids, err := reg.actorIDsIn("no-such-agency")(context.Background()); err == nil {
		t.Fatalf("an unknown agency must fail the listing, got %v", ids)
	}
}
