package agencies

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	mwanachamacomm "wakalaserver/modules/comm"
	"wakalaserver/modules/comm/models"
	mwanachamacustody "wakalaserver/modules/custody"
	custodymodels "wakalaserver/modules/custody/models"
	mwanachamaengage "wakalaserver/modules/engage"
	mwanachamaforms "wakalaserver/modules/forms"
	"wakalaserver/modules/shared/spec"
)

func localDatabaseOrSkip(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL is not set")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("DATABASE_URL does not point at 127.0.0.1 or localhost")
	}
	return dsn
}

func rowCount(t *testing.T, db *gorm.DB, s *spec.Spec, object, where string, args ...any) int64 {
	t.Helper()
	o, ok := s.Object(object)
	if !ok {
		t.Fatalf("no object %q", object)
	}
	var n int64
	if err := db.Raw("select count(*) from "+s.TableFor(o)+" where "+where, args...).Scan(&n).Error; err != nil {
		t.Fatalf("count %s: %v", object, err)
	}
	return n
}

func TestAWithdrawalTravelsFromCustodyToEngageFormsAndCommInPostgres(t *testing.T) {
	dsn := localDatabaseOrSkip(t)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	always := func(context.Context, string) (bool, error) { return true, nil }
	reg, err := NewRegistry(db,
		WithConsentRequired(always),
		WithModuleMounted(func(context.Context, string, string) (bool, error) { return true, nil }),
	)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, "Fan-out ward")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	t.Cleanup(func() {
		var names []string
		db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", inst.TableSlug+"%").Scan(&names)
		for _, name := range names {
			db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
		}
		db.Exec("delete from agency_instances where id = ?", inst.ID)
	})

	cm, err := reg.CustodyManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("CustodyManager: %v", err)
	}
	version, err := cm.CreateConsentVersion(ctx, mwanachamacustody.ConsentVersionInput{Scope: custodymodels.ScopeMechanics, Version: "v1", Language: custodymodels.LanguageEnglish})
	if err != nil {
		t.Fatalf("CreateConsentVersion: %v", err)
	}
	if _, err := cm.PublishConsentVersion(ctx, version.ID, "admin-1"); err != nil {
		t.Fatalf("PublishConsentVersion: %v", err)
	}
	for _, who := range []string{"mem-1", "mem-2"} {
		if _, err := mwanachamacustody.Enroll(ctx, cm.Consent(), who, "ward-1", custodymodels.LanguageEnglish, "2000-01-01T00:00:00Z"); err != nil {
			t.Fatalf("Enroll %s: %v", who, err)
		}
	}

	es, _ := mwanachamaengage.SpecForMount(inst.TableSlug, MountPosts)
	if _, err := reg.PostManager(ctx, inst.ID); err != nil {
		t.Fatalf("PostManager: %v", err)
	}
	fs, _ := mwanachamaforms.SpecFor(inst.TableSlug)
	fm, err := reg.FormManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("FormManager: %v", err)
	}
	cs, _ := mwanachamacomm.SpecFor(inst.TableSlug)
	rm, err := reg.CommManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("CommManager: %v", err)
	}

	for _, who := range []string{"mem-1", "mem-2"} {
		mustExec(t, db, es, "rsvp", "insert into %s (id, post_id, participant_id, answer, answered_at) values (?, 'p-1', ?, 'going', '2026-01-01T00:00:00Z')", "rsvp-"+who, who)
		mustExec(t, db, fs, "answer", "insert into %s (id, form_id, question_id, member_id, value_text, answered_at) values (?, 'f-1', 'q-1', ?, 'yes', '2026-01-01T00:00:00Z')", "ans-"+who, who)
		mustExec(t, db, fs, "submission", "insert into %s (id, form_id, member_id, submitted_at) values (?, 'f-1', ?, '2026-01-01T00:00:00Z')", "sub-"+who, who)
		mustExec(t, db, fs, "respondent", "insert into %s (id, public_key, first_seen_at, claimed_by_member_id, claimed_at) values (?, ?, '2026-01-01T00:00:00Z', ?, '2026-01-02T00:00:00Z')", "resp-"+who, "key-"+who, who)
		if _, err := rm.PostChatMessage(ctx, models.ChatMessage{StructureID: "s-1", ThreadID: "t-1", AuthorID: who, Body: "hello from " + who}); err != nil {
			t.Fatalf("PostChatMessage %s: %v", who, err)
		}
	}

	if _, err := cm.WithdrawConsent(ctx, "mem-1"); err != nil {
		t.Fatalf("WithdrawConsent: %v", err)
	}

	if n := rowCount(t, db, es, "rsvp", "participant_id = 'mem-1' and withdrawn_at <> ''"); n != 1 {
		t.Errorf("engage: withdrawn member has %d hidden answers, want 1 (kept, not erased)", n)
	}
	if n := rowCount(t, db, es, "rsvp", "participant_id = 'mem-2' and withdrawn_at <> ''"); n != 0 {
		t.Errorf("engage: other member has %d hidden answers, want 0", n)
	}
	if n := rowCount(t, db, es, "rsvp", "participant_id = 'mem-2'"); n != 1 {
		t.Errorf("engage: other member has %d answers, want 1", n)
	}
	if n := rowCount(t, db, fs, "respondent", "claimed_by_member_id = 'mem-1'"); n != 0 {
		t.Errorf("forms: withdrawn member still linked to %d respondents, want 0", n)
	}
	if n := rowCount(t, db, fs, "respondent", "claimed_by_member_id = 'mem-2'"); n != 1 {
		t.Errorf("forms: other member linked to %d respondents, want 1", n)
	}
	listed, err := fm.ListAllAnswers(ctx, "f-1", "", "")
	if err != nil {
		t.Fatalf("ListAllAnswers: %v", err)
	}
	if len(listed) != 1 || listed[0].MemberID != "mem-2" {
		t.Errorf("forms: listed answers = %+v, want only mem-2's", listed)
	}
	if n := rowCount(t, db, fs, "answer", "member_id = 'mem-1' and withdrawn_at <> ''"); n != 1 {
		t.Errorf("forms: withdrawn answers kept = %d, want 1 (kept, not erased)", n)
	}
	submissions, err := fm.ListSubmissions(ctx, "f-1", "", "")
	if err != nil {
		t.Fatalf("ListSubmissions: %v", err)
	}
	answerCounts := map[string]int{}
	for _, sub := range submissions {
		answerCounts[sub.MemberID] = sub.Answers
	}
	if answerCounts["mem-1"] != 0 || answerCounts["mem-2"] != 1 {
		t.Errorf("forms: report answer counts = %v, want mem-1 0 and mem-2 1", answerCounts)
	}
	activity, err := rm.Activity(ctx, models.ChatActivityQuery{StructureID: "s-1"})
	if err != nil {
		t.Fatalf("Activity: %v", err)
	}
	if activity.Messages != 1 {
		t.Errorf("comm: activity counts %d messages, want 1 (the withdrawn one left the count)", activity.Messages)
	}
	shown, err := rm.ListChatMessages(ctx, "s-1", "t-1")
	if err != nil {
		t.Fatalf("ListChatMessages: %v", err)
	}
	if len(shown) != 1 || shown[0].AuthorID != "mem-2" {
		t.Errorf("comm: listed messages = %+v, want only mem-2's", shown)
	}
	if n := rowCount(t, db, cs, "chat_message", "author_id = 'mem-1' and withdrawn_at <> ''"); n != 1 {
		t.Errorf("comm: withdrawn messages kept = %d, want 1 (kept, not erased)", n)
	}
	_, err = rm.PostChatMessage(ctx, models.ChatMessage{StructureID: "s-1", ThreadID: "t-1", AuthorID: "mem-1", Body: "again"})
	if !errors.Is(err, mwanachamacomm.ErrConsentWithdrawn) {
		t.Errorf("comm: post after withdrawal = %v, want ErrConsentWithdrawn", err)
	}

	reader, ok := reg.(WithdrawalReader)
	if !ok {
		t.Fatal("registry does not read hidden rows")
	}
	hidden, err := reader.HiddenRowsOf(ctx, inst.ID, "mem-1")
	if err != nil {
		t.Fatalf("HiddenRowsOf: %v", err)
	}
	if hidden.Engage == nil || len(hidden.Engage.RSVPs) != 1 || hidden.Engage.RSVPs[0].Answer != "going" {
		t.Errorf("hidden engage = %+v, want mem-1's going answer", hidden.Engage)
	}
	if len(hidden.Forms) != 1 || hidden.Forms[0].MemberID != "mem-1" || hidden.Forms[0].ValueText != "yes" {
		t.Errorf("hidden forms = %+v, want mem-1's answer with its text", hidden.Forms)
	}
	if hidden.Comm == nil || len(hidden.Comm.Chat) != 1 || hidden.Comm.Chat[0].Body != "hello from mem-1" {
		t.Errorf("hidden comm = %+v, want mem-1's message with its text", hidden.Comm)
	}
	other, err := reader.HiddenRowsOf(ctx, inst.ID, "mem-2")
	if err != nil || len(other.Forms) != 0 || len(other.Engage.RSVPs) != 0 || len(other.Comm.Chat) != 0 {
		t.Errorf("hidden rows of a member who did not withdraw = %+v (%v), want none", other, err)
	}

	if err := reader.RestoreWithdrawn(ctx, inst.ID, "mem-1"); err != nil {
		t.Fatalf("RestoreWithdrawn: %v", err)
	}
	if n := rowCount(t, db, es, "rsvp", "withdrawn_at <> ''"); n != 0 {
		t.Errorf("engage: %d answers still hidden after restore, want 0", n)
	}
	listed, err = fm.ListAllAnswers(ctx, "f-1", "", "")
	if err != nil || len(listed) != 2 {
		t.Errorf("forms: listed answers after restore = %+v (%v), want both members'", listed, err)
	}
	shown, err = rm.ListChatMessages(ctx, "s-1", "t-1")
	if err != nil || len(shown) != 2 {
		t.Errorf("comm: listed messages after restore = %+v (%v), want both members'", shown, err)
	}
	if after, err := reader.HiddenRowsOf(ctx, inst.ID, "mem-1"); err != nil || len(after.Forms) != 0 || len(after.Comm.Chat) != 0 || len(after.Engage.RSVPs) != 0 {
		t.Errorf("hidden rows after restore = %+v (%v), want none", after, err)
	}
}

func mustExec(t *testing.T, db *gorm.DB, s *spec.Spec, object, stmt string, args ...any) {
	t.Helper()
	o, ok := s.Object(object)
	if !ok {
		t.Fatalf("no object %q", object)
	}
	if err := db.Exec(fmt.Sprintf(stmt, s.TableFor(o)), args...).Error; err != nil {
		t.Fatalf("seed %s: %v", object, err)
	}
}
