package invitemail

import (
	"bufio"
	"context"
	"net"
	"strings"
	"testing"
	"time"
)

func sampleInvitation() Invitation {
	return Invitation{
		Agency:     "Riverside Co-op",
		Sender:     "Amina Otieno",
		SenderRole: "Secretary",
		Contact:    "help@riverside.example",
		Misuse:     "report@riverside.example",
		OpenURL:    "https://app.example/open/riverside",
		Recipient:  "guest@example.org",
	}
}

func TestComposeNamesSenderAgencyLinkAndContactsInTheBody(t *testing.T) {
	m := Compose(sampleInvitation())
	if m.To != "guest@example.org" {
		t.Fatalf("recipient = %q", m.To)
	}
	if m.Subject != "You are invited to Riverside Co-op" {
		t.Fatalf("subject = %q", m.Subject)
	}
	for _, want := range []string{
		"Sent by: Amina Otieno, Secretary, Riverside Co-op\r\n\r\n",
		"Amina Otieno invited you to join Riverside Co-op on Mwanachama",
		"Sign in and open Riverside Co-op: https://app.example/open/riverside\r\n",
		"Contact help@riverside.example. ",
		"Not expecting it? Ignore it; nothing happens until you sign in. ",
		"Misuse: report@riverside.example\r\n",
	} {
		if !strings.Contains(m.Body, want) {
			t.Errorf("body missing %q in:\n%s", want, m.Body)
		}
	}
}

func TestComposeStripsLineBreaksSoAFieldCannotInjectAHeaderOrLine(t *testing.T) {
	in := sampleInvitation()
	in.Agency = "Evil\r\nBcc: victim@example.org"
	in.Recipient = "guest@example.org\r\nBcc: victim@example.org"
	in.Sender = "A\x00B\tC"
	m := Compose(in)
	if strings.ContainsAny(m.Subject, "\r\n") {
		t.Fatalf("subject has a line break: %q", m.Subject)
	}
	if strings.ContainsAny(m.To, "\r\n") {
		t.Fatalf("recipient has a line break: %q", m.To)
	}
	if m.Subject != "You are invited to Evil Bcc: victim@example.org" {
		t.Fatalf("subject = %q", m.Subject)
	}
	if !strings.Contains(m.Body, "Sent by: A B C, ") {
		t.Fatalf("control characters were not collapsed to one space: %q", m.Body)
	}
}

func TestPlainCollapsesWhitespaceAndTrimsBothEnds(t *testing.T) {
	cases := map[string]string{
		"":               "",
		"   ":            "",
		"  a   b\t\tc  ": "a b c",
		"\n\nleading":    "leading",
		"trailing \r\n":  "trailing",
		"unicode  ünï":   "unicode ünï",
	}
	for in, want := range cases {
		if got := plain(in); got != want {
			t.Errorf("plain(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPlainCapsAFieldAtOneHundredSixtyRunesWithoutSplittingACharacter(t *testing.T) {
	got := plain(strings.Repeat("é", 500))
	if n := len([]rune(got)); n != maxFieldRunes {
		t.Fatalf("rune count = %d, want %d", n, maxFieldRunes)
	}
	if strings.ContainsRune(got, '�') {
		t.Fatalf("a character was split")
	}
}

func TestComposeCapsAnOverlongAgencyNameInTheSubject(t *testing.T) {
	in := sampleInvitation()
	in.Agency = strings.Repeat("x", 400)
	m := Compose(in)
	if want := "You are invited to " + strings.Repeat("x", maxFieldRunes); m.Subject != want {
		t.Fatalf("subject length = %d, want %d", len(m.Subject), len(want))
	}
}

func TestSMTPConfiguredNeedsBothAnAddressAndASender(t *testing.T) {
	cases := []struct {
		s    SMTP
		want bool
	}{
		{SMTP{}, false},
		{SMTP{Addr: "mail.example:25"}, false},
		{SMTP{From: "noreply@example.org"}, false},
		{SMTP{Addr: "mail.example:25", From: "noreply@example.org"}, true},
	}
	for _, c := range cases {
		if got := c.s.Configured(); got != c.want {
			t.Errorf("%+v Configured() = %v, want %v", c.s, got, c.want)
		}
	}
}

func TestSendRefusesWhenNoMailServerIsConfigured(t *testing.T) {
	err := SMTP{}.Send(context.Background(), Message{To: "a@example.org"})
	if err == nil || err.Error() != "invitemail: no mail server is configured" {
		t.Fatalf("err = %v", err)
	}
}

func TestSendRefusesAnAddressWithoutAPort(t *testing.T) {
	err := SMTP{Addr: "mail.example", From: "f@example.org"}.Send(context.Background(), Message{To: "a@example.org"})
	if err == nil || !strings.Contains(err.Error(), "not host:port") {
		t.Fatalf("err = %v", err)
	}
}

func TestSendReportsAnUnreachableServerWithoutTheAddress(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	l.Close()
	err = SMTP{Addr: addr, From: "f@example.org"}.Send(context.Background(), Message{To: "a@example.org"})
	if err == nil || err.Error() != "invitemail: could not reach the mail server" {
		t.Fatalf("err = %v", err)
	}
	if strings.Contains(err.Error(), addr) {
		t.Fatalf("error leaks the server address: %v", err)
	}
}

func TestRenderWritesHeadersThenBlankLineThenBodyAndEncodesANonASCIISubject(t *testing.T) {
	s := SMTP{From: "noreply@example.org"}
	out := s.render(Message{To: "a@example.org", Subject: "Karibu — welcome", Body: "hello\r\n"})
	head, body, ok := strings.Cut(out, "\r\n\r\n")
	if !ok {
		t.Fatalf("no blank line between headers and body: %q", out)
	}
	if body != "hello\r\n" {
		t.Fatalf("body = %q", body)
	}
	lines := strings.Split(head, "\r\n")
	if lines[0] != "From: noreply@example.org" || lines[1] != "To: a@example.org" {
		t.Fatalf("headers = %v", lines)
	}
	if !strings.HasPrefix(lines[2], "Subject: =?utf-8?q?") {
		t.Fatalf("subject not encoded: %q", lines[2])
	}
	for _, want := range []string{"MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit"} {
		found := false
		for _, l := range lines {
			if l == want {
				found = true
			}
		}
		if !found {
			t.Errorf("missing header %q", want)
		}
	}
}

func TestRenderLeavesAnASCIISubjectReadable(t *testing.T) {
	out := SMTP{From: "f@example.org"}.render(Message{To: "a@example.org", Subject: "Plain subject", Body: "x"})
	if !strings.Contains(out, "\r\nSubject: Plain subject\r\n") {
		t.Fatalf("subject changed: %q", out)
	}
}

type fakeServer struct {
	addr     string
	received chan string
}

func startFakeSMTP(t *testing.T, rejectRcpt bool) fakeServer {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { l.Close() })
	fs := fakeServer{addr: l.Addr().String(), received: make(chan string, 1)}
	go func() {
		c, err := l.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		_ = c.SetDeadline(time.Now().Add(5 * time.Second))
		r := bufio.NewReader(c)
		write := func(s string) { _, _ = c.Write([]byte(s + "\r\n")) }
		write("220 fake ready")
		var data strings.Builder
		var mailFrom, rcpt string
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			line = strings.TrimRight(line, "\r\n")
			switch {
			case strings.HasPrefix(line, "EHLO"), strings.HasPrefix(line, "HELO"):
				write("250 fake")
			case strings.HasPrefix(line, "MAIL FROM:"):
				mailFrom = line
				write("250 ok")
			case strings.HasPrefix(line, "RCPT TO:"):
				rcpt = line
				if rejectRcpt {
					write("550 no such user")
					continue
				}
				write("250 ok")
			case line == "DATA":
				write("354 go")
				for {
					l, err := r.ReadString('\n')
					if err != nil {
						return
					}
					if l == ".\r\n" {
						break
					}
					data.WriteString(l)
				}
				write("250 queued")
			case line == "QUIT":
				write("221 bye")
				fs.received <- mailFrom + "|" + rcpt + "|" + data.String()
				return
			default:
				write("250 ok")
			}
		}
	}()
	return fs
}

func TestSendDeliversEnvelopeAndRenderedMessageToTheServer(t *testing.T) {
	fs := startFakeSMTP(t, false)
	s := SMTP{Addr: fs.addr, From: "noreply@example.org"}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	m := Compose(sampleInvitation())
	if err := s.Send(ctx, m); err != nil {
		t.Fatalf("Send: %v", err)
	}
	select {
	case got := <-fs.received:
		parts := strings.SplitN(got, "|", 3)
		if parts[0] != "MAIL FROM:<noreply@example.org>" || parts[1] != "RCPT TO:<guest@example.org>" {
			t.Fatalf("envelope = %q / %q", parts[0], parts[1])
		}
		if !strings.Contains(parts[2], "Subject: You are invited to Riverside Co-op\r\n") ||
			!strings.Contains(parts[2], "Sent by: Amina Otieno, Secretary, Riverside Co-op") {
			t.Fatalf("message = %q", parts[2])
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server never saw QUIT")
	}
}

func TestSendSurfacesARejectedRecipient(t *testing.T) {
	fs := startFakeSMTP(t, true)
	s := SMTP{Addr: fs.addr, From: "noreply@example.org"}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := s.Send(ctx, Message{To: "ghost@example.org", Subject: "s", Body: "b"})
	if err == nil || !strings.Contains(err.Error(), "550") {
		t.Fatalf("err = %v", err)
	}
}

func TestSendRefusesWhenTheServerDoesNotGreet(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	go func() {
		c, err := l.Accept()
		if err == nil {
			_, _ = c.Write([]byte("554 go away\r\n"))
			c.Close()
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = SMTP{Addr: l.Addr().String(), From: "f@example.org"}.Send(ctx, Message{To: "a@example.org"})
	if err == nil || err.Error() != "invitemail: the mail server did not greet" {
		t.Fatalf("err = %v", err)
	}
}
