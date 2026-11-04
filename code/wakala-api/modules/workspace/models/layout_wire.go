package models

import "encoding/json"

type LayoutFilter struct {
	Owner string      `json:"owner,omitempty"`
	State LayoutState `json:"state,omitempty"`
	Form  LayoutForm  `json:"form,omitempty"`
	Limit int         `json:"limit,omitempty"`
}

type LayoutChangeFilter struct {
	Limit int `json:"limit,omitempty"`
}

type ResolvedLayout struct {
	Layout   Layout          `json:"layout"`
	Body     json.RawMessage `json:"body"`
	Locks    []string        `json:"locks"`
	SetAside []string        `json:"set_aside"`
	Base     *Layout         `json:"base,omitempty"`
	Stale    bool            `json:"stale,omitempty"`
}

type LayoutLine struct {
	Path   string          `json:"path"`
	From   json.RawMessage `json:"from,omitempty"`
	To     json.RawMessage `json:"to,omitempty"`
	Held   bool            `json:"held,omitempty"`
	Reason string          `json:"reason,omitempty"`
}

type LayoutProposal struct {
	Patch   json.RawMessage `json:"patch"`
	Via     LayoutVia       `json:"via,omitempty"`
	Subject string          `json:"subject,omitempty"`
}

type LayoutDiff struct {
	LayoutID string          `json:"layout_id"`
	Lines    []LayoutLine    `json:"lines"`
	Patch    json.RawMessage `json:"patch"`
	Body     json.RawMessage `json:"body"`
	SetAside []string        `json:"set_aside,omitempty"`
}

type LayoutApplied struct {
	Layout   Layout          `json:"layout"`
	Change   LayoutChange    `json:"change"`
	Lines    []LayoutLine    `json:"lines"`
	Body     json.RawMessage `json:"body"`
	SetAside []string        `json:"set_aside,omitempty"`
}

type LayoutRevert struct {
	ChangeID string `json:"change_id,omitempty"`
	Path     string `json:"path,omitempty"`
	All      bool   `json:"all,omitempty"`
	Subject  string `json:"subject,omitempty"`
}

type LayoutCopy struct {
	To      string `json:"to,omitempty"`
	Scope   string `json:"scope,omitempty"`
	Title   string `json:"title,omitempty"`
	Offer   bool   `json:"offer,omitempty"`
	Subject string `json:"subject,omitempty"`
}
