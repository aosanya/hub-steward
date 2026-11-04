package throttle

import (
	"sync"

	mwanachamaauth "wakalaserver/modules/auth"
)

var passwordHashes = make(chan struct{}, MaxConcurrentPasswordHashes)

var (
	absentHashOnce sync.Once
	absentHash     string
)

func VerifyPassword(hash, password string) (bool, error) {
	passwordHashes <- struct{}{}
	defer func() { <-passwordHashes }()
	return mwanachamaauth.Verify(hash, password)
}

func VerifyAgainstNothing(password string) {
	absentHashOnce.Do(func() {
		absentHash, _ = mwanachamaauth.Hash("an-absent-credential-has-this-hash")
	})
	_, _ = VerifyPassword(absentHash, password)
}
