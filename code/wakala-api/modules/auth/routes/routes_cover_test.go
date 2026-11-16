package routes_test

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	mwanachamaauth "wakalaserver/modules/auth"
	"wakalaserver/modules/auth/routes"
)

type fixedIdentity string

func (f fixedIdentity) CallerID(*http.Request) string { return string(f) }

type fixedSession string

func (f fixedSession) CallerSessionID(*http.Request) string { return string(f) }

type recordingMinter struct {
	minted []string
	err    error
}

func (m *recordingMinter) Mint(_ context.Context, subjectID, deviceID string, _ time.Duration) (routes.Session, error) {
	if m.err != nil {
		return routes.Session{}, m.err
	}
	m.minted = append(m.minted, subjectID+"|"+deviceID)
	return routes.Session{Token: "tok-" + subjectID, ActorID: subjectID, DeviceID: deviceID}, nil
}

var databases int64

type stores struct {
	auth    *mwanachamaauth.AuthStore
	ops     *mwanachamaauth.OperatorStore
	verif   *mwanachamaauth.VerificationStore
	salts   *mwanachamaauth.PhoneSaltStore
	session *mwanachamaauth.SessionStore
}

func newStores(t *testing.T) stores {
	t.Helper()
	dsn := fmt.Sprintf("file:authcover%d?mode=memory&cache=shared", atomic.AddInt64(&databases, 1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	s, err := mwanachamaauth.SpecFor("authcover")
	if err != nil {
		t.Fatal(err)
	}
	if err := mwanachamaauth.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	var out stores
	if out.auth, err = mwanachamaauth.NewAuthStore(db, s); err != nil {
		t.Fatal(err)
	}
	if out.ops, err = mwanachamaauth.NewOperatorStore(db, s); err != nil {
		t.Fatal(err)
	}
	if out.verif, err = mwanachamaauth.NewVerificationStore(db, s); err != nil {
		t.Fatal(err)
	}
	if out.salts, err = mwanachamaauth.NewPhoneSaltStore(db, s); err != nil {
		t.Fatal(err)
	}
	if out.session, err = mwanachamaauth.NewSessionStore(db, s); err != nil {
		t.Fatal(err)
	}
	return out
}

func (s stores) deps(m routes.SessionMinter, caller, current string) routes.Deps {
	return routes.Deps{
		Auth: s.auth, Operators: s.ops, Verification: s.verif, PhoneSalts: s.salts, Sessions: s.session,
		Minter: m, TTL: time.Hour,
		Identity: fixedIdentity(caller), CurrentSession: fixedSession(current),
	}
}

func serve(t *testing.T, d routes.Deps, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	for _, rt := range routes.Routes(d) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("body %q: %v", rec.Body.String(), err)
	}
	return out
}

func seedOperator(t *testing.T, s stores, subject, email, password string) mwanachamaauth.OperatorCredential {
	t.Helper()
	hash, err := mwanachamaauth.Hash(password)
	if err != nil {
		t.Fatal(err)
	}
	c, err := s.ops.Create(context.Background(), mwanachamaauth.OperatorCredential{SubjectID: subject, Email: email}, hash)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func seedDevice(t *testing.T, s stores, subject string) (mwanachamaauth.Device, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	d, err := s.auth.RegisterDevice(context.Background(), mwanachamaauth.Device{
		SubjectID: subject, Name: "handset", PublicKey: base64.StdEncoding.EncodeToString(pub),
	})
	if err != nil {
		t.Fatal(err)
	}
	return d, priv
}

func TestBuildBindsEveryDeclaredActionAndSplitKeepsTheAnonymousFive(t *testing.T) {
	s := newStores(t)
	all, err := routes.Build(s.deps(&recordingMinter{}, "", ""))
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 12 {
		t.Fatalf("routes = %d; want 12", len(all))
	}
	anonymous, gated := routes.Split(all)
	if len(anonymous) != len(routes.AnonymousActions) || len(gated) != len(all)-len(routes.AnonymousActions) {
		t.Fatalf("split = %d anonymous, %d gated", len(anonymous), len(gated))
	}
	for _, rt := range anonymous {
		if !strings.HasPrefix(rt.Action, "auth.device.") && !strings.HasPrefix(rt.Action, "auth.recovery.") && rt.Action != "auth.operator.signin" {
			t.Errorf("unexpected anonymous action %s", rt.Action)
		}
	}
}

func TestOperatorSignInRefusesBlankFieldsWithoutCountingAFailure(t *testing.T) {
	s := newStores(t)
	d := s.deps(&recordingMinter{}, "", "")
	for _, body := range []string{`{"email":"","password":"x"}`, `{"email":"a@b.org","password":""}`} {
		rec := serve(t, d, "POST", "/operator/signin", body)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s -> %d; want 400", body, rec.Code)
		}
	}
	rec := serve(t, d, "POST", "/operator/signin", `{not json`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("malformed body -> %d; want 400", rec.Code)
	}
}

func TestOperatorSignInMintsASessionAndNormalizesTheAddress(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	m := &recordingMinter{}
	rec := serve(t, s.deps(m, "", ""), "POST", "/operator/signin", `{"email":"  Ada@Example.ORG ","password":"correct horse battery"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if got := decode(t, rec)["token"]; got != "tok-sub-1" {
		t.Errorf("token = %v", got)
	}
	if len(m.minted) != 1 || m.minted[0] != "sub-1|" {
		t.Errorf("minted = %v", m.minted)
	}
}

func TestOperatorSignInAnswersAWrongPasswordAndAnUnknownAddressIdentically(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	d := s.deps(&recordingMinter{}, "", "")
	wrong := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"nope nope nope"}`)
	unknown := serve(t, d, "POST", "/operator/signin", `{"email":"ghost@example.org","password":"nope nope nope"}`)
	if wrong.Code != http.StatusUnauthorized || unknown.Code != http.StatusUnauthorized {
		t.Fatalf("statuses %d and %d; want 401 both", wrong.Code, unknown.Code)
	}
	w, u := decode(t, wrong), decode(t, unknown)
	if w["error"] != u["error"] || w["tries_left"] != u["tries_left"] {
		t.Errorf("responses differ: %v vs %v", w, u)
	}
	if w["tries_left"] != float64(mwanachamaauth.OperatorLockAfter-1) {
		t.Errorf("tries_left = %v", w["tries_left"])
	}
}

func TestOperatorSignInLocksAfterRepeatedFailuresEvenForTheRightPassword(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	m := &recordingMinter{}
	d := s.deps(m, "", "")
	var last *httptest.ResponseRecorder
	for i := 0; i < mwanachamaauth.OperatorLockAfter; i++ {
		last = serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"wrong wrong wrong"}`)
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("final failure -> %d; want 429", last.Code)
	}
	if last.Header().Get("Retry-After") == "" {
		t.Error("no Retry-After header on a lock")
	}
	if decode(t, last)["tries_left"] != float64(0) {
		t.Errorf("body = %s", last.Body.String())
	}
	rec := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"correct horse battery"}`)
	if rec.Code != http.StatusTooManyRequests || len(m.minted) != 0 {
		t.Errorf("right password while locked -> %d, minted %v", rec.Code, m.minted)
	}
}

func TestOperatorSignInSuccessClearsEarlierFailures(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	d := s.deps(&recordingMinter{}, "", "")
	serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"wrong wrong wrong"}`)
	if rec := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"correct horse battery"}`); rec.Code != http.StatusCreated {
		t.Fatalf("status %d", rec.Code)
	}
	rec := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"wrong wrong wrong"}`)
	if got := decode(t, rec)["tries_left"]; got != float64(mwanachamaauth.OperatorLockAfter-1) {
		t.Errorf("tries_left after a clean sign-in = %v", got)
	}
}

func TestOperatorSignInRefusesADisabledCredential(t *testing.T) {
	s := newStores(t)
	c := seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	d := s.deps(&recordingMinter{}, "", "")
	if rec := serve(t, d, "DELETE", "/operator/credentials/"+c.ID, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("disable -> %d", rec.Code)
	}
	rec := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"correct horse battery"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("disabled sign-in -> %d; want 401", rec.Code)
	}
}

func TestOperatorSignInReportsAMinterFailureWithoutLeakingIt(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	m := &recordingMinter{err: context.DeadlineExceeded}
	rec := serve(t, s.deps(m, "", ""), "POST", "/operator/signin", `{"email":"ada@example.org","password":"correct horse battery"}`)
	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "deadline") {
		t.Errorf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestChangePasswordRefusesAnotherSubjectsCredential(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	body := `{"email":"ada@example.org","current_password":"correct horse battery","new_password":"a brand new passphrase"}`
	rec := serve(t, s.deps(&recordingMinter{}, "sub-2", ""), "PUT", "/operator/password", body)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d; want 403", rec.Code)
	}
}

func TestChangePasswordRefusesAWrongCurrentPasswordAndAnUnknownAddressAlike(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	d := s.deps(&recordingMinter{}, "sub-1", "")
	wrong := serve(t, d, "PUT", "/operator/password", `{"email":"ada@example.org","current_password":"bad bad bad bad","new_password":"a brand new passphrase"}`)
	unknown := serve(t, d, "PUT", "/operator/password", `{"email":"x@example.org","current_password":"bad bad bad bad","new_password":"a brand new passphrase"}`)
	if wrong.Code != http.StatusUnauthorized || unknown.Code != http.StatusUnauthorized {
		t.Fatalf("statuses %d, %d", wrong.Code, unknown.Code)
	}
	if wrong.Body.String() != unknown.Body.String() {
		t.Errorf("bodies differ: %s vs %s", wrong.Body.String(), unknown.Body.String())
	}
}

func TestChangePasswordRefusesATooShortNewPasswordAndKeepsTheOldOne(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	d := s.deps(&recordingMinter{}, "sub-1", "")
	rec := serve(t, d, "PUT", "/operator/password", `{"email":"ada@example.org","current_password":"correct horse battery","new_password":"short"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d; want 400", rec.Code)
	}
	if rec := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"correct horse battery"}`); rec.Code != http.StatusCreated {
		t.Errorf("old password no longer works: %d", rec.Code)
	}
}

func TestChangePasswordReplacesThePasswordForSignIn(t *testing.T) {
	s := newStores(t)
	seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	d := s.deps(&recordingMinter{}, "sub-1", "")
	rec := serve(t, d, "PUT", "/operator/password", `{"email":"ada@example.org","current_password":"correct horse battery","new_password":"a brand new passphrase"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if rec := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"correct horse battery"}`); rec.Code != http.StatusUnauthorized {
		t.Errorf("old password -> %d; want 401", rec.Code)
	}
	if rec := serve(t, d, "POST", "/operator/signin", `{"email":"ada@example.org","password":"a brand new passphrase"}`); rec.Code != http.StatusCreated {
		t.Errorf("new password -> %d; want 201", rec.Code)
	}
}

func TestDisableAndListOperatorCredentials(t *testing.T) {
	s := newStores(t)
	c := seedOperator(t, s, "sub-1", "ada@example.org", "correct horse battery")
	d := s.deps(&recordingMinter{}, "", "")
	if rec := serve(t, d, "DELETE", "/operator/credentials/opcred-missing", ""); rec.Code != http.StatusNotFound {
		t.Errorf("disable missing -> %d; want 404", rec.Code)
	}
	serve(t, d, "DELETE", "/operator/credentials/"+c.ID, "")
	rec := serve(t, d, "GET", "/members/sub-1/operator-credentials", "")
	var list []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil || len(list) != 1 {
		t.Fatalf("list %s: %v", rec.Body.String(), err)
	}
	if list[0]["disabled_at"] == nil || strings.Contains(rec.Body.String(), "argon2") {
		t.Errorf("listing = %s", rec.Body.String())
	}
	other := serve(t, d, "GET", "/members/nobody/operator-credentials", "")
	if strings.TrimSpace(other.Body.String()) == "" || other.Code != http.StatusOK {
		t.Errorf("empty listing -> %d %q", other.Code, other.Body.String())
	}
}

func TestRecoveryRequestNeedsASubjectAndEchoesTheCodeOnlyWhenAsked(t *testing.T) {
	s := newStores(t)
	d := s.deps(&recordingMinter{}, "", "")
	if rec := serve(t, d, "POST", "/recovery/request", `{}`); rec.Code != http.StatusBadRequest {
		t.Errorf("no member_id -> %d; want 400", rec.Code)
	}
	hidden := serve(t, d, "POST", "/recovery/request", `{"member_id":"sub-1"}`)
	if hidden.Code != http.StatusCreated {
		t.Fatalf("status %d", hidden.Code)
	}
	if _, has := decode(t, hidden)["secret"]; has {
		t.Error("secret leaked without echo enabled")
	}
	d.EchoChallengeCode = true
	shown := decode(t, serve(t, d, "POST", "/recovery/request", `{"member_id":"sub-1"}`))
	if s, _ := shown["secret"].(string); len(s) != 16 {
		t.Errorf("echoed secret = %v", shown["secret"])
	}
}

func TestRecoveryVerifyMintsOnceEndsOtherDevicesAndRefusesReplayAndWrongSecret(t *testing.T) {
	s := newStores(t)
	m := &recordingMinter{}
	d := s.deps(m, "", "")
	d.EchoChallengeCode = true
	dev, _ := seedDevice(t, s, "sub-1")
	req := decode(t, serve(t, d, "POST", "/recovery/request", `{"member_id":"sub-1"}`))
	id, secret := req["id"].(string), req["secret"].(string)

	bad := serve(t, d, "POST", "/recovery/verify", `{"challenge_id":"`+id+`","secret":"wrong"}`)
	if bad.Code != http.StatusUnauthorized {
		t.Fatalf("wrong secret -> %d", bad.Code)
	}
	ok := serve(t, d, "POST", "/recovery/verify", `{"challenge_id":"`+id+`","secret":"`+secret+`"}`)
	if ok.Code != http.StatusCreated || len(m.minted) != 1 || m.minted[0] != "sub-1|" {
		t.Fatalf("verify -> %d minted %v", ok.Code, m.minted)
	}
	got, err := s.auth.GetDevice(context.Background(), dev.ID)
	if err != nil || !got.IsSignedOut() {
		t.Errorf("device after recovery = %+v, %v", got, err)
	}
	replay := serve(t, d, "POST", "/recovery/verify", `{"challenge_id":"`+id+`","secret":"`+secret+`"}`)
	if replay.Code != http.StatusUnauthorized || len(m.minted) != 1 {
		t.Errorf("replay -> %d minted %v", replay.Code, m.minted)
	}
}

func TestRecoveryVerifyRefusesADeviceChallengeAndAnExpiredOne(t *testing.T) {
	s := newStores(t)
	d := s.deps(&recordingMinter{}, "", "")
	dev, _ := seedDevice(t, s, "sub-1")
	dc := decode(t, serve(t, d, "POST", "/devices/"+dev.ID+"/challenge", ""))
	rec := serve(t, d, "POST", "/recovery/verify", `{"challenge_id":"`+dc["id"].(string)+`","secret":"anything"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("device challenge used for recovery -> %d", rec.Code)
	}
	expired, err := s.auth.CreateChallenge(context.Background(), mwanachamaauth.Challenge{
		Kind: mwanachamaauth.KindRecovery, SubjectID: "sub-1", Secret: "abc", ExpiresAt: time.Now().Add(-time.Minute),
	})
	if err != nil {
		t.Fatal(err)
	}
	rec = serve(t, d, "POST", "/recovery/verify", `{"challenge_id":"`+expired.ID+`","secret":"abc"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expired -> %d; want 401", rec.Code)
	}
	rec = serve(t, d, "POST", "/recovery/verify", `{"challenge_id":"missing","secret":"abc"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("unknown challenge -> %d; want 401", rec.Code)
	}
}

func TestDeviceChallengeHidesUnknownAndSignedOutDevicesAndRedactsTheSubject(t *testing.T) {
	s := newStores(t)
	d := s.deps(&recordingMinter{}, "", "")
	dev, _ := seedDevice(t, s, "sub-1")
	rec := serve(t, d, "POST", "/devices/"+dev.ID+"/challenge", "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "sub-1") {
		t.Errorf("challenge exposes the subject: %s", rec.Body.String())
	}
	if rec := serve(t, d, "POST", "/devices/nope/challenge", ""); rec.Code != http.StatusNotFound {
		t.Errorf("unknown device -> %d", rec.Code)
	}
	if _, err := s.auth.SignOutDevice(context.Background(), dev.ID, time.Now(), mwanachamaauth.SignOutBySelf); err != nil {
		t.Fatal(err)
	}
	if rec := serve(t, d, "POST", "/devices/"+dev.ID+"/challenge", ""); rec.Code != http.StatusNotFound {
		t.Errorf("signed-out device -> %d", rec.Code)
	}
}

func signed(priv ed25519.PrivateKey, nonce string) string {
	return base64.StdEncoding.EncodeToString(ed25519.Sign(priv, []byte(nonce)))
}

func TestDeviceVerifyAcceptsAGoodSignatureOnceAndRefusesReplay(t *testing.T) {
	s := newStores(t)
	m := &recordingMinter{}
	d := s.deps(m, "", "")
	dev, priv := seedDevice(t, s, "sub-1")
	ch := decode(t, serve(t, d, "POST", "/devices/"+dev.ID+"/challenge", ""))
	id, nonce := ch["id"].(string), ch["secret"].(string)
	body := `{"challenge_id":"` + id + `","signature":"` + signed(priv, nonce) + `"}`
	rec := serve(t, d, "POST", "/devices/"+dev.ID+"/verify", body)
	if rec.Code != http.StatusCreated || len(m.minted) != 1 || m.minted[0] != "sub-1|"+dev.ID {
		t.Fatalf("verify -> %d minted %v: %s", rec.Code, m.minted, rec.Body.String())
	}
	if again := serve(t, d, "POST", "/devices/"+dev.ID+"/verify", body); again.Code != http.StatusUnauthorized || len(m.minted) != 1 {
		t.Errorf("replay -> %d minted %v", again.Code, m.minted)
	}
}

func TestDeviceVerifyRefusals(t *testing.T) {
	s := newStores(t)
	m := &recordingMinter{}
	d := s.deps(m, "", "")
	dev, priv := seedDevice(t, s, "sub-1")
	other, _ := seedDevice(t, s, "sub-2")
	ch := decode(t, serve(t, d, "POST", "/devices/"+dev.ID+"/challenge", ""))
	id, nonce := ch["id"].(string), ch["secret"].(string)

	cases := map[string]struct {
		path, body string
	}{
		"no signature":                    {"/devices/" + dev.ID + "/verify", `{"challenge_id":"` + id + `"}`},
		"signature over nonsense":         {"/devices/" + dev.ID + "/verify", `{"challenge_id":"` + id + `","signature":"` + signed(priv, "other") + `"}`},
		"literal x":                       {"/devices/" + dev.ID + "/verify", `{"challenge_id":"` + id + `","signature":"x"}`},
		"challenge of a different device": {"/devices/" + other.ID + "/verify", `{"challenge_id":"` + id + `","signature":"` + signed(priv, nonce) + `"}`},
		"unknown device":                  {"/devices/ghost/verify", `{"challenge_id":"` + id + `","signature":"` + signed(priv, nonce) + `"}`},
		"unknown challenge":               {"/devices/" + dev.ID + "/verify", `{"challenge_id":"ghost","signature":"` + signed(priv, nonce) + `"}`},
	}
	for name, c := range cases {
		if rec := serve(t, d, "POST", c.path, c.body); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s -> %d; want 401", name, rec.Code)
		}
	}
	if rec := serve(t, d, "POST", "/devices/"+dev.ID+"/verify", `{bad`); rec.Code != http.StatusBadRequest {
		t.Errorf("malformed -> %d; want 400", rec.Code)
	}
	if len(m.minted) != 0 {
		t.Errorf("a refused verify minted %v", m.minted)
	}
}

func TestDeviceVerifyWithUnsignedProofAllowedStillNeedsASignatureField(t *testing.T) {
	s := newStores(t)
	m := &recordingMinter{}
	d := s.deps(m, "", "")
	d.AllowUnsignedDeviceProof = true
	dev, _ := seedDevice(t, s, "sub-1")
	ch := decode(t, serve(t, d, "POST", "/devices/"+dev.ID+"/challenge", ""))
	id := ch["id"].(string)
	if rec := serve(t, d, "POST", "/devices/"+dev.ID+"/verify", `{"challenge_id":"`+id+`"}`); rec.Code != http.StatusUnauthorized {
		t.Errorf("no signature -> %d", rec.Code)
	}
	if rec := serve(t, d, "POST", "/devices/"+dev.ID+"/verify", `{"challenge_id":"`+id+`","signature":"anything"}`); rec.Code != http.StatusCreated {
		t.Errorf("unsigned proof allowed -> %d", rec.Code)
	}
}

func TestSetVerificationStoresTheDecisionAndKeepsWhatTheSubjectSubmitted(t *testing.T) {
	s := newStores(t)
	d := s.deps(&recordingMinter{}, "", "")
	first := serve(t, d, "PUT", "/members/sub-1/verification", `{"status":"pending","note":"looking"}`)
	if first.Code != http.StatusOK {
		t.Fatalf("status %d: %s", first.Code, first.Body.String())
	}
	got := decode(t, serve(t, d, "PUT", "/members/sub-1/verification", `{"status":"verified","note":"checked"}`))
	if got["status"] != "verified" || got["note"] != "checked" || got["member_id"] != "sub-1" {
		t.Errorf("record = %v", got)
	}
	cur, err := s.verif.Get(context.Background(), "sub-1")
	if err != nil || cur.Status != mwanachamaauth.VerificationStatusVerified {
		t.Errorf("stored = %+v, %v", cur, err)
	}
	if rec := serve(t, d, "PUT", "/members/sub-1/verification", `{nope`); rec.Code != http.StatusBadRequest {
		t.Errorf("malformed -> %d", rec.Code)
	}
}

func TestListPhoneSaltsReturnsAnObjectWithAnEmptyList(t *testing.T) {
	s := newStores(t)
	rec := serve(t, s.deps(&recordingMinter{}, "", ""), "GET", "/phone-salts", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	list, ok := decode(t, rec)["salts"].([]any)
	if !ok || len(list) != 0 {
		t.Errorf("salts = %v", decode(t, rec)["salts"])
	}
	if strings.Contains(strings.ToLower(rec.Body.String()), "secret") {
		t.Errorf("listing mentions a secret: %s", rec.Body.String())
	}
}

func startSession(t *testing.T, s stores, subject, token string) mwanachamaauth.SessionRecord {
	t.Helper()
	now := time.Now().UTC()
	rec, err := s.session.Start(context.Background(), mwanachamaauth.SessionStart{
		SubjectID: subject, Token: token, UserAgent: "test", At: now, ExpiresAt: now.Add(time.Hour),
	})
	if err != nil {
		t.Fatal(err)
	}
	return rec
}

func TestSessionListShowsOnlyTheCallersLiveSessionsAndMarksTheCurrentOne(t *testing.T) {
	s := newStores(t)
	mine := startSession(t, s, "sub-1", "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1")
	startSession(t, s, "sub-2", "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2")
	rec := serve(t, s.deps(&recordingMinter{}, "sub-1", mine.ID), "GET", "/sessions", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	list := decode(t, rec)["sessions"].([]any)
	if len(list) != 1 {
		t.Fatalf("sessions = %v", list)
	}
	if list[0].(map[string]any)["current"] != true {
		t.Errorf("current flag = %v", list[0])
	}
	other := serve(t, s.deps(&recordingMinter{}, "sub-1", "elsewhere"), "GET", "/sessions", "")
	if decode(t, other)["sessions"].([]any)[0].(map[string]any)["current"] != false {
		t.Error("a different current session still marked current")
	}
}

func TestSessionListNeedsACallerAndReportsNoSessionStore(t *testing.T) {
	s := newStores(t)
	if rec := serve(t, s.deps(&recordingMinter{}, "", ""), "GET", "/sessions", ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("no caller -> %d; want 401", rec.Code)
	}
	d := s.deps(&recordingMinter{}, "sub-1", "")
	d.Sessions = nil
	if rec := serve(t, d, "GET", "/sessions", ""); rec.Code != http.StatusNotImplemented {
		t.Errorf("no store -> %d; want 501", rec.Code)
	}
	if rec := serve(t, d, "DELETE", "/sessions/x", ""); rec.Code != http.StatusNotImplemented {
		t.Errorf("end with no store -> %d; want 501", rec.Code)
	}
	d.Identity = nil
	d.Sessions = s.session
	if rec := serve(t, d, "GET", "/sessions", ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("nil identity -> %d; want 401", rec.Code)
	}
}

func TestEndOwnSessionRefusesTheCurrentOneAndAnotherSubjectsAndEndsTheRest(t *testing.T) {
	s := newStores(t)
	cur := startSession(t, s, "sub-1", "c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3")
	old := startSession(t, s, "sub-1", "d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4")
	foreign := startSession(t, s, "sub-2", "e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5")
	d := s.deps(&recordingMinter{}, "sub-1", cur.ID)

	if rec := serve(t, d, "DELETE", "/sessions/"+cur.ID, ""); rec.Code != http.StatusConflict {
		t.Errorf("end current -> %d; want 409", rec.Code)
	}
	if rec := serve(t, d, "DELETE", "/sessions/"+foreign.ID, ""); rec.Code != http.StatusNotFound {
		t.Errorf("end foreign -> %d; want 404", rec.Code)
	}
	if rec := serve(t, d, "DELETE", "/sessions/"+old.ID, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("end old -> %d", rec.Code)
	}
	list := decode(t, serve(t, d, "GET", "/sessions", ""))["sessions"].([]any)
	if len(list) != 1 || list[0].(map[string]any)["id"] != cur.ID {
		t.Errorf("remaining = %v", list)
	}
	if rec := serve(t, s.deps(&recordingMinter{}, "", ""), "DELETE", "/sessions/"+old.ID, ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("end with no caller -> %d; want 401", rec.Code)
	}
}
