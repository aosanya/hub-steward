package models

import "testing"

func TestPermissionCatalog_CaseVoteCanSeeAndRankTheCasesItVotesOn(t *testing.T) {
	requirePermissionCarries(t, "case.vote",
		"taskmanager.case.vote", "taskmanager.case.take_back_vote", "taskmanager.case.list_votes",
		"taskmanager.case.read", "taskmanager.case.list", "taskmanager.case.list_by_votes",
		"taskmanager.case.list_mine", "taskmanager.case.list_tasks")
}
