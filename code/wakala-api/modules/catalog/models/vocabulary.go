package models

// Closed vocabularies for the catalog: the names Go code compares against,
// such as VisibilityPublic in a visibility switch.
//
// Which values are permitted is **not** here — it is declared in the spec,
// as an enum field's values, and checked on the way in (see validate.go).
// The two must agree, and the spec is the one that says so: a value added
// to a constant here without being declared there is refused at the write.
// None of it becomes a database CHECK, which would only relocate the same
// failure into a migration nobody re-reads.

// Visibility is who may read an Entry's document.
type Visibility string

const (
	// VisibilityPending is the state every Entry lands in. Nothing outside
	// the review surface may read it.
	VisibilityPending Visibility = "pending"

	// VisibilityPublic is readable by anyone, with no token.
	VisibilityPublic Visibility = "public"

	// VisibilityPrivate is readable only by presenting a live ShareLink key.
	VisibilityPrivate Visibility = "private"
)

// LinkStatus is whether a ShareLink still opens the Entry it belongs to.
type LinkStatus string

const (
	// LinkStatusActive opens the Entry.
	LinkStatusActive LinkStatus = "active"

	// LinkStatusRetired no longer opens it. Retired links are kept rather
	// than deleted so a rotation leaves a trail of what was handed out and
	// when it stopped working.
	LinkStatusRetired LinkStatus = "retired"
)

// SuggestionStatus is where a proposal has got to.
type SuggestionStatus string

const (
	// SuggestionStatusProposed is filed and waiting on a decision.
	SuggestionStatusProposed SuggestionStatus = "proposed"

	// SuggestionStatusApproved is cleared to be built.
	SuggestionStatusApproved SuggestionStatus = "approved"

	// SuggestionStatusRejected will not be built.
	SuggestionStatusRejected SuggestionStatus = "rejected"

	// SuggestionStatusBuilt has an Entry answering it.
	SuggestionStatusBuilt SuggestionStatus = "built"

	// SuggestionStatusStalled ran out of build attempts and waits for an
	// admin to send it back to approved.
	SuggestionStatusStalled SuggestionStatus = "stalled"
)

// SuggestionSource is what filed a proposal.
type SuggestionSource string

const (
	// SuggestionSourceRun is a mining run's own proposal.
	SuggestionSourceRun SuggestionSource = "run"

	// SuggestionSourceOwner is a person's. A run may not file one.
	SuggestionSourceOwner SuggestionSource = "owner"

	// SuggestionSourceStray is something a run met in passing rather than
	// went looking for.
	SuggestionSourceStray SuggestionSource = "stray"
)

// CommentAuthor is which side wrote a comment on a suggestion.
type CommentAuthor string

const (
	// CommentAuthorRun is a mining run saying what is left after an attempt.
	CommentAuthorRun CommentAuthor = "run"

	// CommentAuthorAdmin is a person, e.g. saying why they rejected one.
	CommentAuthorAdmin CommentAuthor = "admin"
)

// PageKind is which page a view was counted against. Two kinds, named for
// their shape rather than their subject: a storefront's front page and a
// library's front page are both PageKindIndex.
type PageKind string

const (
	// PageKindIndex is the front page, which has no slug.
	PageKindIndex PageKind = "index"

	// PageKindEntry is one Entry's page, counted against its slug.
	PageKindEntry PageKind = "entry"
)
