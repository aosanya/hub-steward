package session

import (
	"context"
	"errors"
	"testing"
	"time"

	mwanachamaauth "github.com/aosanya/mwanachama-backend-auth"

	"wakalaserver/internal/authz"
)

type countingManager struct {
	sessions  map[string]Session
	verifies  int
	revokes   int
	revokeErr error
}

func (m *countingManager) Mint(ctx context.Context, memberID string, ttl time.Duration) (Session, error) {
	return Session{}, errors.New("not used")
}

func (m *countingManager) Verify(ctx context.Context, token string) (Session, error) {
	m.verifies++
	s, ok := m.sessions[token]
	if !ok {
		return Session{}, ErrInvalidToken
	}
	return s, nil
}

func (m *countingManager) Revoke(ctx context.Context, token string) error {
	m.revokes++
	delete(m.sessions, token)
	return m.revokeErr
}

func liveSession(token, member string) Session {
	return Session{Token: token, MemberID: member, IssuedAt: time.Now().Add(-time.Minute), ExpiresAt: time.Now().Add(time.Hour)}
}

func newCachedOver(sessions ...Session) (*Cached, *countingManager, *authz.Epochs) {
	inner := &countingManager{sessions: map[string]Session{}}
	for _, s := range sessions {
		inner.sessions[s.Token] = s
	}
	epochs := authz.NewEpochs()
	return NewCached(inner, epochs), inner, epochs
}

func TestCachedVerifyAsksTheInnerManagerOnceForARepeatedToken(t *testing.T) {
	c, inner, _ := newCachedOver(liveSession("tok-1", "member-1"))
	for i := 0; i < 3; i++ {
		got, err := c.Verify(context.Background(), "tok-1")
		if err != nil || got.MemberID != "member-1" || got.Token != "tok-1" {
			t.Fatalf("verify %d = %+v, %v", i, got, err)
		}
	}
	if inner.verifies != 1 {
		t.Fatalf("inner verified %d times, want 1", inner.verifies)
	}
}

func TestCachedVerifyKeepsTheIssuedAndExpiryTimesOfTheInnerSession(t *testing.T) {
	want := liveSession("tok-1", "member-1")
	c, _, _ := newCachedOver(want)
	c.Verify(context.Background(), "tok-1")
	got, err := c.Verify(context.Background(), "tok-1")
	if err != nil || !got.IssuedAt.Equal(want.IssuedAt) || !got.ExpiresAt.Equal(want.ExpiresAt) {
		t.Fatalf("got %+v, %v want times of %+v", got, err, want)
	}
}

func TestCachedVerifyRefusesAnUnknownTokenEveryTimeAndNeverCachesTheRefusal(t *testing.T) {
	c, inner, _ := newCachedOver()
	for i := 0; i < 2; i++ {
		if _, err := c.Verify(context.Background(), "nope"); !errors.Is(err, ErrInvalidToken) {
			t.Fatalf("verify %d err = %v, want ErrInvalidToken", i, err)
		}
	}
	if inner.verifies != 2 {
		t.Fatalf("inner verified %d times, want 2", inner.verifies)
	}
}

func TestCachedVerifyStoresTheDigestOfTheTokenNeverTheTokenItself(t *testing.T) {
	c, _, _ := newCachedOver(liveSession("secret-token", "member-1"))
	c.Verify(context.Background(), "secret-token")
	if _, ok := c.cache.Peek("secret-token"); ok {
		t.Fatal("cache is keyed by the raw token")
	}
	if _, ok := c.cache.Peek(digestOf("secret-token")); !ok {
		t.Fatal("cache has no entry under the token digest")
	}
	if len(digestOf("secret-token")) != 64 || digestOf("a") == digestOf("b") {
		t.Fatalf("digest is not a distinct sha256 hex: %q", digestOf("secret-token"))
	}
}

func TestCachedVerifyRefusesACachedSessionOnceItsExpiryHasPassedAndReasksNextTime(t *testing.T) {
	s := liveSession("tok-1", "member-1")
	c, inner, _ := newCachedOver(s)
	if _, err := c.Verify(context.Background(), "tok-1"); err != nil {
		t.Fatal(err)
	}
	c.now = func() time.Time { return s.ExpiresAt }
	if _, err := c.Verify(context.Background(), "tok-1"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("err = %v, want ErrInvalidToken at the expiry instant", err)
	}
	if _, ok := c.cache.Peek(digestOf("tok-1")); ok {
		t.Fatal("expired entry was left in the cache")
	}
	c.now = time.Now
	if _, err := c.Verify(context.Background(), "tok-1"); err != nil {
		t.Fatalf("inner still holds the session, err = %v", err)
	}
	if inner.verifies != 2 {
		t.Fatalf("inner verified %d times, want 2", inner.verifies)
	}
}

func TestCachedVerifyAcceptsASessionWithNoExpiry(t *testing.T) {
	c, _, _ := newCachedOver(Session{Token: "tok-1", MemberID: "member-1"})
	c.now = func() time.Time { return time.Now().Add(1000 * time.Hour) }
	if got, err := c.Verify(context.Background(), "tok-1"); err != nil || got.MemberID != "member-1" {
		t.Fatalf("got %+v, %v", got, err)
	}
}

func TestCachedRevokeEndsTheSessionAndTheNextVerifyIsRefused(t *testing.T) {
	c, inner, _ := newCachedOver(liveSession("tok-1", "member-1"))
	c.Verify(context.Background(), "tok-1")
	if err := c.Revoke(context.Background(), "tok-1"); err != nil {
		t.Fatal(err)
	}
	if inner.revokes != 1 {
		t.Fatalf("inner revoked %d times, want 1", inner.revokes)
	}
	if _, err := c.Verify(context.Background(), "tok-1"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("err = %v, want ErrInvalidToken after revoke", err)
	}
}

func TestCachedRevokeMakesTheMembersOtherCachedSessionsBeReverified(t *testing.T) {
	c, inner, _ := newCachedOver(liveSession("tok-1", "member-1"), liveSession("tok-2", "member-1"))
	c.Verify(context.Background(), "tok-1")
	c.Verify(context.Background(), "tok-2")
	c.Revoke(context.Background(), "tok-1")
	before := inner.verifies
	if _, err := c.Verify(context.Background(), "tok-2"); err != nil {
		t.Fatal(err)
	}
	if inner.verifies != before+1 {
		t.Fatalf("tok-2 was served from cache after its member's epoch moved")
	}
}

func TestCachedRevokeLeavesAnotherMembersCachedSessionAlone(t *testing.T) {
	c, inner, _ := newCachedOver(liveSession("tok-1", "member-1"), liveSession("tok-9", "member-9"))
	c.Verify(context.Background(), "tok-1")
	c.Verify(context.Background(), "tok-9")
	c.Revoke(context.Background(), "tok-1")
	before := inner.verifies
	c.Verify(context.Background(), "tok-9")
	if inner.verifies != before {
		t.Fatal("another member's session was re-verified after an unrelated revoke")
	}
}

func TestCachedRevokeOfATokenNeverSeenDoesNotMoveAnyEpoch(t *testing.T) {
	c, inner, epochs := newCachedOver()
	stamp := epochs.Stamp()
	if err := c.Revoke(context.Background(), "unseen"); err != nil {
		t.Fatal(err)
	}
	if epochs.Stamp() != stamp {
		t.Fatal("an uncached token bumped an epoch")
	}
	if inner.revokes != 1 {
		t.Fatalf("inner revoked %d times, want 1", inner.revokes)
	}
}

func TestCachedRevokeReturnsTheInnerErrorButStillForgetsTheEntry(t *testing.T) {
	c, inner, _ := newCachedOver(liveSession("tok-1", "member-1"))
	boom := errors.New("ledger down")
	c.Verify(context.Background(), "tok-1")
	inner.revokeErr = boom
	if err := c.Revoke(context.Background(), "tok-1"); !errors.Is(err, boom) {
		t.Fatalf("err = %v, want the inner error", err)
	}
	if _, ok := c.cache.Peek(digestOf("tok-1")); ok {
		t.Fatal("entry stayed cached after a failed revoke")
	}
}

type recordingLedger struct {
	mwanachamaauth.SessionRepository
	endedSubject, endedID string
	endedAt               time.Time
	err                   error
}

func (l *recordingLedger) End(ctx context.Context, subjectID, id string, at time.Time) error {
	l.endedSubject, l.endedID, l.endedAt = subjectID, id, at
	return l.err
}

func TestLedgerEndPassesTheSessionOnAndMovesTheSubjectEpoch(t *testing.T) {
	inner := &recordingLedger{}
	epochs := authz.NewEpochs()
	ledger := NewLedger(inner, epochs)
	stamp := epochs.Stamp()
	at := time.Unix(1_700_000_000, 0)
	if err := ledger.End(context.Background(), "member-1", "sess-1", at); err != nil {
		t.Fatal(err)
	}
	if inner.endedSubject != "member-1" || inner.endedID != "sess-1" || !inner.endedAt.Equal(at) {
		t.Fatalf("inner saw %q %q %v", inner.endedSubject, inner.endedID, inner.endedAt)
	}
	if !epochs.Changed(stamp, authz.SubjectKey("member-1")) {
		t.Fatal("subject epoch did not move")
	}
	if epochs.Changed(epochs.Stamp(), authz.SubjectKey("member-1")) {
		t.Fatal("epoch reports a change against the current stamp")
	}
}

func TestLedgerEndReturnsTheInnerErrorAndStillMovesTheEpoch(t *testing.T) {
	boom := errors.New("write failed")
	inner := &recordingLedger{err: boom}
	epochs := authz.NewEpochs()
	ledger := NewLedger(inner, epochs)
	stamp := epochs.Stamp()
	if err := ledger.End(context.Background(), "member-2", "sess-2", time.Now()); !errors.Is(err, boom) {
		t.Fatalf("err = %v, want the inner error", err)
	}
	if !epochs.Changed(stamp, authz.SubjectKey("member-2")) {
		t.Fatal("subject epoch did not move on a failed end")
	}
}
