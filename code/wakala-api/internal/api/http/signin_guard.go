package http

import (
	"net"
	"net/http"

	"wakalaserver/internal/throttle"
)

type signInGuard struct {
	byClient  *throttle.Strikes
	byAddress *throttle.Strikes
}

func newSignInGuard() *signInGuard {
	return &signInGuard{
		byClient:  throttle.NewStrikes(throttle.SignInTrackedKeys, throttle.SignInTriesPerClient, throttle.SignInLockFor),
		byAddress: throttle.NewStrikes(throttle.SignInTrackedKeys, throttle.SignInTriesPerAddress, throttle.SignInLockFor),
	}
}

func signInClientKey(email, client string) string {
	return email + "\x00" + client
}

func clientAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
