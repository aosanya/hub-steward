package voting

import "errors"

var (
	ErrPollNotFound  = errors.New("poll not found")
	ErrInvalidPoll   = errors.New("invalid poll")
	ErrInvalidChoice = errors.New("invalid choice")
	ErrNoCreator     = errors.New("a poll needs a caller to stand behind it")
	ErrPollNotDraft  = errors.New("a poll's choices change only while it is a draft")
)

var (
	ErrNoAnswerer      = errors.New("an answer needs a caller to give it")
	ErrOutsideWindow   = errors.New("the poll is not taking answers now")
	ErrNotInPollGroups = errors.New("the caller is not in a group the poll goes to")
	ErrInvalidAnswer   = errors.New("invalid answer")
	ErrAlreadyAnswered = errors.New("this poll keeps the first answer")
)

var (
	ErrNoPublisher        = errors.New("a result needs a caller to publish it")
	ErrInvalidPublication = errors.New("invalid publication")
	ErrNoReader           = errors.New("a published result is read by a caller")
)
