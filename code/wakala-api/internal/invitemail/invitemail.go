package invitemail

import (
	"context"
	"strings"
	"unicode"
)

const maxFieldRunes = 160

type Invitation struct {
	Agency     string
	Sender     string
	SenderRole string
	Contact    string
	Misuse     string
	OpenURL    string
	Recipient  string
}

type Message struct {
	To      string
	Subject string
	Body    string
}

type Sender interface {
	Send(ctx context.Context, m Message) error
}

func Compose(in Invitation) Message {
	agency := plain(in.Agency)
	sender := plain(in.Sender)
	role := plain(in.SenderRole)
	var b strings.Builder
	b.WriteString("Sent by: " + sender + ", " + role + ", " + agency + "\r\n\r\n")
	b.WriteString(sender + " invited you to join " + agency + " on Mwanachama, to answer its forms and talk to its groups.\r\n\r\n")
	b.WriteString("Sign in and open " + agency + ": " + plain(in.OpenURL) + "\r\n\r\n")
	b.WriteString(agency + " sent this and is responsible for it and for the personal data it uses. ")
	b.WriteString("Contact " + plain(in.Contact) + ". ")
	b.WriteString("Not expecting it? Ignore it; nothing happens until you sign in. ")
	b.WriteString("Misuse: " + plain(in.Misuse) + "\r\n")
	return Message{To: plain(in.Recipient), Subject: "You are invited to " + agency, Body: b.String()}
}

func plain(s string) string {
	var b strings.Builder
	runes := 0
	space := false
	for _, r := range s {
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			space = true
			continue
		}
		if space && b.Len() > 0 {
			b.WriteRune(' ')
		}
		space = false
		b.WriteRune(r)
		runes++
		if runes >= maxFieldRunes {
			break
		}
	}
	return b.String()
}
