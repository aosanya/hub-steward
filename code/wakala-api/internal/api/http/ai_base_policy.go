package http

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"syscall"
	"time"

	ai "wakalaserver/modules/ai"
)

var (
	errBaseNotWeb   = errors.New("the base address must be a web address with a host name")
	errBaseNotHTTPS = errors.New("the base address must start with https://")
	errBaseUserinfo = errors.New("the base address must not contain a user name or a password")
	errBaseQuery    = errors.New("the base address must not contain a query or a fragment")
	errBaseInternal = errors.New("the base address must point to a public host, not to this machine or a private network")
	errBaseTooLong  = errors.New("the base address is too long")
	errDialInternal = errors.New("the address is on this machine or a private network")
	errRedirect     = errors.New("a model address may not redirect")
)

const maxBaseURLLength = 2048

var internalNameSuffixes = []string{".local", ".localhost", ".internal", ".lan", ".home.arpa", ".localdomain", ".intranet", ".corp", ".home"}

var specialPrefixes = parsePrefixes(
	"0.0.0.0/8", "100.64.0.0/10", "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "198.18.0.0/15",
	"198.51.100.0/24", "203.0.113.0/24", "240.0.0.0/4",
	"::/96", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "2001::/32", "2001:db8::/32", "2002::/16", "fec0::/10",
)

func parsePrefixes(texts ...string) []netip.Prefix {
	out := make([]netip.Prefix, len(texts))
	for i, text := range texts {
		out[i] = netip.MustParsePrefix(text)
	}
	return out
}

func internalAddr(a netip.Addr) bool {
	a = a.Unmap()
	if a.Zone() != "" || a.IsLoopback() || a.IsPrivate() || a.IsUnspecified() || a.IsMulticast() ||
		a.IsLinkLocalUnicast() || a.IsLinkLocalMulticast() || a.IsInterfaceLocalMulticast() {
		return true
	}
	for _, p := range specialPrefixes {
		if p.Contains(a) {
			return true
		}
	}
	return false
}

func plainASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] <= 0x20 || s[i] >= 0x7f {
			return false
		}
	}
	return true
}

func validDNSName(host string) bool {
	if host == "" || len(host) > 253 {
		return false
	}
	for _, label := range strings.Split(host, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for i := 0; i < len(label); i++ {
			c := label[i]
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
				return false
			}
		}
	}
	return true
}

func internalName(host string) bool {
	labels := strings.Split(host, ".")
	if len(labels) < 2 || host == "localhost" {
		return true
	}
	if first := labels[len(labels)-1][0]; first < 'a' || first > 'z' {
		return true
	}
	for _, suffix := range internalNameSuffixes {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}
	return false
}

func checkBaseHost(host string) error {
	if addr, err := netip.ParseAddr(host); err == nil {
		if internalAddr(addr) {
			return errBaseInternal
		}
		return nil
	}
	if !validDNSName(host) {
		return errBaseNotWeb
	}
	if internalName(host) {
		return errBaseInternal
	}
	return nil
}

func checkBasePort(port string) error {
	if port == "" {
		return nil
	}
	if n, err := strconv.Atoi(port); err != nil || n < 1 || n > 65535 {
		return errBaseNotWeb
	}
	return nil
}

func aiBaseURLPolicy(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return errBaseNotWeb
	}
	if len(raw) > maxBaseURLLength {
		return errBaseTooLong
	}
	if !plainASCII(raw) {
		return errBaseNotWeb
	}
	u, err := url.Parse(raw)
	if err != nil {
		return errBaseNotWeb
	}
	if u.Scheme != "https" {
		return errBaseNotHTTPS
	}
	if u.User != nil {
		return errBaseUserinfo
	}
	host := strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
	if host == "" {
		return errBaseNotWeb
	}
	if strings.ContainsAny(raw, "?#") {
		return errBaseQuery
	}
	if err := checkBasePort(u.Port()); err != nil {
		return err
	}
	return checkBaseHost(host)
}

func refuseInternalDial(_, address string, _ syscall.RawConn) error {
	target, err := netip.ParseAddrPort(address)
	if err != nil || internalAddr(target.Addr()) {
		return errDialInternal
	}
	return nil
}

func newGuardedAIClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second, Control: refuseInternalDial}
	return &http.Client{
		Timeout:   timeout,
		Transport: &http.Transport{DialContext: dialer.DialContext, TLSHandshakeTimeout: 10 * time.Second},
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return errRedirect
		},
	}
}

type guardedAIProber struct{ client *http.Client }

func newGuardedAIProber() ai.Prober {
	return guardedAIProber{client: newGuardedAIClient(20 * time.Second)}
}

func (p guardedAIProber) Probe(ctx context.Context, a ai.Account, key string) ai.ProbeResult {
	started := time.Now()
	reply, out := ai.Call(ctx, p.client, a, key, ai.Request{Prompt: "Reply with the single word OK.", MaxTokens: 8})
	return ai.ProbeResult{Outcome: out, Reply: reply.Text, Elapsed: time.Since(started)}
}

func aiGuardOptions() []ai.Option {
	return []ai.Option{
		ai.WithBaseURLPolicy(aiBaseURLPolicy),
		ai.WithProber(newGuardedAIProber()),
		ai.WithChatClient(newGuardedAIClient(aiChatTimeout)),
	}
}
