package mwanachamacouncil

import "errors"

var ErrInvalidMeeting = errors.New("invalid council meeting: missing or malformed fields")

var ErrMeetingNotFound = errors.New("council meeting not found")

var ErrInvalidAgenda = errors.New("invalid council agenda: missing or malformed fields")

var ErrAgendaNotFound = errors.New("council agenda not found")

var ErrInvalidMinutes = errors.New("invalid council minutes: missing or malformed fields")

var ErrMinutesNotFound = errors.New("council minutes not found")

var ErrInvalidResolution = errors.New("invalid council resolution: missing or malformed fields")

var ErrResolutionNotFound = errors.New("council resolution not found")
