package throttle

import "testing"

func TestVerifyPasswordMatchesOnlyTheRightPassword(t *testing.T) {
	VerifyAgainstNothing("warm")
	ok, err := VerifyPassword(absentHash, "an-absent-credential-has-this-hash")
	if err != nil || !ok {
		t.Fatalf("right password: ok=%v err=%v", ok, err)
	}
	ok, err = VerifyPassword(absentHash, "wrong-password-entirely")
	if err != nil || ok {
		t.Fatalf("wrong password: ok=%v err=%v", ok, err)
	}
}

func TestVerifyAgainstNothingNeverAcceptsAndReleasesItsSlot(t *testing.T) {
	for i := 0; i < MaxConcurrentPasswordHashes*2; i++ {
		VerifyAgainstNothing("guess")
	}
	if len(passwordHashes) != 0 {
		t.Fatalf("%d hashing slots still held", len(passwordHashes))
	}
}
