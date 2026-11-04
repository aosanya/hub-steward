package models

// ChannelArchived is the Channel value of a publication nothing runs from.
// Any other value is a live channel name.
const ChannelArchived = ""

// DefaultChannel is what PublishAgency publishes to when given no channel.
const DefaultChannel = "production"

// AgencyPublication is a tagged, versioned Agency: the Document is the
// whole Agency, and production operates from it rather than from the
// working rows (AGD-005). Publishing freezes the working set into one of
// these; nothing running resolves rows again afterwards.
type AgencyPublication struct {
	ID string `json:"id"`
	// DraftID is "" when this publication was produced with no draft
	// (a re-tag of whatever the working set already held).
	DraftID     string `json:"draft_id,omitempty"`
	ContentHash string `json:"content_hash"`
	Version     int    `json:"version"`
	// Tag names the publication. Operator-supplied and unique across
	// publications; "v<version>" when none was given.
	Tag string `json:"tag"`
	// Channel is which live channel serves this publication —
	// "production", "staging", … — or [ChannelArchived] for one nothing
	// runs from. A channel name is unique across publications: at most one
	// tag per channel, though several tags may be live on different
	// channels at once. Re-setting an archived publication's channel is
	// how a rollback works.
	Channel string `json:"channel"`
	// Document is the whole Agency as published. Empty only for
	// publications written before AGD-005, which recorded a hash alone and
	// cannot be back-filled — the rows they described have moved on.
	Document    AgencyDocument `json:"document"`
	PublishedAt string         `json:"published_at"`
	LastUpdated string         `json:"last_updated"`
}
