package http

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"
)

func TestAIBaseURLPolicyAcceptsPublicHTTPSAddresses(t *testing.T) {
	accepted := []string{
		"https://api.example.com",
		"https://api.example.com/v1",
		"  https://api.example.com:8443/v1  ",
		"https://API.Example.COM./v1",
		"https://8.8.8.8/v1",
		"https://[2606:4700:4700::1111]/v1",
		"https://my-model.example.co.uk:65535",
	}
	for _, raw := range accepted {
		if err := aiBaseURLPolicy(raw); err != nil {
			t.Errorf("%q refused: %v", raw, err)
		}
	}
}

func TestAIBaseURLPolicyRefusalsNameTheirReason(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want error
	}{
		{"empty", "", errBaseNotWeb},
		{"blank", "   ", errBaseNotWeb},
		{"too long", "https://example.com/" + strings.Repeat("a", maxBaseURLLength), errBaseTooLong},
		{"non ascii", "https://exämple.com", errBaseNotWeb},
		{"inner space", "https://exa mple.com", errBaseNotWeb},
		{"control character", "https://example.com/\x01", errBaseNotWeb},
		{"plain http", "http://example.com", errBaseNotHTTPS},
		{"ftp", "ftp://example.com", errBaseNotHTTPS},
		{"no scheme", "example.com", errBaseNotHTTPS},
		{"user name", "https://user@example.com", errBaseUserinfo},
		{"user and password", "https://user:secret@example.com", errBaseUserinfo},
		{"no host", "https:///v1", errBaseNotWeb},
		{"query", "https://example.com/v1?key=1", errBaseQuery},
		{"fragment", "https://example.com/v1#top", errBaseQuery},
		{"empty query marker", "https://example.com/v1?", errBaseQuery},
		{"port zero", "https://example.com:0", errBaseNotWeb},
		{"port too large", "https://example.com:65536", errBaseNotWeb},
		{"loopback name", "https://localhost", errBaseInternal},
		{"loopback address", "https://127.0.0.1", errBaseInternal},
		{"loopback v6", "https://[::1]", errBaseInternal},
		{"private 10", "https://10.0.0.5", errBaseInternal},
		{"private 192", "https://192.168.1.1", errBaseInternal},
		{"private 172", "https://172.16.0.1", errBaseInternal},
		{"link local metadata", "https://169.254.169.254/latest", errBaseInternal},
		{"unspecified", "https://0.0.0.0", errBaseInternal},
		{"single label", "https://intranet", errBaseInternal},
		{"internal suffix", "https://db.internal", errBaseInternal},
		{"local suffix", "https://printer.local", errBaseInternal},
		{"numeric top label", "https://example.123", errBaseInternal},
		{"underscore in name", "https://bad_name.example.com", errBaseNotWeb},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := aiBaseURLPolicy(c.raw); !errors.Is(err, c.want) {
				t.Fatalf("aiBaseURLPolicy(%q) = %v, want %v", c.raw, err, c.want)
			}
		})
	}
}

func TestInternalAddrRecognisesNonPublicRanges(t *testing.T) {
	internal := []string{
		"127.0.0.1", "10.1.2.3", "172.31.255.255", "192.168.0.1", "169.254.1.1", "0.0.0.0",
		"100.64.0.1", "198.18.0.1", "192.0.2.1", "198.51.100.7", "203.0.113.9", "240.0.0.1",
		"224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "ff02::1", "2001:db8::1", "2002::1",
		"64:ff9b::808:808", "fec0::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "fe80::1%eth0",
	}
	for _, text := range internal {
		if !internalAddr(netip.MustParseAddr(text)) {
			t.Errorf("%s should be internal", text)
		}
	}
	public := []string{"8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"}
	for _, text := range public {
		if internalAddr(netip.MustParseAddr(text)) {
			t.Errorf("%s should be public", text)
		}
	}
}

func TestValidDNSNameHoldsLabelAndLengthRules(t *testing.T) {
	long63 := strings.Repeat("a", 63)
	cases := map[string]bool{
		"example.com":                   true,
		"a-b.example.com":               true,
		"1.example.com":                 true,
		"":                              false,
		"example..com":                  false,
		".example.com":                  false,
		"-a.example.com":                false,
		"a-.example.com":                false,
		"Example.com":                   false,
		"exa_mple.com":                  false,
		"exa mple.com":                  false,
		long63 + ".com":                 true,
		long63 + "a.com":                false,
		strings.Repeat("a.", 127) + "a": false,
	}
	for host, want := range cases {
		if got := validDNSName(host); got != want {
			t.Errorf("validDNSName(%q) = %v, want %v", host, got, want)
		}
	}
}

func TestInternalNameCatchesBareAndSuffixedHosts(t *testing.T) {
	cases := map[string]bool{
		"localhost":        true,
		"intranet":         true,
		"x.localhost":      true,
		"router.lan":       true,
		"nas.home.arpa":    true,
		"host.localdomain": true,
		"wiki.intranet":    true,
		"app.corp":         true,
		"box.home":         true,
		"example.com":      false,
		"api.example.org":  false,
		"homepage.com":     false,
	}
	for host, want := range cases {
		if got := internalName(host); got != want {
			t.Errorf("internalName(%q) = %v, want %v", host, got, want)
		}
	}
}

func TestCheckBasePortAcceptsEmptyAndRange(t *testing.T) {
	for _, port := range []string{"", "1", "443", "65535"} {
		if err := checkBasePort(port); err != nil {
			t.Errorf("port %q refused: %v", port, err)
		}
	}
	for _, port := range []string{"0", "65536", "-1", "http", "80a", "99999999999999999999"} {
		if err := checkBasePort(port); !errors.Is(err, errBaseNotWeb) {
			t.Errorf("port %q = %v, want errBaseNotWeb", port, err)
		}
	}
}

func TestPlainASCIIRefusesSpacesControlsAndHighBytes(t *testing.T) {
	if !plainASCII("https://a.b/~x") {
		t.Fatal("printable ascii should pass")
	}
	for _, s := range []string{"a b", "a\tb", "a\x7fb", "é", "a\x00"} {
		if plainASCII(s) {
			t.Errorf("%q should not be plain ascii", s)
		}
	}
}

func TestRefuseInternalDialBlocksPrivateAndUnparseableTargets(t *testing.T) {
	for _, address := range []string{"127.0.0.1:443", "10.0.0.1:80", "[::1]:443", "169.254.169.254:80", "not-an-address", "example.com:443", ""} {
		if err := refuseInternalDial("tcp", address, nil); !errors.Is(err, errDialInternal) {
			t.Errorf("%q = %v, want errDialInternal", address, err)
		}
	}
	for _, address := range []string{"8.8.8.8:443", "[2606:4700:4700::1111]:443"} {
		if err := refuseInternalDial("tcp", address, nil); err != nil {
			t.Errorf("%q refused: %v", address, err)
		}
	}
}

func TestGuardedAIClientCannotReachALoopbackServer(t *testing.T) {
	reached := false
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))
	defer server.Close()
	client := newGuardedAIClient(5 * time.Second)
	response, err := client.Get(server.URL)
	if err == nil {
		response.Body.Close()
		t.Fatal("a loopback server was reachable")
	}
	if !errors.Is(err, errDialInternal) {
		t.Fatalf("error = %v, want errDialInternal", err)
	}
	if reached {
		t.Fatal("the request reached the handler")
	}
}

func TestGuardedAIClientRefusesToFollowRedirects(t *testing.T) {
	client := newGuardedAIClient(time.Second)
	if client.Timeout != time.Second {
		t.Fatalf("timeout = %v", client.Timeout)
	}
	if err := client.CheckRedirect(&http.Request{}, nil); !errors.Is(err, errRedirect) {
		t.Fatalf("redirect = %v, want errRedirect", err)
	}
}

func TestAIGuardOptionsCarryThreeOptions(t *testing.T) {
	if got := len(aiGuardOptions()); got != 3 {
		t.Fatalf("options = %d, want 3", got)
	}
	if newGuardedAIProber() == nil {
		t.Fatal("no prober")
	}
}
