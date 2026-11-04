package http

import (
	"context"
	"errors"
	"log/slog"

	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
	formsmodels "wakalaserver/modules/forms/models"
)

func (m surveysAnnounced) PublishResults(ctx context.Context, formID, gitPath, gitCommit string, chapterIDs []string, publishedBy string) (formsmodels.ResultReport, error) {
	report, err := m.FormManager.PublishResults(ctx, formID, gitPath, gitCommit, chapterIDs, publishedBy)
	if err == nil {
		m.filePromises(ctx, report)
		m.announceResults(ctx, report)
	}
	return report, err
}

func (m surveysAnnounced) announceResults(ctx context.Context, report formsmodels.ResultReport) {
	if m.audience == nil {
		return
	}
	cm, err := m.audience.CommManager(ctx, m.instanceID)
	if err != nil {
		m.warnResults("form", report.FormID, err)
		return
	}
	told := map[string]bool{}
	for _, groupID := range m.groupsWithin(ctx, report.ChapterIDs) {
		members, err := m.membersOf(ctx, groupID)
		if err != nil {
			m.warnResults("group", groupID, err)
			continue
		}
		for _, actorID := range members {
			if told[actorID] {
				continue
			}
			told[actorID] = true
			_, err := cm.Raise(ctx, mwanachamacomm.Notification{
				ActorID:     actorID,
				Category:    commmodels.CategoryResults,
				Event:       commmodels.EventResultsPublished,
				SubjectKind: commmodels.SubjectSurvey,
				SubjectID:   report.FormID,
				StructureID: groupID,
			})
			if err != nil && !errors.Is(err, commmodels.ErrNotificationMuted) {
				m.warnResults("actor", actorID, err)
			}
		}
	}
}

func (m surveysAnnounced) groupsWithin(ctx context.Context, roots []string) []string {
	directory, err := m.audience.ActorManager(ctx, m.instanceID)
	if err != nil {
		return roots
	}
	seen := map[string]bool{}
	var out []string
	queue := append([]string(nil), roots...)
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
		children, err := directory.ListGroupChildren(ctx, id)
		if err != nil {
			m.warnResults("group", id, err)
			continue
		}
		for _, c := range children {
			queue = append(queue, c.ID)
		}
	}
	return out
}

func (m surveysAnnounced) warnResults(key, value string, err error) {
	slog.Default().Warn("published results raised no notification",
		"instance", m.instanceID, key, value, "event", string(commmodels.EventResultsPublished), "error", err.Error())
}
