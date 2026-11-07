package engage

import (
	"context"
	"fmt"
	"time"
	"wakalaserver/modules/shared/consent"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/engage/models"
)

type (
	Post       = models.Post
	RSVP       = models.RSVP
	Attendance = models.Attendance
	Offer      = models.Offer
	Pick       = models.Pick
	ReadMarker = models.ReadMarker
)

type PostManager interface {
	CreatePost(ctx context.Context, in Post) (Post, error)
	GetPost(ctx context.Context, postID string) (Post, error)
	MarkRead(ctx context.Context, postID, participantID string) (ReadMarker, error)
	CountUnread(ctx context.Context, participantID string) (UnreadCount, error)
	AnswerRSVP(ctx context.Context, in RSVP) (RSVP, error)
	ChangeEvent(ctx context.Context, in EventChange) (Changed, error)
	CancelEvent(ctx context.Context, postID, callerID string) (Changed, error)
	CheckInSelf(ctx context.Context, postID, participantID string) (Attendance, error)
	CheckIn(ctx context.Context, postID, participantID, callerID string) (Attendance, error)
	Untick(ctx context.Context, postID, participantID, callerID string) (Attendance, error)
	OfferHelp(ctx context.Context, postID, participantID string) (Offer, error)
	PickOffer(ctx context.Context, in Pick) (Picked, error)
	FillCall(ctx context.Context, postID, callerID string) (Filled, error)
	WithdrawOffer(ctx context.Context, postID, participantID string) (Offer, error)
	Unpick(ctx context.Context, postID, pickID, callerID string) (Picked, error)
	UseGroups(g Groups)
	UseConsentGate(g consent.Gate)
}

type postManager struct {
	db      *gorm.DB
	st      *store
	now     func() string
	groups  Groups
	consent consent.Gate
}

func NewPostManager(db *gorm.DB, s *spec.Spec) (PostManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewPostManager: db must not be nil")
	}
	st, err := newStore(db, s, map[string]any{
		objectPost:       models.Post{},
		objectRSVP:       models.RSVP{},
		objectAttendance: models.Attendance{},
		objectOffer:      models.Offer{},
		objectPick:       models.Pick{},
		objectReadMarker: models.ReadMarker{},
	})
	if err != nil {
		return nil, fmt.Errorf("NewPostManager: %w", err)
	}
	return &postManager{db: db, st: st, now: nowStamp}, nil
}

func nowStamp() string { return time.Now().UTC().Format(specstore.TimeLayout) }
