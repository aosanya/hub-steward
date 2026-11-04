package agencies

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
	mwanachamamarket "wakalaserver/modules/market"
	"wakalaserver/modules/market/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	"wakalaserver/internal/notifyrules"
)

const askRunTriggerPrefix = "market_ask:"

func AskRunTrigger(askID string) string { return askRunTriggerPrefix + askID }

func askOfRun(run mwanachamataskmanager.WorkflowRun) (askID, picker string, ok bool) {
	askID, found := strings.CutPrefix(run.TriggerEvent, askRunTriggerPrefix)
	if !found || askID == "" || run.Initiator == "" {
		return "", "", false
	}
	return askID, run.Initiator, true
}

func askLine(a mwanachamamarket.Ask) string {
	switch {
	case a.Kind != "":
		return "a " + a.Kind
	case a.Product != "":
		return a.Product
	}
	return "a request"
}

func tellClosedAsks(ctx context.Context, reg Registry, instanceID string, closed []mwanachamataskmanager.WorkflowRun, rules RuleOf, logger *slog.Logger) {
	for _, run := range closed {
		askID, initiator, isAsk := askOfRun(run)
		if !isAsk {
			continue
		}
		if err := tellClosedAsk(ctx, reg, instanceID, askID, initiator, rules); err != nil && logger != nil {
			logger.Warn("a closed ask told nobody", "instance", instanceID, "run", run.ID, "ask", askID, "error", err.Error())
		}
	}
}

func tellClosedAsk(ctx context.Context, reg Registry, instanceID, askID, initiator string, rules RuleOf) error {
	market, err := reg.MarketManager(ctx, instanceID, MountMarket)
	if err != nil {
		return err
	}
	asks, err := market.ListAsksBy(ctx, initiator, "", models.AnswerWaiting)
	if err != nil {
		return err
	}
	for _, ask := range asks {
		if ask.ID != askID || ask.Picker != initiator {
			continue
		}
		return raiseAskClosed(ctx, reg, instanceID, ask, rules)
	}
	return nil
}

func raiseAskClosed(ctx context.Context, reg Registry, instanceID string, ask mwanachamamarket.Ask, rules RuleOf) error {
	rooms, err := reg.CommManager(ctx, instanceID)
	if err != nil {
		return err
	}
	var firstErr error
	for _, told := range askClosedAudience(ctx, instanceID, ask.Picker, rules) {
		_, err := rooms.Raise(ctx, mwanachamacomm.Notification{
			ActorID:     told,
			Category:    commmodels.CategoryMarket,
			Event:       commmodels.EventAskClosed,
			SubjectKind: commmodels.SubjectAsk,
			SubjectID:   ask.ID,
			Names:       map[string]string{"line": askLine(ask)},
		})
		if err != nil && !errors.Is(err, commmodels.ErrNotificationMuted) && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func askClosedAudience(ctx context.Context, instanceID, picker string, rules RuleOf) []string {
	rule, _ := notifyrules.Default(notifyrules.AskClosed)
	if rules != nil {
		if stored, err := rules(ctx, instanceID, notifyrules.AskClosed); err == nil {
			rule = stored
		}
	}
	return notifyrules.Resolve(rule, notifyrules.Roster{notifyrules.Subject: {picker}})
}
