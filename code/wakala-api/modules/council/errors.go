package mwanachamacouncil

import "errors"

var ErrInvalidMeeting = errors.New("invalid council meeting: missing or malformed fields")

var ErrMeetingNotFound = errors.New("council meeting not found")
