package mwanachamacomm

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/comm/models"
)

func questionRoomFixture(t *testing.T) (*cover13Fixture, models.ChatThread) {
	t.Helper()
	f := cover13Setup(t)
	wireReach(f, map[string]map[string]bool{"s-1": {"mem-1": true, "mem-2": true, "lead-1": true}}, map[string]bool{"lead-1": true})
	group, err := f.m.MintThread(context.Background(), "s-1", "/general")
	if err != nil {
		t.Fatalf("MintThread: %v", err)
	}
	return f, group
}

func TestQuestionRoomsAreNoneUntilTheOwnerNamesOne(t *testing.T) {
	f, _ := questionRoomFixture(t)
	rooms, err := f.m.QuestionRooms(context.Background())
	if err != nil {
		t.Fatalf("QuestionRooms: %v", err)
	}
	if len(rooms) != 0 {
		t.Fatalf("question rooms = %v, want none by default", rooms)
	}
}

func TestAnOrdinaryRoomStillLetsAMemberPostInTheGroupThread(t *testing.T) {
	f, group := questionRoomFixture(t)
	if _, err := f.m.PostChatMessageFor(context.Background(), "s-1", group.ID, "mem-1", "Hello all", "", ""); err != nil {
		t.Fatalf("a member's post in an ordinary room = %v, want it accepted", err)
	}
}

func TestAQuestionRoomRefusesAMemberPostingIntoTheOpenGroupThread(t *testing.T) {
	f, group := questionRoomFixture(t)
	ctx := context.Background()
	if err := f.m.SetQuestionRooms(ctx, []string{"s-1"}, "owner-1"); err != nil {
		t.Fatalf("SetQuestionRooms: %v", err)
	}
	_, err := f.m.PostChatMessageFor(ctx, "s-1", group.ID, "mem-1", "When does the permit office open?", "", "")
	if !errors.Is(err, models.ErrChatQuestionRoom) {
		t.Fatalf("a member's post in the open thread of a question room = %v, want ErrChatQuestionRoom", err)
	}
	read, err := f.m.ListChatMessagesFor(ctx, "s-1", group.ID, "mem-2", "", "", 50)
	if err != nil {
		t.Fatalf("ListChatMessagesFor: %v", err)
	}
	if len(read) != 0 {
		t.Fatalf("the refused question reached the room: %+v", read)
	}
}

func TestAQuestionRoomLetsTheLeadersPostInTheGroupThread(t *testing.T) {
	f, group := questionRoomFixture(t)
	ctx := context.Background()
	if err := f.m.SetQuestionRooms(ctx, []string{"s-1"}, "owner-1"); err != nil {
		t.Fatalf("SetQuestionRooms: %v", err)
	}
	if _, err := f.m.PostChatMessageFor(ctx, "s-1", group.ID, "lead-1", "The office opens at nine", "", ""); err != nil {
		t.Fatalf("a leader's post in a question room = %v, want it accepted", err)
	}
}

func TestInAQuestionRoomAMemberAsksInTheirOwnThreadAndNeighboursReadNothingOfIt(t *testing.T) {
	f, _ := questionRoomFixture(t)
	ctx := context.Background()
	if err := f.m.SetQuestionRooms(ctx, []string{"s-1"}, "owner-1"); err != nil {
		t.Fatalf("SetQuestionRooms: %v", err)
	}
	asked, err := f.m.StartChatThreadFor(ctx, "s-1", "mem-1", "Permit question")
	if err != nil {
		t.Fatalf("StartChatThreadFor: %v", err)
	}
	if _, err := f.m.PostChatMessageFor(ctx, "s-1", asked.ID, "mem-1", "When does the permit office open?", "", ""); err != nil {
		t.Fatalf("the asker's post in their own thread = %v", err)
	}
	if _, err := f.m.PostChatMessageFor(ctx, "s-1", asked.ID, "lead-1", "At nine on weekdays", "", ""); err != nil {
		t.Fatalf("the leader's answer = %v", err)
	}
	if read, err := f.m.ListChatMessagesFor(ctx, "s-1", asked.ID, "mem-2", "", "", 50); err == nil && len(read) > 0 {
		t.Fatalf("a neighbour read the question and its answer: %+v", read)
	}
	if _, err := f.m.PostChatMessageFor(ctx, "s-1", asked.ID, "mem-2", "Me too", "", ""); err == nil {
		t.Fatal("a neighbour posted into another member's question")
	}
	own, err := f.m.ListChatMessagesFor(ctx, "s-1", asked.ID, "mem-1", "", "", 50)
	if err != nil || len(own) != 2 {
		t.Fatalf("the asker reads %d messages, err %v, want their question and its answer", len(own), err)
	}
	led, err := f.m.ListChatMessagesFor(ctx, "s-1", asked.ID, "lead-1", "", "", 50)
	if err != nil || len(led) != 2 {
		t.Fatalf("the leader reads %d messages, err %v, want both", len(led), err)
	}
}

func TestASecondRoomIsNotMadeAQuestionRoomByTheFirst(t *testing.T) {
	f, group := questionRoomFixture(t)
	ctx := context.Background()
	if err := f.m.SetQuestionRooms(ctx, []string{"s-2"}, "owner-1"); err != nil {
		t.Fatalf("SetQuestionRooms: %v", err)
	}
	if _, err := f.m.PostChatMessageFor(ctx, "s-1", group.ID, "mem-1", "Hello all", "", ""); err != nil {
		t.Fatalf("a member's post in a room that is not a question room = %v", err)
	}
}
