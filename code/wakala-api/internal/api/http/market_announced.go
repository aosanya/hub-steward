package http

import (
	"context"

	commmodels "wakalaserver/modules/comm/models"
	mwanachamamarket "wakalaserver/modules/market"
	"wakalaserver/modules/market/models"

	"wakalaserver/internal/notifyrules"
)

type marketAnnounced struct {
	mwanachamamarket.MarketManager
	rooms      commRooms
	directory  actorDirectory
	instanceID string
	rules      *notifyrules.Store
}

func (d *Deps) marketAnnounced(m mwanachamamarket.MarketManager, instanceID string) mwanachamamarket.MarketManager {
	return d.marketAskRuns(marketAnnounced{MarketManager: m, rooms: d.Registry, directory: d.Registry, instanceID: instanceID, rules: d.NotifyRules}, instanceID)
}

func (m marketAnnounced) ApprovePoster(ctx context.Context, caller, id string) (mwanachamamarket.Poster, error) {
	p, err := m.MarketManager.ApprovePoster(ctx, caller, id)
	if err != nil {
		return p, err
	}
	names := m.supplierApprovedNames(ctx, p, caller)
	for _, told := range m.toldOf(ctx, notifyrules.SupplierApproved, p.Owner) {
		m.raiseNamed(ctx, told, commmodels.SubjectPoster, p.ID, commmodels.EventSupplierApproved, names)
	}
	return p, nil
}

func (m marketAnnounced) AnswerAsk(ctx context.Context, caller, askID, answer, date, note string) (mwanachamamarket.Ask, error) {
	return m.AnswerAskWithMinutes(ctx, caller, askID, answer, date, note, "", 0, 0)
}

func (m marketAnnounced) AnswerAskWithOffer(ctx context.Context, caller, askID, answer, date, note, offerID string, price float64) (mwanachamamarket.Ask, error) {
	return m.AnswerAskWithMinutes(ctx, caller, askID, answer, date, note, offerID, price, 0)
}

func (m marketAnnounced) AnswerAskWithMinutes(ctx context.Context, caller, askID, answer, date, note, offerID string, price float64, minutes int) (mwanachamamarket.Ask, error) {
	a, err := m.MarketManager.AnswerAskWithMinutes(ctx, caller, askID, answer, date, note, offerID, price, minutes)
	if err != nil {
		return a, err
	}
	names := m.askAnsweredNames(ctx, a, caller, minutes)
	for _, told := range m.toldOf(ctx, notifyrules.AskAnswered, a.Picker) {
		m.raiseNamed(ctx, told, commmodels.SubjectAsk, a.ID, commmodels.EventAskAnswered, names)
	}
	return a, nil
}

func (m marketAnnounced) CreateAsk(ctx context.Context, caller string, a mwanachamamarket.Ask) (mwanachamamarket.Ask, error) {
	a, err := m.MarketManager.CreateAsk(ctx, caller, a)
	if err != nil {
		return a, err
	}
	posters, err := m.MarketManager.ListPosters(ctx, "")
	if err != nil {
		return a, nil
	}
	for _, p := range posters {
		if p.ID != a.PosterID {
			continue
		}
		for _, told := range m.toldOf(ctx, notifyrules.AskWaiting, p.Owner) {
			m.raise(ctx, told, commmodels.SubjectAsk, a.ID, commmodels.EventAskWaiting)
		}
	}
	return a, nil
}

func (m marketAnnounced) AskRevision(ctx context.Context, caller, id string, price, minimum float64) (mwanachamamarket.GroupOrder, error) {
	g, err := m.MarketManager.AskRevision(ctx, caller, id, price, minimum)
	if err != nil {
		return g, err
	}
	view, err := m.MarketManager.GetGroupOrder(ctx, caller, id)
	if err != nil {
		return g, nil
	}
	seen := map[string]bool{}
	for _, l := range view.Lines {
		if l.Picker == "" || seen[l.Picker] {
			continue
		}
		seen[l.Picker] = true
		for _, told := range m.toldOf(ctx, notifyrules.RevisionAsked, l.Picker) {
			m.raise(ctx, told, commmodels.SubjectGroupOrder, g.ID, commmodels.EventRevisionAsked)
		}
	}
	return g, nil
}

func (m marketAnnounced) CreateNotice(ctx context.Context, caller string, n mwanachamamarket.Notice) (mwanachamamarket.Notice, error) {
	n, err := m.MarketManager.CreateNotice(ctx, caller, n)
	if err != nil {
		return n, err
	}
	posters, err := m.MarketManager.ListPosters(ctx, models.PosterApproved)
	if err != nil {
		return n, nil
	}
	for _, p := range posters {
		if p.Owner == "" || p.Owner == n.Picker {
			continue
		}
		for _, told := range m.toldOf(ctx, notifyrules.NoticePosted, p.Owner) {
			m.raise(ctx, told, commmodels.SubjectNotice, n.ID, commmodels.EventNoticePosted)
		}
	}
	return n, nil
}

func (m marketAnnounced) SendQuote(ctx context.Context, caller, noticeID string, q mwanachamamarket.Quote) (mwanachamamarket.Quote, error) {
	q, err := m.MarketManager.SendQuote(ctx, caller, noticeID, q)
	if err != nil {
		return q, err
	}
	for _, told := range m.toldOf(ctx, notifyrules.QuoteSent, q.Picker) {
		m.raise(ctx, told, commmodels.SubjectQuote, q.ID, commmodels.EventQuoteSent)
	}
	return q, nil
}

func (m marketAnnounced) DraftCounter(ctx context.Context, caller, quoteID string, price float64, note string) (mwanachamamarket.Draft, error) {
	d, err := m.MarketManager.DraftCounter(ctx, caller, quoteID, price, note)
	if err != nil {
		return d, err
	}
	notices, err := m.MarketManager.ListNotices(ctx)
	if err != nil {
		return d, nil
	}
	for _, n := range notices {
		if n.ID != d.NoticeID {
			continue
		}
		for _, told := range m.toldOf(ctx, notifyrules.DraftWaiting, n.Picker) {
			m.raise(ctx, told, commmodels.SubjectDraft, d.ID, commmodels.EventDraftWaiting)
		}
	}
	return d, nil
}

func (m marketAnnounced) SendCounter(ctx context.Context, caller, draftID string) (mwanachamamarket.Quote, error) {
	q, err := m.MarketManager.SendCounter(ctx, caller, draftID)
	if err != nil {
		return q, err
	}
	posters, err := m.MarketManager.ListPosters(ctx, "")
	if err != nil {
		return q, nil
	}
	for _, p := range posters {
		if p.ID != q.PosterID {
			continue
		}
		for _, told := range m.toldOf(ctx, notifyrules.CounterSent, p.Owner) {
			m.raise(ctx, told, commmodels.SubjectQuote, q.ID, commmodels.EventCounterSent)
		}
	}
	return q, nil
}

func (m marketAnnounced) toldOf(ctx context.Context, e notifyrules.Event, subject string) []string {
	rule := notifyrules.Rule{Event: e, Told: []notifyrules.Audience{notifyrules.Subject}}
	if m.rules != nil {
		if stored, err := m.rules.Rule(ctx, m.instanceID, e); err == nil {
			rule = stored
		}
	}
	return notifyrules.Resolve(rule, notifyrules.Roster{notifyrules.Subject: {subject}})
}

func (m marketAnnounced) raise(ctx context.Context, actorID string, kind commmodels.NotificationSubjectKind, subjectID string, event commmodels.NotificationEvent) {
	m.raiseNamed(ctx, actorID, kind, subjectID, event, nil)
}
