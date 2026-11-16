package routes

import (
	"strings"

	"wakalaserver/modules/shared/dispatch"

	accounting "wakalaserver/modules/accounting"
)

type Tool = dispatch.Tool

const budgetActionPrefix = "accounting.budget."

const reportActionPrefix = "accounting.report."

const billActionPrefix = "accounting.bill."

const paymentActionPrefix = "accounting.payment."

const accountListAction = "accounting.account.list"

func BuildTools(repo accounting.LedgerRepository, m Mount) ([]Tool, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	all, err := dispatch.Tools(s, dispatch.Deps{
		Manager: repo, Errors: sentinels, Authorize: m.Authorize, Caller: m.Caller,
	})
	if err != nil {
		return nil, err
	}
	var served []Tool
	for _, t := range all {
		if strings.HasPrefix(t.Action, budgetActionPrefix) && t.Action != "accounting.budget.variance" {
			served = append(served, t)
		}
		if strings.HasPrefix(t.Action, billActionPrefix) {
			served = append(served, t)
		}
		if t.Action == accountListAction {
			served = append(served, t)
		}
		if strings.HasPrefix(t.Action, paymentActionPrefix) {
			served = append(served, t)
		}
		if strings.HasPrefix(t.Action, reportActionPrefix) {
			served = append(served, t)
		}
		if isProcurementAction(t.Action) {
			served = append(served, t)
		}
	}
	return served, nil
}
