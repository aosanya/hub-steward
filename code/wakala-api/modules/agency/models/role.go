package models

import "encoding/json"

type Role struct {
	ID          string   `json:"id"`
	Code        string   `json:"code"`
	DraftID     string   `json:"draft_id,omitempty"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions,omitempty"`
	Staff       bool     `json:"staff"`
	CreatedAt   string   `json:"created_at"`
	LastUpdated string   `json:"last_updated"`
	Deleted     bool     `json:"deleted"`

	carried map[string]bool
}

func (r *Role) UnmarshalJSON(data []byte) error {
	type plain Role
	var decoded plain
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(data, &keys); err != nil {
		return err
	}
	*r = Role(decoded)
	r.carried = make(map[string]bool, len(keys))
	for key := range keys {
		r.carried[key] = true
	}
	return nil
}

func (r Role) Carries(field string) bool {
	return r.carried == nil || r.carried[field]
}

func (r Role) FromRequest() bool {
	return r.carried != nil
}
