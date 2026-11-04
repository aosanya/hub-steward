package notifyrules

import (
	"context"

	commmodels "wakalaserver/modules/comm/models"
)

var commEvents = map[commmodels.NotificationEvent]Event{
	commmodels.EventJoinRequested:       JoinAsked,
	commmodels.EventGroupJoinApproved:   JoinApproved,
	commmodels.EventGroupJoinDeclined:   JoinDeclined,
	commmodels.EventThreadRequested:     ThreadStarted,
	commmodels.EventThreadDeclined:      ThreadDeclined,
	commmodels.EventThreadReply:         ThreadReply,
	commmodels.EventSurveyReached:       FormSent,
	commmodels.EventGroupInvited:        Invited,
	commmodels.EventSupplierApproved:    SupplierApproved,
	commmodels.EventAskAnswered:         AskAnswered,
	commmodels.EventAskWaiting:          AskWaiting,
	commmodels.EventRevisionAsked:       RevisionAsked,
	commmodels.EventNoticePosted:        NoticePosted,
	commmodels.EventQuoteSent:           QuoteSent,
	commmodels.EventDraftWaiting:        DraftWaiting,
	commmodels.EventCounterSent:         CounterSent,
	commmodels.EventAskClosed:           AskClosed,
	commmodels.EventGroupOrderCalledOff: GroupOrderCalledOff,
}

func ForCommEvent(e commmodels.NotificationEvent) (Event, bool) {
	ev, ok := commEvents[e]
	return ev, ok
}

func (s *Store) Mutable(ctx context.Context, instanceID string, e commmodels.NotificationEvent) (bool, bool) {
	ev, ok := ForCommEvent(e)
	if !ok {
		return false, false
	}
	rule, err := s.Rule(ctx, instanceID, ev)
	if err != nil {
		return false, false
	}
	return rule.Mutable, true
}
