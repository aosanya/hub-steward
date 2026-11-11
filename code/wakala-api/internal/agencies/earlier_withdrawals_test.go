package agencies

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	mwanachamacustody "wakalaserver/modules/custody"
	custodymodels "wakalaserver/modules/custody/models"
	mwanachamaforms "wakalaserver/modules/forms"
	"wakalaserver/modules/shared/spec"
)

var earlierWithdrawalDatabases atomic.Int64

type beforeTheDeploy struct {
	db       *gorm.DB
	instance string
	fs       *spec.Spec
	gone     mwanachamacustody.Withdrawal
	back     mwanachamacustody.Withdrawal
}

func sharedMemoryDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_earlier_withdrawals_%d?mode=memory&cache=shared", earlierWithdrawalDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func insertRow(t *testing.T, db *gorm.DB, fs *spec.Spec, role, stmtTail string, args ...any) {
	t.Helper()
	o, ok := fs.ByRole(role)
	if !ok {
		t.Fatalf("no object with role %q", role)
	}
	if err := db.Exec(fmt.Sprintf(stmtTail, fs.TableFor(o)), args...).Error; err != nil {
		t.Fatalf("insert into %s: %v", role, err)
	}
}

func oldSend(t *testing.T, b beforeTheDeploy, id, form, member string) {
	t.Helper()
	insertRow(t, b.db, b.fs, "submission", "insert into %s (id, form_id, member_id, submitted_at, withdrawn_at) values (?, ?, ?, '2026-01-01T00:00:00Z', '')", id, form, member)
}

func hiddenAnswer(t *testing.T, b beforeTheDeploy, id, member string) {
	t.Helper()
	insertRow(t, b.db, b.fs, "answer", "insert into %s (id, form_id, question_id, member_id, value_text, answered_at, withdrawn_at) values (?, 'f-1', 'q-1', ?, 'yes', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')", id, member)
}

func theStateBeforeTheDeploy(t *testing.T) beforeTheDeploy {
	t.Helper()
	return theStateBeforeTheDeployOn(t, sharedMemoryDB(t))
}

func theStateBeforeTheDeployOn(t *testing.T, db *gorm.DB) beforeTheDeploy {
	t.Helper()
	reg, err := NewRegistry(db)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, "Ward")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
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
	for _, who := range []string{"mem-gone", "mem-back", "mem-live"} {
		if _, err := mwanachamacustody.Enroll(ctx, cm.Consent(), who, "ward-1", custodymodels.LanguageEnglish, "2000-01-01T00:00:00Z"); err != nil {
			t.Fatalf("Enroll %s: %v", who, err)
		}
	}
	if _, err := reg.FormManager(ctx, inst.ID); err != nil {
		t.Fatalf("FormManager: %v", err)
	}
	fs, err := mwanachamaforms.SpecFor(inst.TableSlug)
	if err != nil {
		t.Fatalf("SpecFor: %v", err)
	}
	b := beforeTheDeploy{db: db, instance: inst.ID, fs: fs}
	t.Cleanup(func() { dropInstanceTables(db, inst.TableSlug, inst.ID) })

	oldSend(t, b, "send-gone", "f-1", "mem-gone")
	hiddenAnswer(t, b, "ans-gone", "mem-gone")
	oldSend(t, b, "send-back-before", "f-1", "mem-back")
	hiddenAnswer(t, b, "ans-back-before", "mem-back")
	oldSend(t, b, "send-live", "f-1", "mem-live")

	if b.gone, err = cm.WithdrawConsent(ctx, "mem-gone"); err != nil {
		t.Fatalf("WithdrawConsent mem-gone: %v", err)
	}
	if b.back, err = cm.WithdrawConsent(ctx, "mem-back"); err != nil {
		t.Fatalf("WithdrawConsent mem-back: %v", err)
	}
	if _, err := cm.GiveConsent(ctx, mwanachamacustody.GiveConsentInput{ActorID: "mem-back", StructureID: "ward-1"}); err != nil {
		t.Fatalf("GiveConsent mem-back: %v", err)
	}
	oldSend(t, b, "send-back-after", "f-2", "mem-back")
	return b
}

func (b beforeTheDeploy) stamps(t *testing.T) map[string]string {
	t.Helper()
	out := map[string]string{}
	for _, role := range []string{"submission", "answer"} {
		o, _ := b.fs.ByRole(role)
		var rows []struct{ ID, WithdrawnAt string }
		if err := b.db.Raw("select id, withdrawn_at from " + b.fs.TableFor(o) + " order by id").Scan(&rows).Error; err != nil {
			t.Fatalf("read %s: %v", role, err)
		}
		for _, r := range rows {
			out[r.ID] = r.WithdrawnAt
		}
	}
	return out
}

func (b beforeTheDeploy) restart(t *testing.T, opts ...Option) error {
	t.Helper()
	reg, err := NewRegistry(b.db, opts...)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	_, err = reg.FormManager(context.Background(), b.instance)
	return err
}

func dropInstanceTables(db *gorm.DB, slug, instanceID string) {
	var names []string
	db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", slug+"%").Scan(&names)
	for _, name := range names {
		db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
	}
	db.Exec("delete from agency_instances where id = ?", instanceID)
}

func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var out bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&out, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &out
}

func TestTheFirstStartAfterTheDeployHidesTheSendsOfAResidentWhoWithdrewEarlier(t *testing.T) {
	b := theStateBeforeTheDeploy(t)
	logged := captureLog(t)

	if err := b.restart(t); err != nil {
		t.Fatalf("FormManager after the restart: %v", err)
	}

	got := b.stamps(t)
	if got["send-gone"] != b.gone.WithdrawnAt {
		t.Errorf("the withdrawn resident's send is stamped %q, want the withdrawal time %q", got["send-gone"], b.gone.WithdrawnAt)
	}
	if got["ans-gone"] != "2026-02-01T00:00:00Z" {
		t.Errorf("the withdrawn resident's answer is stamped %q, want it left as it was", got["ans-gone"])
	}
	for _, id := range []string{"send-back-before", "send-back-after", "send-live"} {
		if got[id] != "" {
			t.Errorf("%s is stamped %q, want it live: its owner's consent is live", id, got[id])
		}
	}
	for _, want := range []string{"earlier withdrawals hidden", "members=1", "sends=1", "answers=0"} {
		if !strings.Contains(logged.String(), want) {
			t.Errorf("log = %q, want it to contain %q", logged.String(), want)
		}
	}
}

func TestTheSecondStartChangesNothingAndLogsNothing(t *testing.T) {
	b := theStateBeforeTheDeploy(t)
	if err := b.restart(t); err != nil {
		t.Fatalf("first restart: %v", err)
	}
	afterFirst := b.stamps(t)
	logged := captureLog(t)

	if err := b.restart(t); err != nil {
		t.Fatalf("second restart: %v", err)
	}

	for id, stamp := range b.stamps(t) {
		if afterFirst[id] != stamp {
			t.Errorf("%s changed from %q to %q on the second start", id, afterFirst[id], stamp)
		}
	}
	if strings.Contains(logged.String(), "earlier withdrawals") {
		t.Errorf("second start logged %q, want no line: nothing was left to hide", logged.String())
	}
}

func TestAFailureWhileHidingLeavesTheRowsAsTheyWereWarnsAndLetsTheAgencyStart(t *testing.T) {
	b := theStateBeforeTheDeploy(t)
	o, _ := b.fs.ByRole("submission")
	trigger := "create trigger refuse_hiding before update on " + b.fs.TableFor(o) + " begin select raise(abort, 'refused'); end"
	if err := b.db.Exec(trigger).Error; err != nil {
		t.Fatalf("create trigger: %v", err)
	}
	before := b.stamps(t)
	logged := captureLog(t)

	if err := b.restart(t); err != nil {
		t.Fatalf("FormManager = %v, want the agency to start anyway", err)
	}

	for id, stamp := range b.stamps(t) {
		if before[id] != stamp {
			t.Errorf("%s changed from %q to %q although the run failed", id, before[id], stamp)
		}
	}
	for _, want := range []string{"level=WARN", "earlier withdrawals not hidden", "refused"} {
		if !strings.Contains(logged.String(), want) {
			t.Errorf("log = %q, want it to contain %q", logged.String(), want)
		}
	}
}

func TestNothingIsHiddenWhereWithdrawalOnlyReleases(t *testing.T) {
	b := theStateBeforeTheDeploy(t)
	before := b.stamps(t)

	if err := b.restart(t, WithWithdrawalPolicy(WithdrawalReleasesOnly)); err != nil {
		t.Fatalf("FormManager: %v", err)
	}

	for id, stamp := range b.stamps(t) {
		if before[id] != stamp {
			t.Errorf("%s changed from %q to %q under the release-only policy", id, before[id], stamp)
		}
	}
}

func TestNothingIsHiddenWhereCustodyIsNotMounted(t *testing.T) {
	b := theStateBeforeTheDeploy(t)
	before := b.stamps(t)
	notMounted := WithModuleMounted(func(_ context.Context, _, module string) (bool, error) { return module != "custody", nil })

	if err := b.restart(t, notMounted); err != nil {
		t.Fatalf("FormManager: %v", err)
	}

	for id, stamp := range b.stamps(t) {
		if before[id] != stamp {
			t.Errorf("%s changed from %q to %q with custody not mounted", id, before[id], stamp)
		}
	}
}

func TestTheFirstAndSecondStartAfterTheDeployInPostgres(t *testing.T) {
	dsn := localDatabaseOrSkip(t)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	b := theStateBeforeTheDeployOn(t, db)
	logged := captureLog(t)

	if err := b.restart(t); err != nil {
		t.Fatalf("FormManager after the restart: %v", err)
	}
	afterFirst := b.stamps(t)

	if afterFirst["send-gone"] != b.gone.WithdrawnAt {
		t.Errorf("the withdrawn resident's send is stamped %q, want %q", afterFirst["send-gone"], b.gone.WithdrawnAt)
	}
	for _, id := range []string{"send-back-before", "send-back-after", "send-live"} {
		if afterFirst[id] != "" {
			t.Errorf("%s is stamped %q, want it live", id, afterFirst[id])
		}
	}
	if !strings.Contains(logged.String(), "earlier withdrawals hidden") || !strings.Contains(logged.String(), "sends=1") {
		t.Errorf("log = %q, want the hidden line with sends=1", logged.String())
	}

	if err := b.restart(t); err != nil {
		t.Fatalf("second restart: %v", err)
	}
	for id, stamp := range b.stamps(t) {
		if afterFirst[id] != stamp {
			t.Errorf("%s changed from %q to %q on the second start", id, afterFirst[id], stamp)
		}
	}
}
