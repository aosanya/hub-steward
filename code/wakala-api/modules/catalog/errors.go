package mwanachamacatalog

import "errors"

// ErrEntryNotFound is returned when no Entry exists for the given slug.
//
// [CatalogManager.OpenEntry] also returns it for an Entry that exists but
// may not be read — a pending one, or a private one whose key was wrong or
// missing. A caller that could tell those apart could enumerate the
// catalog's unpublished slugs by the shape of the error alone.
var ErrEntryNotFound = errors.New("entry not found")

// ErrEntryExists is returned by [CatalogManager.CreateEntry] when the slug
// is already taken.
var ErrEntryExists = errors.New("entry slug already in use")

// ErrInvalidEntry is returned when an Entry is missing required fields,
// carries a slug of the wrong shape or an unrecognized Visibility, or a Doc
// that is not a JSON object.
var ErrInvalidEntry = errors.New("invalid entry")

var ErrEntryKind = errors.New("entry does not fit its kind")

// ErrSlugImmutable is returned by [CatalogManager.UpdateEntry] when the
// caller tries to change a slug. It is the URL key and the foreign key the
// private parts and share links hang off.
var ErrSlugImmutable = errors.New("entry slug cannot be changed after creation")

// ErrInvalidPrivate is returned when an EntryPrivate carries a negative
// rank or ModuleConfigs that is not a JSON object.
var ErrInvalidPrivate = errors.New("invalid entry private parts")

// ErrInvalidDocPath is returned by [CatalogManager.ListEntries] for a
// DocFilter whose Path is not a plain dotted path. The path reaches the
// database as SQL text rather than as a bound parameter, so anything
// outside that alphabet is refused rather than escaped.
var ErrInvalidDocPath = errors.New("invalid document path")

// ErrInvalidShareLink is returned by [CatalogManager.IssueShareLink] for a
// label longer than models.MaxShareLabelBytes.
var ErrInvalidShareLink = errors.New("invalid share link")

// ErrShareLinkNotFound is returned when no ShareLink exists for the given
// id.
var ErrShareLinkNotFound = errors.New("share link not found")

// ErrNotPrivate is returned by [CatalogManager.IssueShareLink] for an Entry
// that is not private. A link against a public Entry would imply a
// restriction that does not exist, and one against a pending Entry would
// outlive the review it is waiting on.
var ErrNotPrivate = errors.New("entry is not private")

// ErrSuggestionNotFound is returned when no Suggestion exists for the given
// id.
var ErrSuggestionNotFound = errors.New("suggestion not found")

// ErrSuggestionDuplicate is returned by [CatalogManager.FileSuggestion]
// when the slug is already an Entry or already proposed. Filing is the only
// place dedup can be enforced, so it refuses rather than files a second.
var ErrSuggestionDuplicate = errors.New("suggestion slug is already an entry or a suggestion")

// ErrInvalidSuggestion is returned when a Suggestion is missing required
// fields or carries an unrecognized source or status.
var ErrInvalidSuggestion = errors.New("invalid suggestion")

// ErrSuggestionStatus is returned when a Suggestion is in the wrong state
// for what was asked: building one that is not approved, fulfilling one
// that was never approved, or deciding one into "built", which only
// fulfilling it may do.
var ErrSuggestionStatus = errors.New("suggestion is in the wrong state for that")

// ErrAttemptNeedsComment is returned by
// [CatalogManager.RecordSuggestionAttempt] with no reason given. Without
// one the attempt count rises toward the stall with no record of why.
var ErrAttemptNeedsComment = errors.New("an attempt needs a comment saying what is left")

// ErrInvalidComment is returned when a comment is blank or carries an
// unrecognized author.
var ErrInvalidComment = errors.New("invalid comment")

// ErrInvalidRun is returned when a MiningRun carries a negative count.
var ErrInvalidRun = errors.New("invalid mining run")

// ErrInvalidSetting is returned when a Setting has no key.
var ErrInvalidSetting = errors.New("invalid setting")

// ErrSettingNotFound is returned when no Setting exists for the given key.
var ErrSettingNotFound = errors.New("setting not found")

// ErrInvalidPageView is returned when a page view names an unrecognized
// page, or carries a slug that does not match it.
var ErrInvalidPageView = errors.New("invalid page view")

var ErrInvalidRecord = errors.New("invalid record")

var ErrRecordsNotKept = errors.New("records are not kept here")

var ErrRecordHolderSpoke = errors.New("this holder already has a record on this subject")

var ErrInvalidEndorsement = errors.New("invalid endorsement")

var ErrEndorsementsNotCounted = errors.New("endorsements are not counted here")

var ErrInvalidRaisedItem = errors.New("invalid raised item")

var ErrRaisedItemsNotTaken = errors.New("raised items are not taken here")

var ErrInvalidBoardItem = errors.New("invalid board item")

var ErrBoardNotKept = errors.New("no board is kept here")

var ErrBoardItemNotFound = errors.New("board item not found")

var ErrBoardItemClosed = errors.New("board item is already closed")

var ErrRaisedItemNotFound = errors.New("raised item not found")

var ErrRaisedItemNotPublishable = errors.New("raised item is not publishable")

var ErrInvalidReply = errors.New("invalid reply")

var ErrRepliesNotSent = errors.New("no replies are sent here")

var ErrAttachmentsNotTaken = errors.New("attachments are not taken here")

var ErrInvalidAttachment = errors.New("invalid attachment")

var ErrAttachmentNotFound = errors.New("attachment not found")

var ErrAttachmentApproved = errors.New("attachment approved for publishing")

var ErrInvalidRemoval = errors.New("invalid removal")

var ErrRemovalsNotMade = errors.New("nothing is removed here")

var ErrRaisedItemAlreadyRemoved = errors.New("raised item already removed")

var ErrInvalidScopeFigure = errors.New("invalid figure")

var ErrFiguresNotKept = errors.New("no figures are kept here")

var ErrScopeFigureNotFound = errors.New("figure not found")

var ErrRoleNotDeclared = errors.New("this catalog does not declare the role")

var ErrTimesNotBooked = errors.New("times are not booked here")

var ErrInvalidSlot = errors.New("invalid time")

var ErrSlotNotFound = errors.New("time not found")

var ErrSlotFull = errors.New("time is full")

var ErrAlreadyBooked = errors.New("already booked")

var ErrBookingNotFound = errors.New("booking not found")

var ErrBookingCancelled = errors.New("booking already cancelled")

var ErrCancelReasonRequired = errors.New("a reason is required")
