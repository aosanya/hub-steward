package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	takeBackVoteAction = "taskmanager.case.take_back_vote"
	takeBackVoteTool   = "taskmanager_case_take_back_vote"
	voteMemberArg      = "memberID"
	withdrawalRefusal  = "a vote can be taken back only by the member it counts for, or by the owner"
)

func mayWithdrawVoteOf(agencyRole, caller, member string) bool {
	return agencyRole == agencies.RoleOwner || (caller != "" && member == caller)
}

func admitVoteWithdrawal(w http.ResponseWriter, r *http.Request, agencyRole string) bool {
	if mayWithdrawVoteOf(agencyRole, accounts.IDFromContext(r.Context()), r.PathValue(voteMemberArg)) {
		return true
	}
	writeErr(w, http.StatusForbidden, withdrawalRefusal)
	return false
}

func refuseVoteWithdrawal(caller, agencyRole string, args map[string]json.RawMessage) *mcp.CallToolResult {
	var member string
	_ = json.Unmarshal(args[voteMemberArg], &member)
	if mayWithdrawVoteOf(agencyRole, caller, member) {
		return nil
	}
	return toolError(errors.New(withdrawalRefusal))
}
