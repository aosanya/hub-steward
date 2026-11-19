package routes

import (
	"strings"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"

	accounting "wakalaserver/modules/accounting"
)

type Tool = dispatch.Tool

const budgetActionPrefix = "accounting.budget."

const reportActionPrefix = "accounting.report."

const upwardReportActionPrefix = "accounting.upward_report."

const billActionPrefix = "accounting.bill."

const paymentActionPrefix = "accounting.payment."

const accountListAction = "accounting.account.list"

const dimensionTotalsAction = "accounting.dimension.totals"

const dimensionEntriesAction = "accounting.dimension.entries"

const milestoneListAction = "accounting.milestone.list"

const certificateListAction = "accounting.certificate.list"

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
		if t.Action == accountListAction || t.Action == dimensionTotalsAction || t.Action == dimensionEntriesAction ||
			t.Action == milestoneListAction || t.Action == certificateListAction {
			served = append(served, t)
		}
		if strings.HasPrefix(t.Action, paymentActionPrefix) {
			served = append(served, t)
		}
		if strings.HasPrefix(t.Action, reportActionPrefix) {
			served = append(served, t)
		}
		if strings.HasPrefix(t.Action, upwardReportActionPrefix) {
			served = append(served, t)
		}
		if isProcurementAction(t.Action) {
			served = append(served, t)
		}
	}
	return served, nil
}
