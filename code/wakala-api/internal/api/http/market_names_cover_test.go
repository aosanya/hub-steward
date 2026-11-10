package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/agencies"
)

func TestMarketNameInReadsTheMarketFromAPayload(t *testing.T) {
	cases := map[string]string{
		`{"market":"  Saturday  "}`: "Saturday",
		`"{\"market\":\"Co-op\"}"`:  "Co-op",
		`{"other":1}`:               "",
		``:                          "",
		`not json`:                  "",
	}
	for payload, want := range cases {
		if got := marketNameIn(payload); got != want {
			t.Errorf("marketNameIn(%q) = %q, want %q", payload, got, want)
		}
	}
}

func TestWriteMarketErrNamesTheMissingMarket(t *testing.T) {
	rec := httptest.NewRecorder()
	writeMarketErr(rec, agencies.ErrMarketNameRequired)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), agencies.ErrMarketNameRequired.Error()) {
		t.Fatalf("a missing market name is a 400 that says so, got %d %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	writeMarketErr(rec, agencies.ErrInstanceNotFound)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("an unknown instance is a 404, got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	writeMarketErr(rec, errors.New("secret detail"))
	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "secret detail") {
		t.Fatalf("any other failure is a 500 without the detail, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestCoordinatorGatedKeepsCoordinatorActionsForStaff(t *testing.T) {
	denyAll := func(context.Context, string) error { return errors.New("denied") }
	ctx := context.Background()
	for _, role := range []string{agencies.RoleOwner, agencies.RoleAgent} {
		gate := coordinatorGated(role, denyAll)
		if err := gate(ctx, "market.product.categorise"); err == nil || err.Error() != "denied" {
			t.Fatalf("%s goes straight to the base authorizer, got %v", role, err)
		}
	}
}

func TestCoordinatorGatedRefusesCoordinatorActionsToEveryoneElse(t *testing.T) {
	ctx := context.Background()
	gate := coordinatorGated(agencies.RoleResident, nil)
	for _, action := range []string{"market.product.categorise", "market.offer.regroup"} {
		if err := gate(ctx, action); !errors.Is(err, dispatch.ErrForbidden) {
			t.Fatalf("%s must be forbidden to a resident, got %v", action, err)
		}
	}
	if err := gate(ctx, "market.offer.list"); err != nil {
		t.Fatalf("with no base authorizer a plain action is allowed, got %v", err)
	}
	asked := ""
	base := func(_ context.Context, action string) error { asked = action; return errors.New("base said no") }
	if err := coordinatorGated(agencies.RoleResident, base)(ctx, "market.offer.list"); err == nil || asked != "market.offer.list" {
		t.Fatalf("a plain action goes to the base authorizer, got %v asked %q", err, asked)
	}
}
