package models

import "time"

// TimeLayout is the fixed-width, nanosecond-precision RFC 3339 layout every
// timestamp field on a model in this package is written and read with.
//
// Plain time.RFC3339 (second precision) is not enough to keep creation
// order stable for rows created microseconds apart, and time.RFC3339Nano
// trims trailing fractional zeros, which breaks lexicographic sort order
// across timestamps with different digit counts. A fixed nine-digit
// fractional part keeps every stored timestamp both parseable and
// lexicographically sortable in chronological order.
const TimeLayout = "2006-01-02T15:04:05.000000000Z07:00"

// NowRFC3339 returns the current UTC time formatted per [TimeLayout].
func NowRFC3339() string {
	return time.Now().UTC().Format(TimeLayout)
}
