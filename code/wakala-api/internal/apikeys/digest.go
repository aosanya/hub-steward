package apikeys

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"

	"wakalaserver/internal/throttle"
)

const digestScheme = "sha256$"

func secretDigest(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return digestScheme + hex.EncodeToString(sum[:])
}

func secretMatches(stored, secret string) (matched, legacy bool) {
	if strings.HasPrefix(stored, digestScheme) {
		return subtle.ConstantTimeCompare([]byte(stored), []byte(secretDigest(secret))) == 1, false
	}
	ok, err := throttle.VerifyPassword(stored, secret)
	return err == nil && ok, true
}
