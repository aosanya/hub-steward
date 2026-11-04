package voting

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/voting/models"
)

type (
	Poll          = models.Poll
	Choice        = models.Choice
	Participation = models.Participation
	Ballot        = models.Ballot
)

type PollManager interface {
	CreatePoll(ctx context.Context, in Poll) (Poll, error)
	GetPoll(ctx context.Context, pollID string) (Poll, error)

	AddChoice(ctx context.Context, in Choice) (Choice, error)
	ListChoices(ctx context.Context, pollID string) ([]Choice, error)

	AnswerPoll(ctx context.Context, in Answer) (Participation, error)
	UseGroups(fn Groups)
	ForRun(runID string) (PollManager, error)

	CountPoll(ctx context.Context, pollID string) (Count, error)
	PublishResult(ctx context.Context, in Publication) (Poll, error)
	ReadPublishedCount(ctx context.Context, pollID, caller string) (Count, error)
	ListResponses(ctx context.Context, pollID string) (Responses, error)
	ReadOwnResponses(ctx context.Context, pollID, caller string) (Responses, error)

	UseSettings(layers SettingsLayers)
	Settings(ctx context.Context) (Settings, error)
}

type pollManager struct {
	db       *gorm.DB
	st       *store
	now      func() string
	groups   Groups
	spec     *spec.Spec
	settings SettingsLayers
}

func NewPollManager(db *gorm.DB, s *spec.Spec) (PollManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewPollManager: db must not be nil")
	}
	st, err := newStore(db, s, map[string]any{
		objectPoll:          models.Poll{},
		objectChoice:        models.Choice{},
		objectParticipation: models.Participation{},
		objectBallot:        models.Ballot{},
	})
	if err != nil {
		return nil, fmt.Errorf("NewPollManager: %w", err)
	}
	return &pollManager{db: db, st: st, now: nowStamp, spec: s}, nil
}

func nowStamp() string { return time.Now().UTC().Format(specstore.TimeLayout) }
