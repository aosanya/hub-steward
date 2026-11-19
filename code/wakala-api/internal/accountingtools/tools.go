package accountingtools

import (
	"strings"
	"sync"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"

	accounting "github.com/aosanya/mwanachama-backend-accounting"
	accountingroutes "github.com/aosanya/mwanachama-backend-accounting/routes"
)

type Tool = dispatch.Tool

type Mount = accountingroutes.Mount

var servedPrefixes = []string{
	"accounting.budget.",
	"accounting.bill.",
	"accounting.payment.",
	"accounting.report.",
	"accounting.upward_report.",
	"accounting.tender.",
	"accounting.quote.",
}

var servedActions = map[string]bool{
	"accounting.account.list":      true,
	"accounting.dimension.totals":  true,
	"accounting.dimension.entries": true,
	"accounting.milestone.list":    true,
	"accounting.certificate.list":  true,
}

var withheldActions = map[string]bool{
	"accounting.budget.variance": true,
}

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(accounting.Operations())
})

var sentinels = map[string]error{
	"ErrNotFound":          accounting.ErrNotFound,
	"ErrInvalid":           accounting.ErrInvalid,
	"ErrClosed":            accounting.ErrClosed,
	"ErrNonZeroBalance":    accounting.ErrNonZeroBalance,
	"ErrAlreadyReversed":   accounting.ErrAlreadyReversed,
	"ErrCodeTaken":         accounting.ErrCodeTaken,
	"ErrOverCertified":     accounting.ErrOverCertified,
	"ErrRetentionHeld":     accounting.ErrRetentionHeld,
	"ErrRetentionReleased": accounting.ErrRetentionReleased,
	"ErrFigureTaken":       accounting.ErrFigureTaken,
	"ErrBudgetLineInUse":   accounting.ErrBudgetLineInUse,
	"ErrOverDaysBought":    accounting.ErrOverDaysBought,
	"ErrDayEntryDecided":   accounting.ErrDayEntryDecided,
	"ErrOwnDayEntry":       accounting.ErrOwnDayEntry,
	"ErrDateOverfull":      accounting.ErrDateOverfull,
	"ErrLocked":            accounting.ErrLocked,
	"ErrBudgetLineExists":  dispatch.ByType(&accounting.BudgetLineExistsError{}, nil),
}

func served(action string) bool {
	if withheldActions[action] {
		return false
	}
	if servedActions[action] {
		return true
	}
	for _, prefix := range servedPrefixes {
		if strings.HasPrefix(action, prefix) {
			return true
		}
	}
	return false
}

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
	var out []Tool
	for _, t := range all {
		if served(t.Action) {
			out = append(out, t)
		}
	}
	return out, nil
}
