package http

import (
	"net/http"
	"testing"
)

var ruleReadActions = []string{
	"taskmanager.rule.read",
	"taskmanager.rule.list",
	"taskmanager.rule.issue_list",
	"taskmanager.rule.list_for_issue",
	"taskmanager.rule.file_list",
	"taskmanager.rule.produced_list",
	"taskmanager.rule.overlap_list",
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
