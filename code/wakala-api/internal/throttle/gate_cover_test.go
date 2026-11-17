package throttle

import (
	"testing"

	mwanachamaauth "wakalaserver/modules/auth"
)

func TestVerifyPasswordAcceptsTheRightPasswordAndRefusesAWrongOne(t *testing.T) {
	hash, err := mwanachamaauth.Hash("a-long-enough-password")
	if err != nil {
		t.Fatal(err)
	}
	if ok, err := VerifyPassword(hash, "a-long-enough-password"); err != nil || !ok {
		t.Fatalf("right password: ok=%v err=%v", ok, err)
	}
	if ok, err := VerifyPassword(hash, "another-long-password"); err != nil || ok {
		t.Fatalf("wrong password: ok=%v err=%v", ok, err)
	}
}

func TestVerifyPasswordReportsAMalformedHash(t *testing.T) {
	if ok, err := VerifyPassword("not-a-hash", "whatever-password-1"); ok || err == nil {
		t.Fatalf("malformed hash must error: ok=%v err=%v", ok, err)
	}
}

func TestVerifyPasswordReleasesItsSlotAfterEveryCall(t *testing.T) {
	for i := 0; i < MaxConcurrentPasswordHashes*3; i++ {
		VerifyPassword("not-a-hash", "whatever-password-1")
	}
	if len(passwordHashes) != 0 {
		t.Fatalf("%d slots still held", len(passwordHashes))
	}
}

func TestVerifyAgainstNothingReturnsAndHoldsNoSlot(t *testing.T) {
	VerifyAgainstNothing("some-password-123")
	VerifyAgainstNothing("some-password-123")
	if absentHash == "" {
		t.Fatal("the stand-in hash must be built")
	}
	if len(passwordHashes) != 0 {
		t.Fatalf("%d slots still held", len(passwordHashes))
	}
}
