package engage

import "errors"

var (
	ErrPostNotFound   = errors.New("post not found")
	ErrInvalidPost    = errors.New("invalid post")
	ErrNoPoster       = errors.New("a post needs a caller to stand behind it")
	ErrNoReader       = errors.New("a read marker needs a caller")
	ErrNotANotice     = errors.New("only a sent notice is marked read")
	ErrNoResponder    = errors.New("an rsvp needs a caller")
	ErrInvalidRSVP    = errors.New("invalid rsvp")
	ErrNotAnOpenEvent = errors.New("only a sent event takes an rsvp")
	ErrEventStarted   = errors.New("the event has started")
	ErrNoVolunteer    = errors.New("an offer needs a caller")
	ErrNotAnOpenCall  = errors.New("only a sent volunteer call takes offers and picks")
	ErrNotThePoster   = errors.New("only the poster picks and fills a volunteer call")
	ErrOfferNotFound  = errors.New("offer not found")
	ErrNoAttendee     = errors.New("a check-in needs a caller")
	ErrOutsideEvent   = errors.New("the event is not on at this time")
	ErrNotCheckedIn   = errors.New("not checked in")
	ErrCallFull       = errors.New("the volunteer call already has as many picks as it needs")
	ErrOfferPicked    = errors.New("a picked offer is not withdrawn; the poster unpicks it")
	ErrPickNotFound   = errors.New("pick not found")
)
