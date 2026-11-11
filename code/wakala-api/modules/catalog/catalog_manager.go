package mwanachamacatalog

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/catalog/models"
	"wakalaserver/modules/shared/geo"
	"wakalaserver/modules/shared/spec"
)

// Entry, EntryPrivate, ShareLink and their enum types are aliases of their
// models. counterparts, so a caller needs only this package's import.
type (
	Entry                  = models.Entry
	DocFilter              = models.DocFilter
	EntryPrivate           = models.EntryPrivate
	ShareLink              = models.ShareLink
	Suggestion             = models.Suggestion
	SuggestionComment      = models.SuggestionComment
	SuggestionMatch        = models.SuggestionMatch
	MiningRun              = models.MiningRun
	Setting                = models.Setting
	PageView               = models.PageView
	Visibility             = models.Visibility
	LinkStatus             = models.LinkStatus
	SuggestionStatus       = models.SuggestionStatus
	SuggestionSource       = models.SuggestionSource
	CommentAuthor          = models.CommentAuthor
	PageKind               = models.PageKind
	Record                 = models.Record
	Endorsement            = models.Endorsement
	Slot                   = models.Slot
	Booking                = models.Booking
	RaisedItem             = models.RaisedItem
	BoardItem              = models.BoardItem
	BoardItemTally         = models.BoardItemTally
	SharedBoardItem        = models.SharedBoardItem
	Reply                  = models.Reply
	FollowKey              = models.FollowKey
	FollowedRaisedItem     = models.FollowedRaisedItem
	FollowedRaisedItemView = models.FollowedRaisedItemView
	MyRaisedItem           = models.MyRaisedItem
	Removal                = models.Removal
	RaisedItemFile         = models.RaisedItemFile
	FieldTally             = models.FieldTally
	ScopeFigure            = models.ScopeFigure
)

const (
	// VisibilityPending is the state every Entry lands in.
	VisibilityPending = models.VisibilityPending

	// VisibilityPublic is readable by anyone.
	VisibilityPublic = models.VisibilityPublic

	// VisibilityPrivate is readable only with a live share key.
	VisibilityPrivate = models.VisibilityPrivate

	// LinkStatusActive opens the Entry it belongs to.
	LinkStatusActive = models.LinkStatusActive

	// LinkStatusRetired no longer opens it.
	LinkStatusRetired = models.LinkStatusRetired

	// SuggestionStatusProposed is filed and waiting on a decision.
	SuggestionStatusProposed = models.SuggestionStatusProposed

	// SuggestionStatusApproved is cleared to be built.
	SuggestionStatusApproved = models.SuggestionStatusApproved

	// SuggestionStatusRejected will not be built.
	SuggestionStatusRejected = models.SuggestionStatusRejected

	// SuggestionStatusBuilt has an Entry answering it.
	SuggestionStatusBuilt = models.SuggestionStatusBuilt

	// SuggestionStatusStalled ran out of build attempts.
	SuggestionStatusStalled = models.SuggestionStatusStalled

	// SuggestionSourceRun is a mining run's own proposal.
	SuggestionSourceRun = models.SuggestionSourceRun

	// SuggestionSourceOwner is a person's.
	SuggestionSourceOwner = models.SuggestionSourceOwner

	// SuggestionSourceStray is met in passing rather than sought.
	SuggestionSourceStray = models.SuggestionSourceStray

	// CommentAuthorRun is a mining run.
	CommentAuthorRun = models.CommentAuthorRun

	// CommentAuthorAdmin is a person.
	CommentAuthorAdmin = models.CommentAuthorAdmin

	// PageKindIndex is the front page.
	PageKindIndex = models.PageKindIndex

	// PageKindEntry is one Entry's page.
	PageKindEntry = models.PageKindEntry

	// MaxSuggestionAttempts is how many builds may fail before a suggestion
	// stalls.
	MaxSuggestionAttempts = models.MaxSuggestionAttempts
)

// ListFilter narrows [CatalogManager.ListEntries]. A zero filter lists
// every non-deleted Entry.
type PublishSchedule struct {
	Slugs     []string `json:"slugs"`
	PublishAt string   `json:"publish_at"`
}

type ListFilter struct {
	// Visibility, when set, keeps only Entries in that state.
	Visibility Visibility

	// Docs keeps only Entries whose document holds the given value at the
	// given path. This is how a domain filters on its own vocabulary —
	// {Path: "_template.sector", Value: "health"} for an agency catalog,
	// {Path: "subject", Value: "history"} for a library — without this
	// package learning either word.
	Docs []DocFilter

	// Search, when set, keeps Entries whose name or summary contains it,
	// case-insensitively.
	Search string

	// Limit caps the rows returned. Zero means the default page.
	Limit int

	// Offset skips that many rows, so a caller can page past the first.
	Offset int
}

// CatalogManager is the single interface for the catalog: the documents,
// the operator's private notes on each, and the keys that open a private
// one. It names no domain — see this package's doc.go.
type CatalogManager interface {
	// CreateEntry stores a new Entry as pending, whatever Visibility it
	// carries, and returns it with its generated id and timestamps.
	CreateEntry(ctx context.Context, e Entry) (Entry, error)

	// UpsertEntry creates the Entry or replaces the document and card of an
	// existing one. Replacing the document of an approved Entry returns it
	// to pending, so nothing unreviewed is ever readable.
	UpsertEntry(ctx context.Context, e Entry) (Entry, error)

	// GetEntry reads one Entry regardless of Visibility. This is the
	// operator's read; OpenEntry is the reader's.
	GetEntry(ctx context.Context, slug string) (Entry, error)

	// OpenEntry reads one Entry as a public reader. A public Entry
	// opens with any key. A private one opens only with a live share key. A
	// pending Entry, a missing slug and a wrong key are all
	// ErrEntryNotFound.
	OpenEntry(ctx context.Context, slug, key string) (Entry, error)

	// UpdateEntry replaces the mutable fields of an existing Entry.
	UpdateEntry(ctx context.Context, e Entry) (Entry, error)

	// SetVisibility moves an Entry between pending, public and private,
	// stamping ApprovedAt when it leaves pending and clearing it on the way
	// back.
	SetVisibility(ctx context.Context, slug string, v Visibility) (Entry, error)

	SchedulePublish(ctx context.Context, slug, publishAt string) (Entry, error)

	SchedulePublishBatch(ctx context.Context, s PublishSchedule) ([]Entry, error)

	// DeleteEntry soft-deletes an Entry.
	DeleteEntry(ctx context.Context, slug string) error
	DisposeExpired(ctx context.Context, now time.Time) ([]string, error)
	SeedEntries(ctx context.Context) ([]string, error)

	// ListEntries returns the cards matching f, ordered by name, never
	// carrying Doc.
	ListEntries(ctx context.Context, f ListFilter) ([]Entry, error)

	ListPublicEntries(ctx context.Context, f ListFilter) ([]Entry, error)

	// PutPrivate writes the private parts of one Entry. Empty fields leave
	// the stored value alone, so a caller may update the rank without
	// resending the readme.
	PutPrivate(ctx context.Context, p EntryPrivate) (EntryPrivate, error)

	// GetPrivate reads the private parts of one Entry.
	GetPrivate(ctx context.Context, slug string) (EntryPrivate, error)

	// IssueShareLink mints a key for a private Entry, returning the link
	// and the raw key. The raw key is returned only here and never stored.
	IssueShareLink(ctx context.Context, slug, label, by string) (ShareLink, string, error)

	// RetireShareLink stops a link opening its Entry, keeping the row.
	RetireShareLink(ctx context.Context, id string) (ShareLink, error)

	// ListShareLinks returns every link issued for one Entry, newest first.
	ListShareLinks(ctx context.Context, slug string) ([]ShareLink, error)

	// FileSuggestion proposes something worth adding. It always lands
	// proposed, and refuses a slug that is already an Entry or already
	// proposed.
	FileSuggestion(ctx context.Context, s Suggestion) (Suggestion, error)

	// GetSuggestion reads one proposal.
	GetSuggestion(ctx context.Context, id string) (Suggestion, error)

	// ListSuggestions returns proposals in the given statuses, best
	// priority first. No statuses means all of them.
	ListSuggestions(ctx context.Context, statuses ...SuggestionStatus) ([]Suggestion, error)

	DecideSuggestion(ctx context.Context, id string, status SuggestionStatus, priority *int) (Suggestion, error)

	// RecordSuggestionAttempt counts a build that did not finish and keeps
	// the reason as a comment. At MaxSuggestionAttempts the proposal
	// stalls.
	RecordSuggestionAttempt(ctx context.Context, id, runRef, comment string) (Suggestion, error)

	// CommentOnSuggestion adds a note that is not about a build attempt.
	CommentOnSuggestion(ctx context.Context, id string, author CommentAuthor, body string) (SuggestionComment, error)

	// ListSuggestionComments returns every note on a proposal, oldest
	// first.
	ListSuggestionComments(ctx context.Context, id string) ([]SuggestionComment, error)

	FulfilSuggestion(ctx context.Context, id, slug, runRef, note string) (Suggestion, error)

	AttachSuggestion(ctx context.Context, id, slug, note string) (SuggestionMatch, error)

	ListSuggestionMatches(ctx context.Context, id string) ([]SuggestionMatch, error)

	ListEntryMatches(ctx context.Context, slug string) ([]SuggestionMatch, error)

	// RecordRun stores one mining run's report.
	RecordRun(ctx context.Context, r MiningRun) (MiningRun, error)

	// ListRuns returns run reports, newest first.
	ListRuns(ctx context.Context, limit int) ([]MiningRun, error)

	// PutSetting writes one run-time knob.
	PutSetting(ctx context.Context, key, value string) (Setting, error)

	// GetSetting reads one.
	GetSetting(ctx context.Context, key string) (Setting, error)

	// RecordPageView adds one to a page's running total. An agency view
	// counts only against a slug that exists.
	RecordPageView(ctx context.Context, page PageKind, slug string) error

	// ListPageViews returns every counted page, most viewed first.
	ListPageViews(ctx context.Context) ([]PageView, error)

	PutRecord(ctx context.Context, r Record) (Record, error)

	ListRecords(ctx context.Context, subjectID, scopeID string) ([]Record, error)

	CountRecords(ctx context.Context, subjectID, scopeID string) ([]FieldTally, error)

	Endorse(ctx context.Context, subjectID, holderID string) (int, error)

	CountEndorsements(ctx context.Context, subjectID string) (int, error)

	OfferSlot(ctx context.Context, s Slot) (Slot, error)
	ListSlots(ctx context.Context, subjectID string) ([]Slot, error)
	Book(ctx context.Context, slotID, holderID string) (Booking, error)
	CancelBooking(ctx context.Context, bookingID, by, reason string) (Booking, error)
	CancelBookingAsStaff(ctx context.Context, bookingID, by, reason string) (Booking, error)
	ListHolderBookings(ctx context.Context, holderID string) ([]Booking, error)
	ListDayBookings(ctx context.Context, subjectID, day string) ([]Booking, error)

	RaiseItem(ctx context.Context, r RaisedItem) (RaisedItem, error)
	FileRaisedItem(ctx context.Context, r RaisedItem) (RaisedItem, error)

	ListRaisedItems(ctx context.Context, raisedBy string) ([]MyRaisedItem, error)
	ReassignRaisedItem(ctx context.Context, raisedItemID, department string) error
	ListRaisedItemsOfSubject(ctx context.Context, subjectID string) ([]RaisedItem, error)

	UseAreaResolver(resolve AreaResolver)
	UseStreetResolver(resolve StreetResolver)
	UseLinkedEntries(linked LinkedEntries)

	NearbyRaisedItems(ctx context.Context, topic string, at geo.Position, withinMetres float64) ([]RaisedItem, error)

	PutOnBoard(ctx context.Context, b BoardItem) (BoardItem, error)

	GroupUnderBoardItem(ctx context.Context, raisedItemID, boardItemID string) error

	ListBoardItems(ctx context.Context) ([]BoardItemTally, error)
	ListPublicBoardItems(ctx context.Context, limit, offset int) ([]BoardItemTally, error)

	SetBoardItemOutcome(ctx context.Context, boardItemID, outcome string) error
	SetBoardItemHidden(ctx context.Context, boardItemID string, hidden bool) error
	AssignBoardItem(ctx context.Context, boardItemID, assigneeKind, assigneeID string) error
	UnassignBoardItem(ctx context.Context, boardItemID string) error
	CloseBoardItem(ctx context.Context, boardItemID, closedBy string) error

	UngroupFromBoardItem(ctx context.Context, raisedItemID string) error

	OpenSharedBoardItem(ctx context.Context, key string) (SharedBoardItem, error)

	ReplyToRaisedItem(ctx context.Context, r Reply) (Reply, error)

	ListReplies(ctx context.Context, raisedItemID string) ([]Reply, error)
	ListMyReplies(ctx context.Context, raisedItemID, caller string) ([]Reply, error)
	IssueFollowKey(ctx context.Context, raisedItemID string) (FollowKey, error)
	OpenFollowedRaisedItem(ctx context.Context, key string) (FollowedRaisedItem, error)
	ShowFollowedRaisedItem(ctx context.Context, key string) (FollowedRaisedItemView, error)
	RecordScopeFigure(ctx context.Context, f ScopeFigure) (ScopeFigure, error)
	CurrentScopeFigure(ctx context.Context, scopeID string) (ScopeFigure, error)
	ListScopeFigures(ctx context.Context, scopeID string) ([]ScopeFigure, error)
	AttachFiles(ctx context.Context, raisedItemID, raiser string, fileIDs []string) ([]RaisedItemFile, error)
	ApproveFileForPublishing(ctx context.Context, raisedItemID, fileID, approvedBy string) (RaisedItemFile, error)
	WithdrawFileApproval(ctx context.Context, raisedItemID, fileID string) (RaisedItemFile, error)
	DetachFile(ctx context.Context, raisedItemID, raiser, fileID string) error
	ListRaisedItemFiles(ctx context.Context, raisedItemID string) ([]RaisedItemFile, error)
	RemoveRaisedItem(ctx context.Context, r Removal) (Removal, error)
	ListRemovalsOfMine(ctx context.Context, raisedBy string) ([]Removal, error)
	ListOverdueRaisedItems(ctx context.Context, at string) ([]RaisedItem, error)
}

type catalogManager struct {
	db   *gorm.DB
	st   *store
	spec *spec.Spec
	now  func() string

	resolveArea   AreaResolver
	resolveStreet StreetResolver
	linkedEntries LinkedEntries
}

// NewCatalogManager builds a CatalogManager over db, reading and writing the
// tables s declares. spec.Migrate must have run for the same db and s.
//
// The spec is checked against the types this package carries before anything
// is served: a declared column with no field to hold it, or a field with no
// column to land in, fails here rather than dropping a value on every write.
func NewCatalogManager(db *gorm.DB, s *spec.Spec) (CatalogManager, error) {
	carriers := map[string]any{
		roleEntry:        models.Entry{},
		roleEntryPrivate: models.EntryPrivate{},
		roleShareLink:    models.ShareLink{},
	}
	for role, carrier := range map[string]any{
		roleSuggestion:        models.Suggestion{},
		roleSuggestionComment: models.SuggestionComment{},
		roleSuggestionMatch:   models.SuggestionMatch{},
		roleRun:               models.MiningRun{},
		roleSetting:           models.Setting{},
		rolePageView:          models.PageView{},
	} {
		if _, declared := s.ByRole(role); declared {
			carriers[role] = carrier
		}
	}
	if _, kept := s.ByRole(roleRecord); kept {
		carriers[roleRecord] = models.Record{}
	}
	if _, counted := s.ByRole(roleEndorsement); counted {
		carriers[roleEndorsement] = models.Endorsement{}
	}
	if _, booked := s.ByRole(roleSlot); booked {
		carriers[roleSlot] = models.Slot{}
	}
	if _, booked := s.ByRole(roleBooking); booked {
		carriers[roleBooking] = models.Booking{}
	}
	if _, taken := s.ByRole(roleRaisedItem); taken {
		carriers[roleRaisedItem] = models.RaisedItem{}
	}
	if _, boarded := s.ByRole(roleBoardItem); boarded {
		carriers[roleBoardItem] = models.BoardItem{}
	}
	if _, replied := s.ByRole(roleReply); replied {
		carriers[roleReply] = models.Reply{}
	}
	if _, attached := s.ByRole(roleRaisedItemFile); attached {
		carriers[roleRaisedItemFile] = models.RaisedItemFile{}
	}
	if _, removes := s.ByRole(roleRemoval); removes {
		carriers[roleRemoval] = models.Removal{}
	}
	if _, kept := s.ByRole(roleScopeFigure); kept {
		carriers[roleScopeFigure] = models.ScopeFigure{}
	}
	st, err := newStore(db, s, carriers)
	if err != nil {
		return nil, fmt.Errorf("NewCatalogManager: %w", err)
	}
	return &catalogManager{db: db, st: st, spec: s, now: nowRFC3339}, nil
}

// q starts a query against the table playing one role.
func (m *catalogManager) q(ctx context.Context, role string) *gorm.DB {
	return m.db.WithContext(ctx).Table(m.st.Table(role))
}

// take reads at most one row into out, answering notFound when there is
// none. Rows come back as maps rather than structs, because the columns are
// the spec's to declare and this package no longer restates them.
func (m *catalogManager) take(q *gorm.DB, role string, out any, notFound error) error {
	var rows []map[string]any
	if err := q.Limit(1).Find(&rows).Error; err != nil {
		return err
	}
	if len(rows) == 0 {
		return notFound
	}
	return decode(m.st.Object(role), rows[0], out)
}

// listOf reads every row q matches. A free function rather than a method
// because Go has no generic methods, and the alternative is the same decode
// loop written out once per listing.
func listOf[T any](m *catalogManager, q *gorm.DB, role string) ([]T, error) {
	var rows []map[string]any
	if err := capList(q, role).Find(&rows).Error; err != nil {
		return nil, err
	}
	o := m.st.Object(role)
	out := make([]T, 0, len(rows))
	for _, r := range rows {
		var v T
		if err := decode(o, r, &v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, nil
}

// insert writes v as a new row.
func (m *catalogManager) insert(ctx context.Context, role string, v any) error {
	row, err := encode(m.st.Object(role), v)
	if err != nil {
		return err
	}
	return m.q(ctx, role).Create(row).Error
}

func TallyRecords(records []Record) ([]FieldTally, error) { return models.TallyRecords(records) }
