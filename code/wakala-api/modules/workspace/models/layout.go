package models

import "encoding/json"

type LayoutForm string

const (
	LayoutFormWhole LayoutForm = "whole"
	LayoutFormPatch LayoutForm = "patch"
)

type LayoutState string

const (
	LayoutStateDraft     LayoutState = "draft"
	LayoutStatePublished LayoutState = "published"
	LayoutStateRetired   LayoutState = "retired"
)

type LayoutVia string

const (
	LayoutViaDirect LayoutVia = "direct"
	LayoutViaChat   LayoutVia = "chat"
	LayoutViaSketch LayoutVia = "sketch"
	LayoutViaReset  LayoutVia = "reset"
)

type Layout struct {
	ID          string          `json:"id"`
	Scope       string          `json:"scope"`
	Owner       string          `json:"owner"`
	Title       string          `json:"title"`
	Form        LayoutForm      `json:"form"`
	BaseID      string          `json:"base_id,omitempty"`
	BaseVersion int             `json:"base_version,omitempty"`
	State       LayoutState     `json:"state"`
	Version     int             `json:"version"`
	Body        json.RawMessage `json:"body,omitempty"`
	SetAside    json.RawMessage `json:"set_aside,omitempty"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
	Deleted     bool            `json:"deleted"`
}

type LayoutChange struct {
	ID         string          `json:"id"`
	LayoutID   string          `json:"layout_id"`
	Subject    string          `json:"subject,omitempty"`
	Via        LayoutVia       `json:"via"`
	Patch      json.RawMessage `json:"patch,omitempty"`
	Inverse    json.RawMessage `json:"inverse,omitempty"`
	At         string          `json:"at"`
	RevertedAt string          `json:"reverted_at,omitempty"`
}

type LayoutChoice struct {
	WorkbookID string `json:"workbook_id"`
	Subject    string `json:"subject"`
	LayoutID   string `json:"layout_id"`
	ChosenAt   string `json:"chosen_at"`
}
