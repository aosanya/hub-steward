package mwanachamainsights

import "errors"

// ErrInsightNotFound is returned when an Insight does not exist for the
// given insightID.
var ErrInsightNotFound = errors.New("insight not found")

// ErrInvalidInsight is returned when an Insight is missing required
// fields.
var ErrInvalidInsight = errors.New("invalid insight: missing required fields")

// ErrInvalidInsightNote is returned when an InsightNote is missing
// required fields.
var ErrInvalidInsightNote = errors.New("invalid insight note: missing required fields")
