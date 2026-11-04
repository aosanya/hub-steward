package http

import (
	"context"
	"errors"
	"log/slog"
	"strconv"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
	mwanachamamarket "wakalaserver/modules/market"
	"wakalaserver/modules/market/models"
)

type actorDirectory interface {
	ActorManager(ctx context.Context, id string) (mwanachamaactor.UserManager, error)
}

func (m marketAnnounced) supplierApprovedNames(ctx context.Context, p mwanachamamarket.Poster, approver string) map[string]string {
	names := map[string]string{}
	if p.ApprovedByName != "" {
		names["person"] = p.ApprovedByName
	}
	if m.directory == nil || approver == "" {
		return names
	}
	people, err := m.directory.ActorManager(ctx, m.instanceID)
	if err != nil {
		return names
	}
	if acting, err := people.GetActor(ctx, approver); err == nil && acting.DisplayName != "" {
		names["person"] = acting.DisplayName
	}
	if group := groupApprovedFor(ctx, people, approver, p.Owner); group != "" {
		names["group"] = group
	}
	return names
}

func (m marketAnnounced) askAnsweredNames(ctx context.Context, a mwanachamamarket.Ask, answerer string, minutes int) map[string]string {
	names := map[string]string{"answer": a.Answer}
	if rider := m.answererName(ctx, a.PosterID, answerer); rider != "" {
		names["rider"] = rider
	}
	if a.Answer == models.AnswerYes && minutes > 0 {
		names["minutes"] = strconv.Itoa(minutes)
	}
	return names
}

func (m marketAnnounced) answererName(ctx context.Context, posterID, answerer string) string {
	if posters, err := m.MarketManager.ListPosters(ctx, ""); err == nil {
		for _, p := range posters {
			if p.ID == posterID && p.OwnerName != "" {
				return p.OwnerName
			}
		}
	}
	if m.directory == nil || answerer == "" {
		return ""
	}
	people, err := m.directory.ActorManager(ctx, m.instanceID)
	if err != nil {
		return ""
	}
	if acting, err := people.GetActor(ctx, answerer); err == nil {
		return acting.DisplayName
	}
	return ""
}

func groupApprovedFor(ctx context.Context, people mwanachamaactor.UserManager, approver, supplier string) string {
	led, err := people.ListLedGroups(ctx, approver)
	if err != nil || len(led) == 0 {
		return ""
	}
	registered, err := people.ListGroupsForActor(ctx, supplier)
	if err != nil {
		return led[0].Name
	}
	for _, g := range led {
		for _, r := range registered {
			if r.GroupID == g.ID {
				return g.Name
			}
		}
	}
	return led[0].Name
}

func (m marketAnnounced) raiseNamed(ctx context.Context, actorID string, kind commmodels.NotificationSubjectKind, subjectID string, event commmodels.NotificationEvent, names map[string]string) {
	if m.rooms == nil {
		return
	}
	cm, err := m.rooms.CommManager(ctx, m.instanceID)
	if err == nil {
		_, err = cm.Raise(ctx, mwanachamacomm.Notification{
			ActorID:     actorID,
			Category:    commmodels.CategoryMarket,
			Event:       event,
			SubjectKind: kind,
			SubjectID:   subjectID,
			Names:       names,
		})
	}
	if err == nil || errors.Is(err, commmodels.ErrNotificationMuted) {
		return
	}
	slog.Default().Warn("a market event raised no notification",
		"instance", m.instanceID, "subject", subjectID, "event", string(event), "error", err.Error())
}
