package apikeys

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/authz"
	"wakalaserver/internal/throttle"
	mwanachamaauth "wakalaserver/modules/auth"
)

var coverDatabases atomic.Int64

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:apikeys_cover_%d?mode=memory&cache=shared", coverDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func newTestManager(t *testing.T) (Manager, *gorm.DB) {
	t.Helper()
	db := newTestDB(t)
	m, err := NewManager(db)
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}
	return m, db
}

func asAccount(id string) context.Context {
	return accounts.WithID(context.Background(), id)
}

func TestNewManagerRefusesANilDatabase(t *testing.T) {
	if _, err := NewManager(nil); err == nil {
		t.Fatal("expected an error for a nil db")
	}
}

func TestCreateReturnsAPlaintextTokenThatVerifiesBackToTheKey(t *testing.T) {
	m, _ := newTestManager(t)
	ctx := asAccount("acct-1")
	key, token, err := m.Create(ctx, "laptop")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !strings.HasPrefix(token, "wak_"+key.ID+".") {
		t.Fatalf("token %q should be wak_<id>.<secret>", token)
	}
	if key.Name != "laptop" || key.AccountID != "acct-1" || key.RevokedAt != nil {
		t.Fatalf("unexpected key %+v", key)
	}
	got, err := m.Verify(ctx, token)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if got.ID != key.ID || got.AccountID != "acct-1" {
		t.Fatalf("verified %+v, want key %s of acct-1", got, key.ID)
	}
}

func TestCreateRefusesAnEmptyName(t *testing.T) {
	m, _ := newTestManager(t)
	if _, _, err := m.Create(asAccount("a"), ""); err == nil {
		t.Fatal("expected an error for an empty name")
	}
}

func TestCreateForAgencyNeedsAnInstanceAndBindsTheKeyToIt(t *testing.T) {
	m, _ := newTestManager(t)
	ctx := asAccount("acct-1")
	if _, _, err := m.CreateForAgency(ctx, "bot", ""); err == nil {
		t.Fatal("expected an error for an empty instance")
	}
	key, token, err := m.CreateForAgency(ctx, "bot", "inst-9")
	if err != nil {
		t.Fatalf("CreateForAgency: %v", err)
	}
	if key.InstanceID != "inst-9" {
		t.Fatalf("instance = %q, want inst-9", key.InstanceID)
	}
	if key.AccountID != AgencyKeyCaller(key.ID) || !IsAgencyKeyCaller(key.AccountID) {
		t.Fatalf("account = %q, want the agency key caller", key.AccountID)
	}
	got, err := m.Verify(ctx, token)
	if err != nil || got.InstanceID != "inst-9" {
		t.Fatalf("Verify = %+v, %v", got, err)
	}
}

func TestVerifyRefusesEveryBadTokenWithOneSentinel(t *testing.T) {
	m, db := newTestManager(t)
	ctx := asAccount("acct-1")
	key, token, _ := m.Create(ctx, "k")
	secret := token[strings.LastIndex(token, ".")+1:]
	cases := map[string]string{
		"empty":            "",
		"no prefix":        key.ID + "." + secret,
		"no dot":           "wak_" + key.ID + secret,
		"unknown id":       "wak_does-not-exist." + secret,
		"wrong secret":     "wak_" + key.ID + ".not-the-secret",
		"truncated secret": token[:len(token)-3],
	}
	for name, bad := range cases {
		if _, err := m.Verify(ctx, bad); !errors.Is(err, ErrInvalidKey) {
			t.Errorf("%s: err = %v, want ErrInvalidKey", name, err)
		}
	}
	if err := db.Model(&keyRow{}).Where("id = ?", key.ID).Update("revoked_at", time.Now()).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := m.Verify(ctx, token); !errors.Is(err, ErrInvalidKey) {
		t.Errorf("revoked: err = %v, want ErrInvalidKey", err)
	}
}

func TestVerifyAnswersADistinctErrorWhenTheDatabaseCannotBeRead(t *testing.T) {
	m, db := newTestManager(t)
	ctx := asAccount("acct-1")
	_, token, err := m.Create(ctx, "k")
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatal(err)
	}
	_, err = m.Verify(ctx, token)
	if !errors.Is(err, ErrLookupFailed) {
		t.Fatalf("closed database: err = %v, want ErrLookupFailed", err)
	}
	if errors.Is(err, ErrInvalidKey) {
		t.Fatalf("closed database: err = %v must not be ErrInvalidKey", err)
	}
	if strings.Contains(err.Error(), token) {
		t.Fatalf("the error carries the token: %v", err)
	}
}

func TestCachedVerifyPassesTheLookupFailureThrough(t *testing.T) {
	m, db := newTestManager(t)
	ctx := asAccount("acct-1")
	_, token, _ := m.Create(ctx, "k")
	c := NewCached(m, authz.NewEpochs())
	sqlDB, _ := db.DB()
	sqlDB.Close()
	if _, err := c.Verify(ctx, token); !errors.Is(err, ErrLookupFailed) {
		t.Fatalf("cached verify on a closed database: err = %v, want ErrLookupFailed", err)
	}
}

func TestVerifyUpgradesALegacyPasswordHashToADigest(t *testing.T) {
	m, db := newTestManager(t)
	ctx := asAccount("acct-1")
	legacyHash, err := mwanachamaauth.Hash("legacy-secret")
	if err != nil {
		t.Fatal(err)
	}
	row := keyRow{ID: "legacy-id", Name: "old", AccountID: "acct-1", MintedBy: "acct-1", SecretHash: legacyHash, CreatedAt: time.Now().UTC()}
	if err := db.Create(&row).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := m.Verify(ctx, "wak_legacy-id.wrong"); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("wrong legacy secret: err = %v", err)
	}
	var untouched keyRow
	db.First(&untouched, "id = ?", "legacy-id")
	if untouched.SecretHash != legacyHash {
		t.Fatal("a failed verify must not rewrite the stored hash")
	}
	if _, err := m.Verify(ctx, "wak_legacy-id.legacy-secret"); err != nil {
		t.Fatalf("right legacy secret: %v", err)
	}
	var upgraded keyRow
	db.First(&upgraded, "id = ?", "legacy-id")
	if upgraded.SecretHash != secretDigest("legacy-secret") {
		t.Fatalf("hash = %q, want the sha256 digest", upgraded.SecretHash)
	}
	if _, err := m.Verify(ctx, "wak_legacy-id.legacy-secret"); err != nil {
		t.Fatalf("after upgrade: %v", err)
	}
}

func TestListShowsOnlyTheCallersOwnKeysInCreationOrder(t *testing.T) {
	m, _ := newTestManager(t)
	a, b := asAccount("acct-a"), asAccount("acct-b")
	first, _, _ := m.Create(a, "first")
	time.Sleep(2 * time.Millisecond)
	second, _, _ := m.Create(a, "second")
	other, _, _ := m.Create(b, "other")
	if _, _, err := m.CreateService(a, "billing", "svc"); err != nil {
		t.Fatal(err)
	}
	got, err := m.List(a)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].ID != first.ID || got[1].ID != second.ID {
		t.Fatalf("List(a) = %+v, want [first second]", got)
	}
	gotB, _ := m.List(b)
	if len(gotB) != 1 || gotB[0].ID != other.ID {
		t.Fatalf("List(b) = %+v", gotB)
	}
	none, err := m.List(asAccount("nobody"))
	if err != nil || len(none) != 0 {
		t.Fatalf("List(nobody) = %+v, %v", none, err)
	}
}

func TestListAndRevokeHonourLegacyKeysWithNoMinter(t *testing.T) {
	m, db := newTestManager(t)
	if err := db.Create(&keyRow{ID: "old-1", Name: "old", AccountID: "acct-1", CreatedAt: time.Now().UTC()}).Error; err != nil {
		t.Fatal(err)
	}
	ctx := asAccount("acct-1")
	got, _ := m.List(ctx)
	if len(got) != 1 || got[0].ID != "old-1" {
		t.Fatalf("List = %+v, want the legacy key", got)
	}
	if err := m.Revoke(ctx, "old-1"); err != nil {
		t.Fatalf("Revoke legacy: %v", err)
	}
}

func TestRevokeStopsAKeyAndRefusesAnotherAccountOrAnUnknownOrRepeat(t *testing.T) {
	m, _ := newTestManager(t)
	owner := asAccount("owner")
	key, token, _ := m.Create(owner, "k")
	if err := m.Revoke(asAccount("intruder"), key.ID); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("intruder revoke: %v, want ErrKeyNotFound", err)
	}
	if _, err := m.Verify(owner, token); err != nil {
		t.Fatalf("key must survive an intruder's revoke: %v", err)
	}
	if err := m.Revoke(owner, "no-such-id"); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("unknown revoke: %v", err)
	}
	if err := m.Revoke(owner, key.ID); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	if err := m.Revoke(owner, key.ID); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("second revoke: %v, want ErrKeyNotFound", err)
	}
	if _, err := m.Verify(owner, token); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("revoked key verify: %v", err)
	}
	listed, _ := m.List(owner)
	if len(listed) != 1 || listed[0].RevokedAt == nil {
		t.Fatalf("a revoked key stays listed with its revoked_at: %+v", listed)
	}
}

func TestRevokeDoesNotReachAServiceKey(t *testing.T) {
	m, _ := newTestManager(t)
	key, _, err := m.CreateService(context.Background(), "billing", "svc")
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Revoke(asAccount(ServiceCaller("billing")), key.ID); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("Revoke on a service key: %v, want ErrKeyNotFound", err)
	}
}

func TestCreateRefusesAfterTheLiveKeyCapAndRevokingFreesARoom(t *testing.T) {
	m, db := newTestManager(t)
	rows := make([]keyRow, throttle.MaxLiveAPIKeysPerAccount)
	for i := range rows {
		rows[i] = keyRow{ID: fmt.Sprintf("seed-%d", i), Name: "s", AccountID: "capped", MintedBy: "capped", CreatedAt: time.Now().UTC()}
	}
	if err := db.CreateInBatches(rows, 50).Error; err != nil {
		t.Fatal(err)
	}
	ctx := asAccount("capped")
	if _, _, err := m.Create(ctx, "one too many"); !errors.Is(err, ErrTooManyKeys) {
		t.Fatalf("err = %v, want ErrTooManyKeys", err)
	}
	if _, _, err := m.Create(asAccount("someone-else"), "fine"); err != nil {
		t.Fatalf("another account is not capped: %v", err)
	}
	if err := m.Revoke(ctx, "seed-0"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := m.Create(ctx, "now fits"); err != nil {
		t.Fatalf("after revoke: %v", err)
	}
}

func TestValidServiceName(t *testing.T) {
	valid := []string{"a", "billing", "svc-2", "9", "a-b-c", strings.Repeat("x", 32)}
	invalid := []string{"", "-a", "a-", "Upper", "has_underscore", "has space", "dot.ted", strings.Repeat("x", 33), "é"}
	for _, s := range valid {
		if !ValidServiceName(s) {
			t.Errorf("%q should be valid", s)
		}
	}
	for _, s := range invalid {
		if ValidServiceName(s) {
			t.Errorf("%q should be invalid", s)
		}
	}
}

func TestServiceCallerRoundTrips(t *testing.T) {
	c := ServiceCaller("billing")
	if !IsServiceCaller(c) || ServiceOf(c) != "billing" {
		t.Fatalf("caller %q does not round trip", c)
	}
	if IsServiceCaller("agency-key-x") || IsServiceCaller("acct-1") {
		t.Fatal("only service- callers are service callers")
	}
	if IsAgencyKeyCaller("service-x") || !IsAgencyKeyCaller(AgencyKeyCaller("k")) {
		t.Fatal("agency key caller detection is wrong")
	}
}

func TestCreateServiceRefusesBadServiceAndNameAndVerifiesAsTheServiceCaller(t *testing.T) {
	m, _ := newTestManager(t)
	ctx := context.Background()
	if _, _, err := m.CreateService(ctx, "Bad Name", "n"); !errors.Is(err, ErrInvalidService) {
		t.Fatalf("bad service: %v", err)
	}
	if _, _, err := m.CreateService(ctx, "ok", ""); !errors.Is(err, ErrInvalidKeyName) {
		t.Fatalf("empty name: %v", err)
	}
	if _, _, err := m.CreateService(ctx, "ok", strings.Repeat("n", 101)); !errors.Is(err, ErrInvalidKeyName) {
		t.Fatalf("long name: %v", err)
	}
	if _, _, err := m.CreateService(ctx, "ok", strings.Repeat("n", 100)); err != nil {
		t.Fatalf("100 chars is allowed: %v", err)
	}
	key, token, err := m.CreateService(ctx, "billing", "nightly")
	if err != nil {
		t.Fatal(err)
	}
	if key.Service != "billing" || key.AccountID != "service-billing" {
		t.Fatalf("key = %+v", key)
	}
	got, err := m.Verify(ctx, token)
	if err != nil || got.AccountID != "service-billing" {
		t.Fatalf("Verify = %+v, %v", got, err)
	}
}

func TestServiceKeysListAndLiveServicesTrackRevocation(t *testing.T) {
	m, _ := newTestManager(t)
	ctx := context.Background()
	empty, err := m.LiveServices(ctx)
	if err != nil || empty == nil || len(empty) != 0 {
		t.Fatalf("LiveServices on empty = %#v, %v; want a non-nil empty slice", empty, err)
	}
	z1, _, _ := m.CreateService(ctx, "zeta", "k1")
	z2, _, _ := m.CreateService(ctx, "zeta", "k2")
	a1, _, _ := m.CreateService(ctx, "alpha", "k3")
	if _, _, err := m.Create(asAccount("acct"), "personal"); err != nil {
		t.Fatal(err)
	}
	live, _ := m.LiveServices(ctx)
	if fmt.Sprint(live) != "[alpha zeta]" {
		t.Fatalf("LiveServices = %v, want [alpha zeta] sorted and distinct", live)
	}
	listed, _ := m.ListServices(ctx)
	if len(listed) != 3 {
		t.Fatalf("ListServices = %d keys, want 3 and no personal key", len(listed))
	}
	if err := m.RevokeService(ctx, z1.ID); err != nil {
		t.Fatal(err)
	}
	live, _ = m.LiveServices(ctx)
	if fmt.Sprint(live) != "[alpha zeta]" {
		t.Fatalf("zeta still has k2 live: %v", live)
	}
	_ = m.RevokeService(ctx, z2.ID)
	_ = m.RevokeService(ctx, a1.ID)
	live, _ = m.LiveServices(ctx)
	if len(live) != 0 {
		t.Fatalf("all revoked, LiveServices = %v", live)
	}
	if err := m.RevokeService(ctx, a1.ID); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("repeat revoke: %v", err)
	}
}

func TestRevokeServiceRefusesAPersonalKey(t *testing.T) {
	m, _ := newTestManager(t)
	key, token, _ := m.Create(asAccount("acct"), "personal")
	if err := m.RevokeService(context.Background(), key.ID); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("err = %v, want ErrKeyNotFound", err)
	}
	if _, err := m.Verify(context.Background(), token); err != nil {
		t.Fatalf("personal key must survive: %v", err)
	}
}

func TestCachedVerifyServesFromCacheUntilRevokeBumpsTheCredential(t *testing.T) {
	m, db := newTestManager(t)
	epochs := authz.NewEpochs()
	c := NewCached(m, epochs)
	ctx := asAccount("acct-1")
	key, token, _ := c.Create(ctx, "k")
	if _, err := c.Verify(ctx, token); err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&keyRow{}).Where("id = ?", key.ID).Update("revoked_at", time.Now()).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := c.Verify(ctx, token); err != nil {
		t.Fatalf("a cached verify should not hit the store again: %v", err)
	}
	db.Model(&keyRow{}).Where("id = ?", key.ID).Update("revoked_at", nil)
	if err := c.Revoke(ctx, key.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Verify(ctx, token); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("after Revoke the cache must be dropped: %v", err)
	}
}

func TestCachedRevokeServiceDropsTheCachedServiceKey(t *testing.T) {
	m, _ := newTestManager(t)
	c := NewCached(m, authz.NewEpochs())
	ctx := context.Background()
	key, token, _ := c.CreateService(ctx, "billing", "k")
	if _, err := c.Verify(ctx, token); err != nil {
		t.Fatal(err)
	}
	if err := c.RevokeService(ctx, key.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Verify(ctx, token); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("err = %v, want ErrInvalidKey", err)
	}
}

func TestCachedVerifyDoesNotCacheAFailure(t *testing.T) {
	m, _ := newTestManager(t)
	c := NewCached(m, authz.NewEpochs())
	if _, err := c.Verify(context.Background(), "wak_nope.nope"); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("err = %v", err)
	}
}
