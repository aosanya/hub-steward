package models

import (
	"strings"

	"wakalaserver/modules/shared/spec"
)

// DocFilter keeps only the Entries whose document holds Value at Path.
type DocFilter struct {
	// Path is a dotted path inside Doc, e.g. "_template.sector".
	Path string `json:"path"`

	// Value is what that path must equal.
	Value string `json:"value"`
}

// Valid reports whether f is safe to put in a query.
//
// The shape is [spec.DocPathPattern] rather than a second copy of it. A path
// reaches the database as SQL text, not as a bound parameter — neither
// Postgres's `#>> '{a,b}'` nor SQLite's `json_extract(doc, '$.a.b')` takes a
// placeholder there — so the alphabet that makes that safe has to be one
// alphabet. Two copies of it are two things that can drift, and the one
// that drifts looser is the one nobody notices.
func (f DocFilter) Valid() bool { return spec.DocPathPattern.MatchString(f.Path) }

// Segments splits Path into its parts.
func (f DocFilter) Segments() []string { return strings.Split(f.Path, ".") }
