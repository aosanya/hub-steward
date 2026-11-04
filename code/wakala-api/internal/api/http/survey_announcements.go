package http

import (
	"context"
	"errors"
	"log/slog"

	"wakalaserver/internal/notifyrules"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
)

type surveyAudience interface {
	commRooms
	ActorManager(ctx context.Context, id string) (mwanachamaactor.UserManager, error)
}

type surveysAnnounced struct {
	forms.FormManager
	audience   surveyAudience
	instanceID string
	rules      *notifyrules.Store
	agency     agencyMembers
	promises   promisesToFile
}

func (m surveysAnnounced) Publish(ctx context.Context, id, candidateLinkKey, publishedBy, publishingAuthority string) (formsmodels.Form, formsmodels.PublicLink, error) {
	before, beforeErr := m.FormManager.Get(ctx, id)
	f, link, err := m.FormManager.Publish(ctx, id, candidateLinkKey, publishedBy, publishingAuthority)
	if err == nil && beforeErr == nil && before.Status != forms.StatusOpen && f.Audience == forms.AudienceMember {
		m.announce(ctx, f.ID)
	}
	return f, link, err
}

func (m surveysAnnounced) announce(ctx context.Context, formID string) {
	if m.audience == nil {
		return
	}
	targets, err := m.FormManager.ListTargets(ctx, formID)
	if err != nil {
		m.warn("form", formID, err)
		return
	}
	for _, t := range targets {
		m.tellGroup(ctx, formID, t.ChapterID)
	}
}

func (m surveysAnnounced) tellGroup(ctx context.Context, formID, groupID string) {
	members, err := m.toldOfAForm(ctx, groupID)
	if err != nil {
		m.warn("form", formID, err)
		return
	}
	cm, err := m.audience.CommManager(ctx, m.instanceID)
	if err != nil {
		m.warn("form", formID, err)
		return
	}
	for _, actorID := range members {
		_, err := cm.Raise(ctx, mwanachamacomm.Notification{
			ActorID:     actorID,
			Category:    commmodels.CategorySurvey,
			Event:       commmodels.EventSurveyReached,
			SubjectKind: commmodels.SubjectSurvey,
			SubjectID:   formID,
			StructureID: groupID,
		})
		if err != nil && !errors.Is(err, commmodels.ErrNotificationMuted) {
			m.warn("actor", actorID, err)
		}
	}
}

func (m surveysAnnounced) toldOfAForm(ctx context.Context, groupID string) ([]string, error) {
	members, err := m.membersOf(ctx, groupID)
	if err != nil {
		return nil, err
	}
	staff := joinDecisionsAnnounced{instanceID: m.instanceID, rules: m.rules, agency: m.agency}
	rule := staff.ruleFor(ctx, notifyrules.FormSent)
	roster := notifyrules.Roster{notifyrules.Group: members}
	if namesAudience(rule, notifyrules.GroupLeaders) {
		directory, err := m.audience.ActorManager(ctx, m.instanceID)
		if err != nil {
			return nil, err
		}
		staff.UserManager = directory
		staff.addGroupLeaders(ctx, roster, "", groupID)
	}
	if namesAgencyStaff(rule) {
		staff.addAgencyStaff(ctx, roster)
	}
	return notifyrules.Resolve(rule, roster), nil
}

func (m surveysAnnounced) membersOf(ctx context.Context, groupID string) ([]string, error) {
	directory, err := m.audience.ActorManager(ctx, m.instanceID)
	if err != nil {
		return nil, err
	}
	held, err := directory.ListActorsForGroup(ctx, groupID)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool, len(held))
	out := make([]string, 0, len(held))
	for _, a := range held {
		if a.Deleted || a.ActorID == "" || seen[a.ActorID] {
			continue
		}
		seen[a.ActorID] = true
		out = append(out, a.ActorID)
	}
	return out, nil
}

func (m surveysAnnounced) warn(key, value string, err error) {
	slog.Default().Warn("a published survey raised no notification",
		"instance", m.instanceID, key, value, "event", string(commmodels.EventSurveyReached), "error", err.Error())
}
