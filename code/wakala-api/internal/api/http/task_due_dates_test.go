package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	"wakalaserver/internal/agencies"
)

type taskDueDatesWorld struct {
	walk     stepRunWalk
	base     string
	group    string
	actors   []string
	nextName int
	leader   *http.Cookie
}

func newTaskDueDatesWorld(t *testing.T) *taskDueDatesWorld {
	t.Helper()
	walk := newStepRunWalk(t, nil)
	w := &taskDueDatesWorld{walk: walk, base: "/instances/" + walk.instance}
	rec := walk.call(t, "POST", w.base+"/actor/groups", map[string]any{"name": "Dates group"}, walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", rec.Code, rec.Body.String())
	}
	w.group, _ = decodeObject(t, rec)["id"].(string)
	for i := 0; i < 24; i++ {
		w.actors = append(w.actors, w.newActor(t))
	}
	w.leader = w.leaderOf(t)
	return w
}

func (w *taskDueDatesWorld) leaderOf(t *testing.T) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	um, err := w.walk.deps.Registry.ActorManager(ctx, w.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	kind, err := um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: "Dates lead", LeadsGroup: true})
	if err != nil {
		t.Fatalf("CreateRoleKind: %v", err)
	}
	if _, err := um.SetRoleKindLeadsGroup(ctx, kind.ID, true); err != nil {
		t.Fatalf("SetRoleKindLeadsGroup: %v", err)
	}
	leader := w.newActor(t)
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: leader, GroupID: w.group, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
	return w.walk.cookieFor(t, leader)
}

func (w *taskDueDatesWorld) newActor(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	um, err := w.walk.deps.Registry.ActorManager(ctx, w.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	w.nextName++
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Dated person"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.walk.deps.Registry.AddMember(ctx, w.walk.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	return actor.ID
}

func (w *taskDueDatesWorld) post(t *testing.T, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	return w.walk.call(t, "POST", w.base+path, body, w.walk.owner)
}

func (w *taskDueDatesWorld) get(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()
	return w.walk.call(t, "GET", w.base+path, nil, w.walk.owner)
}

type taskDueDatesVerdict func(rec *httptest.ResponseRecorder) string

func taskDueDatesNever500(rec *httptest.ResponseRecorder) string {
	if rec.Code >= 500 {
		return "server error"
	}
	return ""
}

func taskDueDatesRefused(rec *httptest.ResponseRecorder) string {
	if rec.Code < 400 || rec.Code >= 500 {
		return "expected a 4xx refusal"
	}
	return ""
}

func taskDueDatesNamesField(field string) taskDueDatesVerdict {
	return func(rec *httptest.ResponseRecorder) string {
		if !strings.Contains(rec.Body.String(), field) {
			return "refusal does not name " + field
		}
		return ""
	}
}

func taskDueDatesAccepted(rec *httptest.ResponseRecorder) string {
	if rec.Code < 200 || rec.Code >= 300 {
		return "expected a 2xx"
	}
	return ""
}

func taskDueDatesRun(t *testing.T, label string, rec *httptest.ResponseRecorder, verdicts ...taskDueDatesVerdict) {
	t.Helper()
	body := strings.TrimSpace(rec.Body.String())
	if len(body) > 300 {
		body = body[:300]
	}
	t.Logf("PROBE %s -> %d %s", label, rec.Code, body)
	for _, v := range verdicts {
		if problem := v(rec); problem != "" {
			t.Errorf("%s: %s (%d %s)", label, problem, rec.Code, body)
		}
	}
}

func TestTaskDueDatesRound1Invitations(t *testing.T) {
	w := newTaskDueDatesWorld(t)
	invite := func(i int, expires any) *httptest.ResponseRecorder {
		return w.walk.call(t, "POST", w.base+"/actor/groups/"+w.group+"/invitations", map[string]any{"actor_id": w.actors[i], "expires_at": expires}, w.leader)
	}
	taskDueDatesRun(t, "1 expiry one hour ahead", invite(0, "2099-01-01T00:00:00Z"), taskDueDatesAccepted)
	taskDueDatesRun(t, "2 expiry in the past", invite(1, "2020-01-01T00:00:00Z"), taskDueDatesRefused)
	taskDueDatesRun(t, "3 expiry year 0001", invite(2, "0001-01-01T00:00:00Z"), taskDueDatesRefused)
	taskDueDatesRun(t, "4 expiry year 9999", invite(3, "9999-12-31T23:59:59Z"), taskDueDatesNever500)
	taskDueDatesRun(t, "5 expiry malformed", invite(4, "next tuesday"), taskDueDatesRefused)
	taskDueDatesRun(t, "6 expiry date only", invite(5, "2099-01-01"), taskDueDatesRefused)
	taskDueDatesRun(t, "7 expiry with offset", invite(6, "2099-01-01T12:00:00+05:30"), taskDueDatesAccepted)
	taskDueDatesRun(t, "8 expiry a number", invite(7, 4102444800), taskDueDatesNever500)
	taskDueDatesRun(t, "9 expiry year 10000", invite(8, "10000-01-01T00:00:00Z"), taskDueDatesNever500)
	taskDueDatesRun(t, "10 expiry leap second", invite(9, "2099-06-30T23:59:60Z"), taskDueDatesNever500)
}

func TestTaskDueDatesRound2Delegations(t *testing.T) {
	w := newTaskDueDatesWorld(t)
	grant := func(i int, body map[string]any) *httptest.ResponseRecorder {
		body["delegate_id"] = w.actors[i]
		body["subject_id"] = w.actors[i+10]
		return w.post(t, "/actor/delegations", body)
	}
	taskDueDatesRun(t, "1 ends 2099", grant(0, map[string]any{"ends_at": "2099-01-01T00:00:00Z"}), taskDueDatesAccepted)
	taskDueDatesRun(t, "2 ends in the past", grant(1, map[string]any{"ends_at": "2020-01-01T00:00:00Z"}), taskDueDatesRefused)
	taskDueDatesRun(t, "3 ends year 0001", grant(2, map[string]any{"ends_at": "0001-01-01T00:00:00Z"}), taskDueDatesRefused)
	taskDueDatesRun(t, "4 ends year 9999", grant(3, map[string]any{"ends_at": "9999-12-31T23:59:59Z"}), taskDueDatesNever500)
	taskDueDatesRun(t, "5 ends malformed", grant(4, map[string]any{"ends_at": "soon"}), taskDueDatesRefused, taskDueDatesNamesField("ends_at"))
	taskDueDatesRun(t, "6 ends date only", grant(5, map[string]any{"ends_at": "2099-01-01"}), taskDueDatesRefused, taskDueDatesNamesField("ends_at"))
	taskDueDatesRun(t, "7 ends with offset", grant(6, map[string]any{"ends_at": "2099-01-01T12:00:00+05:30"}), taskDueDatesAccepted)
	taskDueDatesRun(t, "8 ends a number", grant(7, map[string]any{"ends_at": 4102444800}), taskDueDatesNever500)
	taskDueDatesRun(t, "9 starts_at field given", grant(8, map[string]any{"starts_at": "2099-01-01T00:00:00Z", "ends_at": "2098-01-01T00:00:00Z"}), taskDueDatesNever500)
	taskDueDatesRun(t, "10 ends null", grant(9, map[string]any{"ends_at": nil}), taskDueDatesNever500)
	taskDueDatesRun(t, "listed", w.get(t, "/actor/actors/"+w.actors[10]+"/delegations"), taskDueDatesNever500)
	taskDueDatesRun(t, "listed other", w.get(t, "/actor/actors/"+w.actors[0]+"/delegations"), taskDueDatesNever500)
}

func TestTaskDueDatesRound3RepeatingTasks(t *testing.T) {
	w := newTaskDueDatesWorld(t)
	create := func(schedule map[string]any) *httptest.ResponseRecorder {
		return w.post(t, "/taskmanager/repeating-tasks", map[string]any{
			"title":         "Water the beds",
			"assignee_kind": "actor",
			"assignee_id":   "test-owner",
			"schedule":      schedule,
		})
	}
	weekly := func(start, rule string) map[string]any {
		return map[string]any{"start": start, "zone": "Europe/Budapest", "rule": rule}
	}
	taskDueDatesRun(t, "1 weekly from 2099", create(weekly("2099-01-05T08:00:00Z", "FREQ=WEEKLY")), taskDueDatesAccepted)
	taskDueDatesRun(t, "2 interval zero", create(weekly("2099-01-05T08:00:00Z", "FREQ=WEEKLY;INTERVAL=0")), taskDueDatesRefused)
	taskDueDatesRun(t, "3 interval negative", create(weekly("2099-01-05T08:00:00Z", "FREQ=WEEKLY;INTERVAL=-2")), taskDueDatesRefused)
	taskDueDatesRun(t, "4 end before start", create(map[string]any{"start": "2099-01-05T08:00:00Z", "end": "2098-01-05T08:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=DAILY"}), taskDueDatesRefused)
	taskDueDatesRun(t, "5 start year 0001", create(weekly("0001-01-01T00:00:00Z", "FREQ=YEARLY")), taskDueDatesNever500)
	taskDueDatesRun(t, "6 start year 9999 daily", create(weekly("9999-12-31T00:00:00Z", "FREQ=DAILY")), taskDueDatesNever500)
	taskDueDatesRun(t, "7 unknown zone", create(map[string]any{"start": "2099-01-05T08:00:00Z", "zone": "Mars/Base", "rule": "FREQ=DAILY"}), taskDueDatesRefused)
	taskDueDatesRun(t, "8 start malformed", create(weekly("tomorrow morning", "FREQ=DAILY")), taskDueDatesRefused)
	taskDueDatesRun(t, "9 start with offset", create(weekly("2099-01-05T08:00:00+05:30", "FREQ=DAILY")), taskDueDatesAccepted)
	taskDueDatesRun(t, "10 leap day yearly", create(weekly("2099-01-01T08:00:00Z", "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29")), taskDueDatesNever500)
	taskDueDatesRun(t, "11 february 31st", create(weekly("2099-01-01T08:00:00Z", "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=31")), taskDueDatesRefused)
	taskDueDatesRun(t, "12 dates list 29 feb in a common year", create(map[string]any{"start": "2099-01-01T08:00:00Z", "end": "2100-01-01T08:00:00Z", "zone": "Europe/Budapest", "dates": []string{"2099-02-29"}}), taskDueDatesRefused)
	taskDueDatesRun(t, "13 interval huge", create(weekly("2099-01-05T08:00:00Z", "FREQ=DAILY;INTERVAL=999999999999999999")), taskDueDatesNever500)
	taskDueDatesRun(t, "14 start year 10000", create(weekly("10000-01-01T00:00:00Z", "FREQ=DAILY")), taskDueDatesRefused)
	taskDueDatesRun(t, "listed", w.get(t, "/taskmanager/repeating-tasks"), taskDueDatesNever500)
}

func TestTaskDueDatesRound4TaskDueDates(t *testing.T) {
	w := newTaskDueDatesWorld(t)
	tm := "/taskmanager"
	create := func(due any) *httptest.ResponseRecorder {
		return w.post(t, tm+"/tasks", map[string]any{"title": "Due task", "due_at": due})
	}
	taskDueDatesRun(t, "1 due 2099", create("2099-01-01T00:00:00Z"), taskDueDatesAccepted)
	taskDueDatesRun(t, "2 due in the past", create("2020-01-01T00:00:00Z"), taskDueDatesAccepted)
	taskDueDatesRun(t, "3 due year 0001", create("0001-01-01T00:00:00Z"), taskDueDatesNever500)
	taskDueDatesRun(t, "4 due year 9999", create("9999-12-31T23:59:59Z"), taskDueDatesNever500)
	taskDueDatesRun(t, "5 due year 10000", create("10000-01-01T00:00:00Z"), taskDueDatesRefused)
	taskDueDatesRun(t, "6 due malformed", create("next friday"), taskDueDatesRefused)
	taskDueDatesRun(t, "7 due date only", create("2099-01-01"), taskDueDatesRefused)
	taskDueDatesRun(t, "8 due with offset", create("2099-01-01T12:00:00+05:30"), taskDueDatesAccepted)
	taskDueDatesRun(t, "9 due a number", create(4102444800), taskDueDatesNever500)
	taskDueDatesRun(t, "10 due whitespace", create("   "), taskDueDatesRefused)
	taskDueDatesRun(t, "overdue now", w.get(t, tm+"/overdue-tasks"), taskDueDatesAccepted)
	taskDueDatesRun(t, "overdue as_of malformed", w.get(t, tm+"/overdue-tasks?as_of=yesterday"), taskDueDatesRefused)
	taskDueDatesRun(t, "overdue as_of year 9999", w.get(t, tm+"/overdue-tasks?as_of=9999-12-31T00:00:00Z"), taskDueDatesNever500)
	taskDueDatesRun(t, "overdue as_of year 0001", w.get(t, tm+"/overdue-tasks?as_of=0001-01-01T00:00:00Z"), taskDueDatesNever500)
}

func TestTaskDueDatesRound5OtherDueDoors(t *testing.T) {
	w := newTaskDueDatesWorld(t)
	tm := "/taskmanager"
	made := w.post(t, tm+"/tasks", map[string]any{"title": "Base task"})
	id, _ := decodeObject(t, made)["id"].(string)
	patch := func(due any) *httptest.ResponseRecorder {
		return w.walk.call(t, "PATCH", w.base+tm+"/tasks/"+id, map[string]any{"due_at": due}, w.walk.owner)
	}
	put := func(due any) *httptest.ResponseRecorder {
		return w.walk.call(t, "PUT", w.base+tm+"/tasks/"+id, map[string]any{"title": "Base task", "status": "pending", "due_at": due}, w.walk.owner)
	}
	taskDueDatesRun(t, "1 patch due malformed", patch("soon"), taskDueDatesRefused)
	taskDueDatesRun(t, "2 put due malformed", put("soon"), taskDueDatesRefused)
	taskDueDatesRun(t, "3 patch due cleared", patch(""), taskDueDatesAccepted)
	taskDueDatesRun(t, "4 patch due valid", patch("2099-06-01T10:00:00Z"), taskDueDatesAccepted)
	generate := func(due string, run string) *httptest.ResponseRecorder {
		return w.post(t, tm+"/generated-tasks", map[string]any{"run": run, "template": map[string]any{"title": "Generated", "due_at": due}, "subjects": []string{"s1", "s2"}})
	}
	taskDueDatesRun(t, "5 generated due malformed", generate("soon", "r1"), taskDueDatesRefused)
	taskDueDatesRun(t, "6 generated due with offset", generate("2099-01-01T12:00:00+05:30", "r2"), taskDueDatesAccepted)
	taskDueDatesRun(t, "7 generated due year 0001", generate("0001-01-01T00:00:00Z", "r3"), taskDueDatesNever500)
	sourced := func(due string, source string) *httptest.ResponseRecorder {
		return w.post(t, tm+"/sourced-tasks", map[string]any{"source": source, "items": []map[string]any{{"title": "Sourced", "due_at": due}}})
	}
	taskDueDatesRun(t, "8 sourced due malformed", sourced("2099-01-01", "src1"), taskDueDatesRefused)
	taskDueDatesRun(t, "9 sourced due year 9999", sourced("9999-12-31T23:59:59Z", "src2"), taskDueDatesNever500)
	taskDueDatesRun(t, "10 sourced due empty", sourced("", "src3"), taskDueDatesNever500)
	taskDueDatesRun(t, "11 read back after patch", w.get(t, tm+"/tasks/"+id), taskDueDatesAccepted)
}

func (w *taskDueDatesWorld) repeating(t *testing.T, schedule map[string]any) (mwanachamataskmanager.RepeatingTask, *httptest.ResponseRecorder) {
	t.Helper()
	rec := w.post(t, "/taskmanager/repeating-tasks", map[string]any{
		"title":         "Engine probe",
		"assignee_kind": "actor",
		"assignee_id":   "test-owner",
		"schedule":      schedule,
	})
	if rec.Code != http.StatusCreated {
		return mwanachamataskmanager.RepeatingTask{}, rec
	}
	var stored mwanachamataskmanager.RepeatingTaskRecord
	if err := json.Unmarshal(rec.Body.Bytes(), &stored); err != nil {
		t.Fatalf("decode stored repeating task: %v", err)
	}
	read, err := mwanachamataskmanager.RepeatingTaskFromRecord(stored)
	if err != nil {
		t.Fatalf("stored repeating task does not read back: %v", err)
	}
	return read, rec
}

func taskDueDatesEngine(t *testing.T, label string, within time.Duration, run func()) {
	t.Helper()
	started := time.Now()
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("%s: panicked: %v", label, r)
			}
		}()
		run()
	}()
	took := time.Since(started)
	t.Logf("PROBE %s -> took %s", label, took)
	if took > within {
		t.Errorf("%s: took %s, over %s", label, took, within)
	}
}

func TestTaskDueDatesRound6RepeatingEngineOnStoredTasks(t *testing.T) {
	w := newTaskDueDatesWorld(t)
	daily := func(start, rule string) map[string]any {
		return map[string]any{"start": start, "zone": "Europe/Budapest", "rule": rule}
	}

	huge, _ := w.repeating(t, daily("2099-01-05T08:00:00Z", "FREQ=DAILY;INTERVAL=999999999999999999"))
	taskDueDatesEngine(t, "1 huge interval, next after the start", time.Second, func() {
		after := huge.Schedule.Start.Add(time.Hour)
		next, ok := huge.Schedule.Next(after)
		t.Logf("next=%s ok=%v", next, ok)
		if ok && (!next.After(after) || next.Year() > 9999) {
			t.Errorf("next %s is not a time after %s inside year 9999", next, after)
		}
	})
	taskDueDatesEngine(t, "2 huge interval, period in year 2100", time.Second, func() {
		at := time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC)
		start, end, ok := huge.Schedule.Period(at)
		t.Logf("start=%s end=%s ok=%v", start, end, ok)
		if ok && !end.IsZero() && (!end.After(start) || end.Year() > 9999) {
			t.Errorf("period ends %s, not after its start %s inside year 9999", end, start)
		}
	})

	ancient, rec := w.repeating(t, daily("0002-01-01T08:00:00Z", "FREQ=DAILY"))
	taskDueDatesRun(t, "3 daily since year 2", rec, taskDueDatesNever500)
	if rec.Code == http.StatusCreated {
		taskDueDatesEngine(t, "3 daily since year 2, period today", 100*time.Millisecond, func() {
			ancient.Schedule.Period(time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC))
		})
	}

	last, _ := w.repeating(t, daily("9999-12-31T00:00:00Z", "FREQ=DAILY"))
	taskDueDatesEngine(t, "4 daily from 9999-12-31, next", time.Second, func() {
		next, ok := last.Schedule.Next(last.Schedule.Start)
		t.Logf("next=%s ok=%v", next, ok)
		if ok && next.Year() > 9999 {
			t.Errorf("next occurrence falls in year %d", next.Year())
		}
	})

	leap, _ := w.repeating(t, daily("2099-01-01T08:00:00Z", "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29"))
	taskDueDatesEngine(t, "5 leap day yearly, next after 2100-01-01", time.Second, func() {
		next, ok := leap.Schedule.Next(time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC))
		t.Logf("next=%s ok=%v", next, ok)
		if !ok || next.Month() != time.February || next.Day() != 29 {
			t.Errorf("next leap-day occurrence is %s ok=%v, want a 29 February", next, ok)
		}
	})

	zone := daily("2099-03-28T02:30:00+01:00", "FREQ=DAILY")
	gap, _ := w.repeating(t, zone)
	taskDueDatesEngine(t, "6 daily 02:30 across the spring clock change, next", time.Second, func() {
		after := time.Date(2099, 3, 28, 12, 0, 0, 0, time.UTC)
		for i := 0; i < 5; i++ {
			next, ok := gap.Schedule.Next(after)
			if !ok || !next.After(after) {
				t.Errorf("next after %s is %s ok=%v", after, next, ok)
				return
			}
			after = next
		}
	})

	taskDueDatesRun(t, "7 end equal to start", func() *httptest.ResponseRecorder {
		_, rec := w.repeating(t, map[string]any{"start": "2099-01-05T08:00:00Z", "end": "2099-01-05T08:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=DAILY"})
		return rec
	}(), taskDueDatesNever500)
	taskDueDatesRun(t, "8 dates without an end", func() *httptest.ResponseRecorder {
		_, rec := w.repeating(t, map[string]any{"start": "2099-01-05T08:00:00Z", "zone": "Europe/Budapest", "dates": []string{"2099-02-01"}})
		return rec
	}(), taskDueDatesRefused)
	taskDueDatesRun(t, "9 rule and dates together", func() *httptest.ResponseRecorder {
		_, rec := w.repeating(t, map[string]any{"start": "2099-01-05T08:00:00Z", "end": "2100-01-05T08:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=DAILY", "dates": []string{"2099-02-01"}})
		return rec
	}(), taskDueDatesRefused)
	taskDueDatesRun(t, "10 neither rule nor dates", func() *httptest.ResponseRecorder {
		_, rec := w.repeating(t, map[string]any{"start": "2099-01-05T08:00:00Z", "zone": "Europe/Budapest"})
		return rec
	}(), taskDueDatesRefused)
}
