package approvals

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func proposed(t *testing.T, st *Store, proposer, payload string) Approval {
	t.Helper()
	a, err := st.Propose(context.Background(), proposer, "instance_rename", "rename it", payload)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestProposeNeedsAKindAndASummary(t *testing.T) {
	st := openMisuseStore(t)
	for _, c := range [][2]string{{"", "s"}, {"k", ""}} {
		if _, err := st.Propose(context.Background(), "p", c[0], c[1], "{}"); !errors.Is(err, ErrInvalid) {
			t.Errorf("kind %q summary %q: err = %v", c[0], c[1], err)
		}
	}
}

func TestProposedApprovalWaitsAndIsListedNewestFirstByStatus(t *testing.T) {
	st := openMisuseStore(t)
	first := proposed(t, st, "p1", `{"a":1}`)
	second := proposed(t, st, "p2", `{"a":2}`)
	if first.Status != StatusPending || first.ProposedBy != "p1" || first.ProposedAt == "" {
		t.Fatalf("first = %+v", first)
	}
	if _, err := st.Decide(context.Background(), first.ID, "owner", StatusRefused, "no", ""); err != nil {
		t.Fatal(err)
	}
	all, err := st.List(context.Background(), "")
	if err != nil || len(all) != 2 || all[0].ID != second.ID {
		t.Errorf("all = %+v err %v", all, err)
	}
	pending, _ := st.List(context.Background(), StatusPending)
	refused, _ := st.List(context.Background(), StatusRefused)
	if len(pending) != 1 || pending[0].ID != second.ID || len(refused) != 1 || refused[0].ID != first.ID {
		t.Errorf("pending %+v refused %+v", pending, refused)
	}
	none, err := st.List(context.Background(), StatusApproved)
	if err != nil || none == nil || len(none) != 0 {
		t.Errorf("approved = %#v err %v, want an empty list that is not nil", none, err)
	}
}

func TestGetOfAnUnknownApprovalIsNotFound(t *testing.T) {
	if _, err := openMisuseStore(t).Get(context.Background(), "nope"); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v", err)
	}
}

func TestDecideRefusesADecisionThatIsNeitherApprovedNorRefused(t *testing.T) {
	st := openMisuseStore(t)
	a := proposed(t, st, "p", `{}`)
	if _, err := st.Decide(context.Background(), a.ID, "o", "maybe", "", ""); !errors.Is(err, ErrBadDecision) {
		t.Errorf("err = %v", err)
	}
}

func TestDecideRecordsWhoDecidedAndWhy(t *testing.T) {
	st := openMisuseStore(t)
	a := proposed(t, st, "p", `{}`)
	got, err := st.Decide(context.Background(), a.ID, "owner", StatusRefused, "not now", "")
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != StatusRefused || got.DecidedBy != "owner" || got.Reason != "not now" || got.DecidedAt == "" {
		t.Errorf("got %+v", got)
	}
}

func TestDecideOfAnUnknownApprovalIsNotFound(t *testing.T) {
	if _, err := openMisuseStore(t).Decide(context.Background(), "nope", "o", StatusApproved, "", ""); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v", err)
	}
}

func TestApprovingWithAPatchMergesItIntoThePayloadAndKeepsTheOriginal(t *testing.T) {
	st := openMisuseStore(t)
	a := proposed(t, st, "p", `{"name":"Old","keep":true,"nested":{"x":1,"y":2},"drop":"me"}`)
	got, err := st.Decide(context.Background(), a.ID, "owner", StatusApproved, "ok", `{"name":"New","nested":{"y":null,"z":3},"drop":null}`)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(got.Payload), &payload); err != nil {
		t.Fatal(err)
	}
	nested := payload["nested"].(map[string]any)
	if payload["name"] != "New" || payload["keep"] != true || nested["x"] != float64(1) || nested["z"] != float64(3) {
		t.Errorf("payload = %v", payload)
	}
	if _, has := nested["y"]; has {
		t.Errorf("a null in the patch must delete the key: %v", nested)
	}
	if _, has := payload["drop"]; has {
		t.Errorf("drop survived: %v", payload)
	}
	if got.PayloadPatch == "" || got.ProposedPayload != `{"name":"Old","keep":true,"nested":{"x":1,"y":2},"drop":"me"}` {
		t.Errorf("patch %q proposed %q", got.PayloadPatch, got.ProposedPayload)
	}
}

func TestAPatchIsRefusedUnlessApprovingAnObjectOntoAnObjectStillPending(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{"a":1}`)
	if _, err := st.Decide(ctx, a.ID, "o", StatusRefused, "", `{"a":2}`); !errors.Is(err, ErrPatchNeedsApproval) {
		t.Errorf("refusing with a patch: %v", err)
	}
	for _, bad := range []string{`[1]`, `"text"`, `{"a":1} {"b":2}`, `{`} {
		if _, err := st.Decide(ctx, a.ID, "o", StatusApproved, "", bad); !errors.Is(err, ErrBadPatch) {
			t.Errorf("patch %s: %v", bad, err)
		}
	}
	if _, err := st.Decide(ctx, "nope", "o", StatusApproved, "", `{"a":2}`); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown approval: %v", err)
	}
	listPayload := proposed(t, st, "p", `[1,2]`)
	if _, err := st.Decide(ctx, listPayload.ID, "o", StatusApproved, "", `{"a":2}`); !errors.Is(err, ErrPayloadNotObject) {
		t.Errorf("array payload: %v", err)
	}
	if _, err := st.Decide(ctx, a.ID, "o", StatusApproved, "", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Decide(ctx, a.ID, "o", StatusApproved, "", `{"a":2}`); !errors.Is(err, ErrAlreadyDecided) {
		t.Errorf("decided approval: %v", err)
	}
}

func TestDecideRetriesWhenTheProposalIsAmendedMidDecision(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{"a":1}`)
	amended := false
	st.afterRead = func() {
		if amended {
			return
		}
		amended = true
		if _, err := st.Amend(ctx, a.ID, "p", false, "", `{"b":2}`); err != nil {
			t.Error(err)
		}
	}
	got, err := st.Decide(ctx, a.ID, "owner", StatusApproved, "", `{"c":3}`)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	_ = json.Unmarshal([]byte(got.Payload), &payload)
	if payload["a"] != float64(1) || payload["b"] != float64(2) || payload["c"] != float64(3) {
		t.Errorf("the decision lost the amendment or the patch: %v", payload)
	}
}

func TestAmendNeedsSomethingToChangeAndAValidPatch(t *testing.T) {
	st := openMisuseStore(t)
	a := proposed(t, st, "p", `{"a":1}`)
	if _, err := st.Amend(context.Background(), a.ID, "p", false, "", ""); !errors.Is(err, ErrNothingToAmend) {
		t.Errorf("nothing: %v", err)
	}
	if _, err := st.Amend(context.Background(), a.ID, "p", false, "", `[1]`); !errors.Is(err, ErrBadPatch) {
		t.Errorf("bad patch: %v", err)
	}
	if _, err := st.Amend(context.Background(), "nope", "p", false, "s", ""); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown: %v", err)
	}
}

func TestOnlyTheProposerOrAnOwnerMayAmend(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{"a":1}`)
	if _, err := st.Amend(ctx, a.ID, "stranger", false, "mine now", ""); !errors.Is(err, ErrNotProposer) {
		t.Errorf("stranger: %v", err)
	}
	if _, err := st.Amend(ctx, a.ID, "", false, "mine now", ""); !errors.Is(err, ErrNotProposer) {
		t.Errorf("nobody: %v", err)
	}
	got, err := st.Amend(ctx, a.ID, "owner", true, "owner's words", "")
	if err != nil || got.Summary != "owner's words" || got.AmendedBy != "owner" {
		t.Errorf("owner amend = %+v err %v", got, err)
	}
}

func TestAmendKeepsAHistoryOfEveryChangeAndPatchesThePayload(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{"a":1}`)
	if _, err := st.Amend(ctx, a.ID, "p", false, "better summary", ""); err != nil {
		t.Fatal(err)
	}
	got, err := st.Amend(ctx, a.ID, "p", false, "", `{"a":2}`)
	if err != nil {
		t.Fatal(err)
	}
	if got.Summary != "better summary" || !strings.Contains(got.Payload, `"a":2`) {
		t.Errorf("got %+v", got)
	}
	history, err := amendmentsIn(got.Amendments)
	if err != nil || len(history) != 2 || history[0].Summary != "better summary" || history[1].Patch != `{"a":2}` || history[1].By != "p" {
		t.Errorf("history = %+v err %v", history, err)
	}
}

func TestAmendIsRefusedOnceDecidedAndOnANonObjectPayload(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{"a":1}`)
	list := proposed(t, st, "p", `[1]`)
	if _, err := st.Amend(ctx, list.ID, "p", false, "", `{"a":1}`); !errors.Is(err, ErrPayloadNotObject) {
		t.Errorf("array payload: %v", err)
	}
	if _, err := st.Decide(ctx, a.ID, "o", StatusApproved, "", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Amend(ctx, a.ID, "p", false, "late", ""); !errors.Is(err, ErrAlreadyDecided) {
		t.Errorf("decided: %v", err)
	}
}

func TestAmendmentsInRefusesAHistoryThatIsNotJSON(t *testing.T) {
	if _, err := amendmentsIn("{oops"); err == nil {
		t.Error("a broken history must not be silently dropped")
	}
	if history, err := amendmentsIn(""); err != nil || history == nil || len(history) != 0 {
		t.Errorf("empty = %#v %v", history, err)
	}
}

func TestReopenPutsAnApprovedApprovalBackToPending(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{"a":1}`)
	decided, err := st.Decide(ctx, a.ID, "owner", StatusApproved, "ok", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := st.Reopen(ctx, decided); err != nil {
		t.Fatal(err)
	}
	got, _ := st.Get(ctx, a.ID)
	if got.Status != StatusPending || got.DecidedBy != "" || got.Reason != "" || got.DecidedAt != "" {
		t.Errorf("got %+v", got)
	}
}

func TestReopenOfAPatchedApprovalRestoresTheProposedPayloadAndNotesWhy(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{"a":1}`)
	decided, err := st.Decide(ctx, a.ID, "owner", StatusApproved, "", `{"a":2}`)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.Reopen(ctx, decided); err != nil {
		t.Fatal(err)
	}
	got, _ := st.Get(ctx, a.ID)
	if got.Payload != `{"a":1}` || got.PayloadPatch != "" || got.Status != StatusPending {
		t.Errorf("got %+v", got)
	}
	history, _ := amendmentsIn(got.Amendments)
	if len(history) != 1 || history[0].Summary != refusedPatchSummary || history[0].By != "owner" || history[0].Patch != `{"a":2}` {
		t.Errorf("history = %+v", history)
	}
}

func TestReopenOfAPatchedApprovalWithoutTheProposedPayloadIsRefused(t *testing.T) {
	st := openMisuseStore(t)
	err := st.Reopen(context.Background(), Approval{ID: "x", PayloadPatch: `{"a":2}`})
	if !errors.Is(err, ErrCannotRestore) {
		t.Errorf("err = %v", err)
	}
	err = st.Reopen(context.Background(), Approval{ID: "nope", PayloadPatch: `{"a":2}`, ProposedPayload: `{}`})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown = %v", err)
	}
}

func TestReopenDoesNotTouchAnApprovalThatWasRefused(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{}`)
	refused, _ := st.Decide(ctx, a.ID, "owner", StatusRefused, "no", "")
	if err := st.Reopen(ctx, refused); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.Get(ctx, a.ID); got.Status != StatusRefused {
		t.Errorf("status = %q, only an approved approval can be reopened", got.Status)
	}
}

func TestRecordAppliedStampsEachStepOnAnApprovedApprovalOnly(t *testing.T) {
	st := openMisuseStore(t)
	ctx := context.Background()
	a := proposed(t, st, "p", `{}`)
	if _, err := st.RecordApplied(ctx, a.ID, "owner", []string{"one"}); !errors.Is(err, ErrNotFound) {
		t.Errorf("pending approval: %v", err)
	}
	if _, err := st.Decide(ctx, a.ID, "owner", StatusApproved, "", ""); err != nil {
		t.Fatal(err)
	}
	got, err := st.RecordApplied(ctx, a.ID, "owner", []string{"one", "two"})
	if err != nil {
		t.Fatal(err)
	}
	var steps []appliedStep
	if err := json.Unmarshal([]byte(got.Applied), &steps); err != nil || len(steps) != 2 || steps[1].Step != "two" || steps[0].By != "owner" || steps[0].At == "" {
		t.Errorf("applied = %q err %v", got.Applied, err)
	}
}

func TestTableForNamesTheInstanceTable(t *testing.T) {
	if got := TableFor("farm"); got != "farm_approvals" {
		t.Errorf("got %q", got)
	}
}
