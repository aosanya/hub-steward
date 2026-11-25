package http

import (
	"encoding/json"
	"net/http"
	"reflect"
	"slices"
	"strings"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"
)

var ruleReadActions = []string{
	"taskmanager.rule.read",
	"taskmanager.rule.list",
	"taskmanager.rule.issue_list",
	"taskmanager.rule.list_for_issue",
	"taskmanager.rule.file_list",
	"taskmanager.rule.produced_list",
	"taskmanager.rule.note_add",
	"taskmanager.rule.note_list",
	"taskmanager.rule.note_list_of",
	"taskmanager.backlog.rules_list",
	"taskmanager.backlog.decisions_list",
	"taskmanager.backlog.questions_list",
}

var ruleWriteActions = []string{
	"taskmanager.rule.create",
	"taskmanager.rule.update",
	"taskmanager.rule.set_status",
	"taskmanager.rule.supersede",
	"taskmanager.rule.answer",
	"taskmanager.rule.link",
	"taskmanager.rule.unlink",
	"taskmanager.rule.file_add",
	"taskmanager.rule.file_remove",
	"taskmanager.rule.note_resolve",
	"taskmanager.backlog_tag.add",
}

func TestBacklogAccess_ACanSeeGroupsToolsReachEveryRuleAction(t *testing.T) {
	w := newGroupRoleWalk(t)
	amina, _ := w.resident(t, "Amina", "Support")
	w.backlogWith(t, "see", "Support")
	for _, action := range append(append([]string{}, ruleReadActions...), ruleWriteActions...) {
		if err := w.toolRefusal(t, amina, action); err != nil {
			t.Errorf("a Can see group calling %s is refused before the module weighs its level: %v", action, err)
		}
	}
}

func TestBacklogAccess_ACanMoveGroupsToolsWriteRules(t *testing.T) {
	w := newGroupRoleWalk(t)
	mia, _ := w.resident(t, "Mia", "Support")
	w.backlogWith(t, "move", "Support")
	for _, action := range append(append([]string{}, ruleReadActions...), ruleWriteActions...) {
		if err := w.toolRefusal(t, mia, action); err != nil {
			t.Errorf("a Can move group calling %s is refused: %v", action, err)
		}
	}
}

func TestBacklogAccess_ACanSeeGroupReadsRulesOverTheRoutesAndCannotWriteThem(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	w.backlogWith(t, "see", "Support")
	if code := w.call(t, "GET", w.tm("/rules"), nil, amina).Code; code != http.StatusOK {
		t.Errorf("a Can see group lists rules: %d, want 200", code)
	}
	if code := w.call(t, "POST", w.tm("/rules"), map[string]any{"kind": "rule", "title": "T"}, amina).Code; code != http.StatusForbidden {
		t.Errorf("a Can see group writes a rule: %d, want 403", code)
	}
}

func TestBacklogAccess_ACanMoveGroupWritesARuleOverTheRoutes(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, mia := w.resident(t, "Mia", "Support")
	w.backlogWith(t, "move", "Support")
	if code := w.call(t, "POST", w.tm("/rules"), map[string]any{"kind": "rule", "title": "T"}, mia).Code; code != http.StatusCreated {
		t.Errorf("a Can move group writes a rule: %d, want 201", code)
	}
}

const retiredRuleAction = "taskmanager.rule.overlap_list"

func ruleActionsOf(list []string, extra ...string) []string {
	var picked []string
	for _, action := range list {
		if strings.HasPrefix(action, "taskmanager.rule.") || slices.Contains(extra, action) {
			picked = append(picked, action)
		}
	}
	slices.Sort(picked)
	return picked
}

func TestBacklogAccess_TheRuleActionsOfTheLevelListsAreTheTestSets(t *testing.T) {
	readExtras := []string{"taskmanager.backlog.rules_list", "taskmanager.backlog.decisions_list", "taskmanager.backlog.questions_list"}
	if got, want := ruleActionsOf(backlogReadActions, readExtras...), sortedCopy(ruleReadActions); !slices.Equal(got, want) {
		t.Errorf("rule actions of backlogReadActions\n got  %v\n want %v", got, want)
	}
	if got, want := ruleActionsOf(backlogWriteActions, "taskmanager.backlog_tag.add"), sortedCopy(ruleWriteActions); !slices.Equal(got, want) {
		t.Errorf("rule actions of backlogWriteActions\n got  %v\n want %v", got, want)
	}
}

func TestBacklogAccess_TheRetiredOverlapListActionIsInNeitherLevelList(t *testing.T) {
	if backlogAccessActions[retiredRuleAction] {
		t.Errorf("%s is still admitted by the backlog access lists", retiredRuleAction)
	}
}

func catalogActions(t *testing.T, code string) []string {
	t.Helper()
	for _, p := range agencymodels.PermissionCatalog() {
		if p.Code == code {
			return sortedCopy(p.Actions)
		}
	}
	t.Fatalf("the permission catalogue has no %s", code)
	return nil
}

func skipUntilTheCatalogueCarriesNotes(t *testing.T) {
	t.Helper()
	if !slices.Contains(catalogActions(t, "rule.read"), "taskmanager.rule.note_add") {
		t.Skip("the pinned mwanachama-backend-agency catalogue has no taskmanager.rule.note_add yet; pin the agency version that adds it (documentation/2. design/notes-roster-patch.md)")
	}
}

func TestBacklogAccess_TheTestSetsAreTheCatalogueRuleRead(t *testing.T) {
	skipUntilTheCatalogueCarriesNotes(t)
	if got, want := sortedCopy(ruleReadActions), catalogActions(t, "rule.read"); !slices.Equal(got, want) {
		t.Errorf("rule.read\n got  %v\n want %v", got, want)
	}
}

func TestBacklogAccess_TheTestSetsAreTheCatalogueRuleEdit(t *testing.T) {
	skipUntilTheCatalogueCarriesNotes(t)
	if got, want := sortedCopy(ruleWriteActions), catalogActions(t, "rule.edit"); !slices.Equal(got, want) {
		t.Errorf("rule.edit\n got  %v\n want %v", got, want)
	}
}

func skipUntilTheNotesVersionIsPinned(t *testing.T) {
	t.Helper()
	managerType := reflect.TypeOf((*mwanachamataskmanager.TaskManager)(nil)).Elem()
	if _, found := managerType.MethodByName("AddRuleNote"); !found {
		t.Skip("the pinned mwanachama-backend-taskmanager has no rule notes yet; pin the tag that adds AddRuleNote and ResolveRuleNote in go.mod")
	}
}

func (w groupRoleWalk) ruleCodeCreatedBy(t *testing.T, as *http.Cookie) string {
	t.Helper()
	rec := w.call(t, "POST", w.tm("/rules"), map[string]any{"kind": "rule", "title": "T"}, as)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create a rule: %d %s", rec.Code, rec.Body.String())
	}
	var rule struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &rule); err != nil || rule.Code == "" {
		t.Fatalf("decode rule %q: %v", rec.Body.String(), err)
	}
	return rule.Code
}

func (w groupRoleWalk) contradictionOn(t *testing.T, code string, as *http.Cookie) string {
	t.Helper()
	body := map[string]any{"kind": "contradiction", "text": "this and another rule cannot both hold"}
	rec := w.call(t, "POST", w.tm("/rules/"+code+"/notes"), body, as)
	if rec.Code != http.StatusCreated {
		t.Fatalf("add a contradiction note: %d %s", rec.Code, rec.Body.String())
	}
	var note struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &note); err != nil || note.ID == "" {
		t.Fatalf("decode note %q: %v", rec.Body.String(), err)
	}
	return note.ID
}

func TestBacklogAccess_ACanSeeGroupAddsANoteToARuleAndCannotResolveOne(t *testing.T) {
	skipUntilTheNotesVersionIsPinned(t)
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	_, mia := w.resident(t, "Mia", "Dev")
	w.backlogWith(t, "see", "Support")
	w.giveAccess(t, "backlog", w.group(t, "Dev"), "move")
	code := w.ruleCodeCreatedBy(t, mia)

	body := map[string]any{"text": "seen on the support desk"}
	if got := w.call(t, "POST", w.tm("/rules/"+code+"/notes"), body, amina).Code; got != http.StatusCreated {
		t.Errorf("a Can see group adds a note: %d, want 201", got)
	}
	if got := w.call(t, "GET", w.tm("/rules/notes"), nil, amina).Code; got != http.StatusOK {
		t.Errorf("a Can see group lists notes: %d, want 200", got)
	}
	if got := w.call(t, "GET", w.tm("/rules/"+code+"/notes"), nil, amina).Code; got != http.StatusOK {
		t.Errorf("a Can see group lists the notes of one rule: %d, want 200", got)
	}
	noteID := w.contradictionOn(t, code, mia)
	if got := w.call(t, "PUT", w.tm("/rules/notes/"+noteID+"/resolve"), map[string]any{}, amina).Code; got != http.StatusForbidden {
		t.Errorf("a Can see group resolves a contradiction: %d, want 403", got)
	}
}

func TestBacklogAccess_ACanMoveGroupResolvesAContradictionNote(t *testing.T) {
	skipUntilTheNotesVersionIsPinned(t)
	w := newGroupRoleWalk(t)
	_, mia := w.resident(t, "Mia", "Support")
	w.backlogWith(t, "move", "Support")
	noteID := w.contradictionOn(t, w.ruleCodeCreatedBy(t, mia), mia)
	if got := w.call(t, "PUT", w.tm("/rules/notes/"+noteID+"/resolve"), map[string]any{"resolution": "settled"}, mia).Code; got != http.StatusOK {
		t.Errorf("a Can move group resolves a contradiction: %d, want 200", got)
	}
}
