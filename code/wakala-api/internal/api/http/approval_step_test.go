package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

const (
	approvedByPrompt    = "Approved by"
	approvedAtPrompt    = "Approved at"
	mayorApprovalPrompt = "The mayor reviews the draft and approves it in their own name; the time and person of the approval are recorded."
)

func decisionQuestions() []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{{Prompt: "Decision", AnswerType: agencymodels.AnswerYesNo, Required: true}}
}

func noticePlan() []stepSpec {
	return []stepSpec{
		{title: "Approve the notice", prompt: mayorApprovalPrompt, form: "Approval", role: "Mayor", questions: decisionQuestions()},
		{title: "File the notice", prompt: "File the approved notice in the register.", form: "Filing", role: "Clerk", questions: []agencymodels.StepQuestion{
			{Prompt: "Shelf", AnswerType: agencymodels.AnswerFreeText},
		}},
	}
}

func noticeWalk(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, noticePlan(), "Mayor", "Clerk")
}

func (w stepRunWalk) seatNamed(t *testing.T, role, displayName string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	groups, err := um.ListGroups(ctx, "")
	if err != nil || len(groups) == 0 {
		t.Fatalf("ListGroups = %v, %v", groups, err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: displayName})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	return w.grantRoleTo(t, mgr, um, groups[0].ID, role, actor.ID)
}

func (w stepRunWalk) grantRoleTo(t *testing.T, mgr mwanachamaagency.AgencyManager, um mwanachamaactor.UserManager, groupID, role, actorID string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	published, err := mgr.GetRole(ctx, w.roles[role])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole %s: %v", role, err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: actorID, GroupID: groupID, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
	return w.cookieFor(t, actorID)
}

func answersOfSent(t *testing.T, item map[string]any) map[string]any {
	t.Helper()
	answers, _ := item["answers"].(map[string]any)
	return answers
}

func earlierAnswerNamed(t *testing.T, earlier []map[string]any, prompt string) (string, bool) {
	t.Helper()
	for _, step := range earlier {
		raw, _ := step["answers"].([]any)
		for _, entry := range raw {
			pair := entry.(map[string]any)
			if pair["prompt"] == prompt {
				text, _ := pair["answer"].(string)
				return text, true
			}
		}
	}
	return "", false
}

func requireRecentUTC(t *testing.T, stamp string) {
	t.Helper()
	at, err := time.Parse(time.RFC3339, stamp)
	if err != nil {
		t.Fatalf("the approval time %q is not RFC3339: %v", stamp, err)
	}
	if _, offset := at.Zone(); offset != 0 {
		t.Errorf("the approval time %q is not UTC", stamp)
	}
	if gap := time.Since(at); gap < -5*time.Second || gap > 10*time.Second {
		t.Errorf("the approval time %q is %v from now, want within a few seconds", stamp, gap)
	}
}

func TestAnApproveStepIsMarkedApprovalInTheOpenSteps(t *testing.T) {
	w := noticeWalk(t)
	start := w.available(t, w.people["Mayor"])[0]
	if start["approval"] != true {
		t.Errorf("the mayor's approve step = %v, want approval true", start)
	}
}

func TestAStepThatIsNotAnApproveStepOmitsTheApprovalField(t *testing.T) {
	w := noticeWalk(t)
	sent := w.submit(t, w.people["Mayor"], "Approve the notice", map[string]string{"Decision": "yes"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the mayor's submit: %d %s", sent.Code, sent.Body.String())
	}
	filing := w.available(t, w.people["Clerk"])[0]
	if _, has := filing["approval"]; has {
		t.Errorf("a filing step carries approval: %v", filing["approval"])
	}
}

func TestAnApproveStepIsRecognisedFromTitleDescriptionOrPrompt(t *testing.T) {
	cases := []struct {
		name string
		spec stepSpec
		want bool
	}{
		{"prompt", stepSpec{title: "Sign off", prompt: "Approve the budget in your own name."}, true},
		{"title", stepSpec{title: "Approve the budget in your own name"}, true},
		{"description", stepSpec{title: "Sign off", description: "Approved by name before it goes out."}, true},
		{"by name", stepSpec{title: "Sign off", prompt: "The mayor approves by name."}, true},
		{"approval before own name", stepSpec{title: "Sign off", prompt: "Give your approval in your own name."}, true},
		{"own name before approve", stepSpec{title: "Sign off", prompt: "Write your own name, then approve."}, false},
		{"across two sentences", stepSpec{title: "Sign off", prompt: "Approve the draft. Then sign in your own name."}, false},
		{"no approval word", stepSpec{title: "Sign off", prompt: "Read the draft in your own name."}, false},
		{"no name phrase", stepSpec{title: "Approve the budget", prompt: "Check the figures and approve."}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			spec := c.spec
			spec.form, spec.role, spec.questions = "Sign off", "Mayor", decisionQuestions()
			w := newStepRunWalk(t, []stepSpec{spec}, "Mayor")
			item := w.available(t, w.people["Mayor"])[0]
			got := item["approval"] == true
			if got != c.want {
				t.Errorf("approval = %v for %+v, want %v", item["approval"], c.spec, c.want)
			}
			if !c.want {
				if _, has := item["approval"]; has {
					t.Errorf("approval is present on a step that is not an approve step: %v", item["approval"])
				}
			}
		})
	}
}

func TestSendingAnApproveStepStoresWhoApprovedAndWhen(t *testing.T) {
	w := noticeWalk(t)
	sent := w.submit(t, w.people["Mayor"], "Approve the notice", map[string]string{"Decision": "yes"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the mayor's submit: %d %s", sent.Code, sent.Body.String())
	}
	got := w.sentSteps(t, w.people["Mayor"], "")
	if len(got) != 1 {
		t.Fatalf("the mayor sees %d sent steps, want 1: %v", len(got), got)
	}
	answers := answersOfSent(t, got[0])
	if answers["Decision"] != "yes" {
		t.Errorf("the mayor's own answer = %v", answers["Decision"])
	}
	if answers[approvedByPrompt] != "Mayor" {
		t.Errorf("%s = %v, want the mayor's display name", approvedByPrompt, answers[approvedByPrompt])
	}
	stamp, _ := answers[approvedAtPrompt].(string)
	requireRecentUTC(t, stamp)
	if len(answers) != 3 {
		t.Errorf("the stored answers = %v, want the answer plus the two approval entries", answers)
	}
}

func TestTheNextRoleSeesWhoApprovedAndWhenAmongTheEarlierAnswers(t *testing.T) {
	w := noticeWalk(t)
	sent := w.submit(t, w.people["Mayor"], "Approve the notice", map[string]string{"Decision": "yes"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the mayor's submit: %d %s", sent.Code, sent.Body.String())
	}
	filing := w.available(t, w.people["Clerk"])[0]
	earlier := earlierOf(t, filing)
	by, hasBy := earlierAnswerNamed(t, earlier, approvedByPrompt)
	if !hasBy || by != "Mayor" {
		t.Errorf("the earlier answers = %v, want %s = Mayor", filing["earlier"], approvedByPrompt)
	}
	at, hasAt := earlierAnswerNamed(t, earlier, approvedAtPrompt)
	if !hasAt {
		t.Fatalf("the earlier answers = %v, want %s", filing["earlier"], approvedAtPrompt)
	}
	requireRecentUTC(t, at)
}

func TestAnAnswerNamedApprovedByOrApprovedAtIsRefusedOnAnApproveStep(t *testing.T) {
	for _, prompt := range []string{approvedByPrompt, approvedAtPrompt} {
		t.Run(prompt, func(t *testing.T) {
			w := noticeWalk(t)
			forged := w.submit(t, w.people["Mayor"], "Approve the notice", map[string]string{"Decision": "yes", prompt: "The Governor"}, "")
			if forged.Code != http.StatusBadRequest {
				t.Errorf("a request carrying %s answers %d %s, want 400", prompt, forged.Code, forged.Body.String())
			}
			if got := w.sentSteps(t, w.people["Mayor"], ""); len(got) != 0 {
				t.Errorf("the refused request still saved %v", got)
			}
			if open := w.available(t, w.people["Mayor"]); len(open) != 1 {
				t.Errorf("after the refusal the mayor sees %v, want the approve step still open", open)
			}
		})
	}
}

func TestAnAnswerNamedApprovedByOrApprovedAtIsRefusedOnAnyOtherStep(t *testing.T) {
	for _, prompt := range []string{approvedByPrompt, approvedAtPrompt} {
		t.Run(prompt, func(t *testing.T) {
			w := noticeWalk(t)
			sent := w.submit(t, w.people["Mayor"], "Approve the notice", map[string]string{"Decision": "yes"}, "")
			if sent.Code != http.StatusCreated {
				t.Fatalf("the mayor's submit: %d %s", sent.Code, sent.Body.String())
			}
			order, _ := decodeObject(t, sent)["order_id"].(string)
			forged := w.submit(t, w.people["Clerk"], "File the notice", map[string]string{"Shelf": "A", prompt: "The Mayor"}, order)
			if forged.Code != http.StatusBadRequest {
				t.Errorf("a filing request carrying %s answers %d %s, want 400", prompt, forged.Code, forged.Body.String())
			}
			if got := w.sentSteps(t, w.people["Clerk"], ""); len(got) != 0 {
				t.Errorf("the refused request still saved %v", got)
			}
		})
	}
}

func TestAnApproveStepSentByAMemberWithNoDisplayNameIsRefused(t *testing.T) {
	w := newStepRunWalk(t, noticePlan(), "Clerk")
	nameless := w.seatNamed(t, "Mayor", "")
	sent := w.submit(t, nameless, "Approve the notice", map[string]string{"Decision": "yes"}, "")
	if sent.Code != http.StatusBadRequest {
		t.Errorf("an approval from a member with no display name answers %d %s, want 400", sent.Code, sent.Body.String())
	}
	if got := w.sentSteps(t, nameless, ""); len(got) != 0 {
		t.Errorf("the refused approval still saved %v", got)
	}
}

const (
	registerLimitsTitle  = "The mayor approves the register and the limits"
	registerLimitsPrompt = "The Mayor / council chair approves the register of declarations and the limits recorded for the roles."
)

func registerLimitsPlan(questions []agencymodels.StepQuestion) []stepSpec {
	return []stepSpec{
		{title: registerLimitsTitle, prompt: registerLimitsPrompt, form: "Register approval", role: "Mayor", questions: questions},
	}
}

func limitCheckedQuestions() []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{
		{Prompt: "Limit", AnswerType: agencymodels.AnswerCurrency, Required: true, ChecksApprovalLimit: true},
	}
}

func TestAStepWithAnApprovalLimitQuestionIsMarkedApprovalWhateverItsWording(t *testing.T) {
	w := newStepRunWalk(t, registerLimitsPlan(limitCheckedQuestions()), "Mayor")
	item := w.available(t, w.people["Mayor"])[0]
	if item["approval"] != true {
		t.Errorf("the register and limits step = %v, want approval true", item)
	}
}

func TestSendingAStepWithAnApprovalLimitQuestionStoresWhoApprovedAndWhen(t *testing.T) {
	w := newStepRunWalk(t, registerLimitsPlan(limitCheckedQuestions()), "Mayor")
	sent := w.submit(t, w.people["Mayor"], registerLimitsTitle, map[string]string{"Limit": "500000"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the mayor's submit: %d %s", sent.Code, sent.Body.String())
	}
	got := w.sentSteps(t, w.people["Mayor"], "")
	if len(got) != 1 {
		t.Fatalf("the mayor sees %d sent steps, want 1: %v", len(got), got)
	}
	answers := answersOfSent(t, got[0])
	if answers[approvedByPrompt] != "Mayor" {
		t.Errorf("%s = %v, want the mayor's display name", approvedByPrompt, answers[approvedByPrompt])
	}
	stamp, _ := answers[approvedAtPrompt].(string)
	requireRecentUTC(t, stamp)
}

func TestAStepWithTheSameWordingButNoApprovalLimitQuestionOmitsTheApprovalField(t *testing.T) {
	w := newStepRunWalk(t, registerLimitsPlan(decisionQuestions()), "Mayor")
	item := w.available(t, w.people["Mayor"])[0]
	if _, has := item["approval"]; has {
		t.Errorf("a step with no limit question carries approval: %v", item["approval"])
	}
}
