package voting

import (
	"context"
	"testing"
)

func TestTheAskerReadsTheirOpenQuestionOutsideItsAudienceAndOnlyAudienceMembersAreOfferedSend(t *testing.T) {
	f := newPolls(t)
	f.poll(t, nil)
	ctx := context.Background()

	asker, err := f.pm.ListOpenPolls(ctx, "clerk")
	if err != nil {
		t.Fatal(err)
	}
	if len(asker) != 1 || !asker[0].Mine || asker[0].InAudience {
		t.Fatalf("asker outside the audience: %+v", asker)
	}

	member, err := f.pm.ListOpenPolls(ctx, "amina")
	if err != nil {
		t.Fatal(err)
	}
	if len(member) != 1 || member[0].Mine || !member[0].InAudience {
		t.Fatalf("audience member: %+v", member)
	}

	stranger, err := f.pm.ListOpenPolls(ctx, "stranger")
	if err != nil {
		t.Fatal(err)
	}
	if len(stranger) != 0 {
		t.Fatalf("a person outside the audience who did not ask sees %+v", stranger)
	}
}

func TestTheAskerWhoIsInTheAudienceIsOfferedSendToo(t *testing.T) {
	f := newPolls(t)
	f.poll(t, func(p *Poll) { p.CreatedBy = "amina" })
	got, err := f.pm.ListOpenPolls(context.Background(), "amina")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || !got[0].Mine || !got[0].InAudience {
		t.Fatalf("%+v", got)
	}
}

func TestAClosedQuestionIsNotListedForItsAsker(t *testing.T) {
	f := newPolls(t)
	f.poll(t, func(p *Poll) {
		p.OpensAt = f.now.Add(-3 * 60 * 60 * 1e9).Format("2006-01-02T15:04:05Z07:00")
		p.ClosesAt = f.now.Add(-2 * 60 * 60 * 1e9).Format("2006-01-02T15:04:05Z07:00")
	})
	got, err := f.pm.ListOpenPolls(context.Background(), "clerk")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("%+v", got)
	}
}
