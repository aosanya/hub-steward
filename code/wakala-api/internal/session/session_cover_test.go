package session

import (
	"context"
	"strings"
	"testing"
	"time"
)

type fakeClock struct{ at time.Time }

func (c *fakeClock) now() time.Time { return c.at }

func newTestManager() (*HMACManager, *fakeClock) {
	clock := &fakeClock{at: time.Unix(1_700_000_000, 0)}
	counter := 0
	m := NewHMACManager([]byte("secret-one"), clock.now, func() string {
		counter++
		return string(rune('a' + counter%26))
	})
	return m, clock
}

func TestMintRefusesAnEmptyMember(t *testing.T) {
	m, _ := newTestManager()
	if _, err := m.Mint(context.Background(), "", time.Hour); err == nil {
		t.Fatal("expected a refusal for an empty member id")
	}
}

func TestMintedTokenVerifiesAndCarriesMemberAndExpiry(t *testing.T) {
	m, clock := newTestManager()
	s, err := m.Mint(context.Background(), "member-1", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if s.MemberID != "member-1" || !s.ExpiresAt.Equal(clock.at.Add(time.Hour)) {
		t.Fatalf("unexpected session %+v", s)
	}
	got, err := m.Verify(context.Background(), s.Token)
	if err != nil || got.MemberID != "member-1" || got.Token != s.Token {
		t.Fatalf("verify = %+v, %v", got, err)
	}
}

func TestVerifyRefusesMalformedAndTamperedTokens(t *testing.T) {
	m, _ := newTestManager()
	s, _ := m.Mint(context.Background(), "member-1", time.Hour)
	body := s.Token[:strings.LastIndexByte(s.Token, '.')]
	other := NewHMACManager([]byte("another-secret"), nil, nil)
	cases := map[string]string{
		"no dot":          "nodothere",
		"empty":           "",
		"bad signature":   body + ".AAAA",
		"signed by other": func() string { o, _ := other.Mint(context.Background(), "member-1", time.Hour); return o.Token }(),
		"body altered":    "x" + s.Token,
	}
	for name, token := range cases {
		if _, err := m.Verify(context.Background(), token); err != ErrInvalidToken {
			t.Errorf("%s: err = %v, want ErrInvalidToken", name, err)
		}
	}
}

func TestVerifyRefusesAValidlySignedBodyThatIsNotAPayload(t *testing.T) {
	m, _ := newTestManager()
	for _, body := range []string{"!!!notbase64!!!", b64([]byte("not json"))} {
		token := body + "." + m.sign(body)
		if _, err := m.Verify(context.Background(), token); err != ErrInvalidToken {
			t.Errorf("body %q: err = %v", body, err)
		}
	}
}

func TestVerifyRefusesAtTheExpiryInstant(t *testing.T) {
	m, clock := newTestManager()
	s, _ := m.Mint(context.Background(), "member-1", time.Minute)
	clock.at = clock.at.Add(time.Minute - time.Second)
	if _, err := m.Verify(context.Background(), s.Token); err != nil {
		t.Fatalf("one second before expiry: %v", err)
	}
	clock.at = clock.at.Add(time.Second)
	if _, err := m.Verify(context.Background(), s.Token); err != ErrInvalidToken {
		t.Fatalf("at expiry: %v", err)
	}
}

func TestVerifyRefusesAValidSignatureThisManagerNeverMinted(t *testing.T) {
	a, _ := newTestManager()
	b, _ := newTestManager()
	s, _ := a.Mint(context.Background(), "member-1", time.Hour)
	if _, err := b.Verify(context.Background(), s.Token); err != ErrInvalidToken {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
}

func TestRevokeEndsOnlyThatToken(t *testing.T) {
	m, clock := newTestManager()
	first, _ := m.Mint(context.Background(), "member-1", time.Hour)
	clock.at = clock.at.Add(time.Second)
	second, _ := m.Mint(context.Background(), "member-1", time.Hour)
	if err := m.Revoke(context.Background(), first.Token); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Verify(context.Background(), first.Token); err != ErrInvalidToken {
		t.Fatalf("revoked token verified: %v", err)
	}
	if _, err := m.Verify(context.Background(), second.Token); err != nil {
		t.Fatalf("other token lost: %v", err)
	}
	if err := m.Revoke(context.Background(), "unknown.token"); err != nil {
		t.Fatalf("revoking an unknown token must be quiet: %v", err)
	}
}

func TestMemberKeepsOnlyTheNewestSessionsBeyondTheCap(t *testing.T) {
	m, clock := newTestManager()
	var tokens []string
	for i := 0; i < MaxSessionsPerMember+1; i++ {
		clock.at = clock.at.Add(time.Second)
		s, err := m.Mint(context.Background(), "member-1", 24*time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		tokens = append(tokens, s.Token)
	}
	if _, err := m.Verify(context.Background(), tokens[0]); err != ErrInvalidToken {
		t.Fatalf("oldest session survived the cap: %v", err)
	}
	if _, err := m.Verify(context.Background(), tokens[len(tokens)-1]); err != nil {
		t.Fatalf("newest session lost: %v", err)
	}
}

func TestVerifyRefreshesRecencySoAnActiveSessionOutlivesIdleOnes(t *testing.T) {
	m, clock := newTestManager()
	first, _ := m.Mint(context.Background(), "member-1", 24*time.Hour)
	for i := 0; i < MaxSessionsPerMember-1; i++ {
		clock.at = clock.at.Add(time.Second)
		if _, err := m.Mint(context.Background(), "member-1", 24*time.Hour); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := m.Verify(context.Background(), first.Token); err != nil {
		t.Fatalf("first session should still be live: %v", err)
	}
	clock.at = clock.at.Add(time.Second)
	if _, err := m.Mint(context.Background(), "member-1", 24*time.Hour); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Verify(context.Background(), first.Token); err != nil {
		t.Fatalf("recently used session was evicted: %v", err)
	}
}

func TestCapIsPerMember(t *testing.T) {
	m, clock := newTestManager()
	other, _ := m.Mint(context.Background(), "member-2", 24*time.Hour)
	for i := 0; i < MaxSessionsPerMember+5; i++ {
		clock.at = clock.at.Add(time.Second)
		m.Mint(context.Background(), "member-1", 24*time.Hour)
	}
	if _, err := m.Verify(context.Background(), other.Token); err != nil {
		t.Fatalf("another member's session was evicted: %v", err)
	}
}

func TestExpiredSessionsAreSweptOnTheNextMintAfterTheInterval(t *testing.T) {
	m, clock := newTestManager()
	short, _ := m.Mint(context.Background(), "member-1", time.Second)
	clock.at = clock.at.Add(SweepEvery + time.Second)
	if _, err := m.Mint(context.Background(), "member-2", time.Hour); err != nil {
		t.Fatal(err)
	}
	m.mu.RLock()
	_, stillHeld := m.live[short.Token]
	_, memberHeld := m.held["member-1"]
	m.mu.RUnlock()
	if stillHeld || memberHeld {
		t.Fatalf("expired session not swept: live=%v held=%v", stillHeld, memberHeld)
	}
}

func TestUserAgentTravelsOnTheContext(t *testing.T) {
	ctx := WithUserAgent(context.Background(), "Mozilla/5.0")
	if got := userAgentOf(ctx); got != "Mozilla/5.0" {
		t.Fatalf("got %q", got)
	}
	if got := userAgentOf(context.Background()); got != "" {
		t.Fatalf("got %q for a bare context", got)
	}
}

func TestDefaultNonceMakesTwoMintsDifferEvenInTheSameSecond(t *testing.T) {
	m := NewHMACManager([]byte("s"), func() time.Time { return time.Unix(1_700_000_000, 0) }, nil)
	a, _ := m.Mint(context.Background(), "member-1", time.Hour)
	b, _ := m.Mint(context.Background(), "member-1", time.Hour)
	if a.Token == b.Token {
		t.Fatal("two mints in one second produced the same token")
	}
}
