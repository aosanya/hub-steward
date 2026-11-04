package agencies

import (
	"context"
	"log"

	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	taskmodels "wakalaserver/modules/taskmanager/models"
)

type caseNotices struct {
	rooms      func(ctx context.Context, id string) (*mwanachamacomm.CommManager, error)
	board      func() mwanachamataskmanager.TaskManager
	instanceID string
}

func (n *caseNotices) Publish(ctx context.Context, topic string, payload any) error {
	if p, isHandOver := payload.(mwanachamataskmanager.TaskHandedOverPayload); isHandOver {
		return n.tellHolder(ctx, topic, p)
	}
	actorID, caseID, event, ok := n.noticeFor(ctx, topic, payload)
	if !ok || actorID == "" {
		return nil
	}
	cm, err := n.rooms(ctx, n.instanceID)
	if err != nil {
		log.Printf("agencies: case notice %s for case %s: %v", event, caseID, err)
		return err
	}
	_, err = cm.Raise(ctx, mwanachamacomm.Notification{
		ActorID:     actorID,
		Category:    commmodels.CategoryCase,
		Event:       event,
		SubjectKind: commmodels.SubjectCase,
		SubjectID:   caseID,
	})
	if err != nil {
		log.Printf("agencies: case notice %s for case %s: %v", event, caseID, err)
	}
	return err
}

func (n *caseNotices) noticeFor(ctx context.Context, topic string, payload any) (string, string, commmodels.NotificationEvent, bool) {
	switch p := payload.(type) {
	case mwanachamataskmanager.CaseOpenedPayload:
		if topic == mwanachamataskmanager.TopicCaseOpened {
			return p.RequesterID, p.CaseID, commmodels.EventCaseOpened, true
		}
	case mwanachamataskmanager.CaseClosedPayload:
		if topic != mwanachamataskmanager.TopicCaseClosed {
			return "", "", "", false
		}
		board := n.board()
		if board == nil {
			return "", "", "", false
		}
		c, err := board.GetCase(ctx, p.CaseID)
		if err != nil {
			log.Printf("agencies: case notice for closed case %s: %v", p.CaseID, err)
			return "", "", "", false
		}
		return c.RequesterID, p.CaseID, commmodels.EventCaseClosed, true
	}
	return "", "", "", false
}

func (n *caseNotices) tellHolder(ctx context.Context, topic string, p mwanachamataskmanager.TaskHandedOverPayload) error {
	if topic != mwanachamataskmanager.TopicTaskHandedOver || p.AssigneeKind != taskmodels.AssigneeActor || p.AssigneeID == "" {
		return nil
	}
	cm, err := n.rooms(ctx, n.instanceID)
	if err != nil {
		log.Printf("agencies: task notice for task %s: %v", p.TaskID, err)
		return err
	}
	_, err = cm.Raise(ctx, mwanachamacomm.Notification{
		ActorID:     p.AssigneeID,
		Category:    commmodels.CategoryTask,
		Event:       commmodels.EventTaskAssigned,
		SubjectKind: commmodels.SubjectTask,
		SubjectID:   p.TaskID,
	})
	if err != nil {
		log.Printf("agencies: task notice for task %s: %v", p.TaskID, err)
	}
	return err
}
