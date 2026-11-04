package models

import (
	"crypto/sha256"
	"encoding/hex"
)

type ShareLink struct {
	ID        string     `json:"id"`
	Slug      string     `json:"slug"`
	KeyHash   string     `json:"-"`
	Label     string     `json:"label,omitempty"`
	Status    LinkStatus `json:"status"`
	CreatedBy string     `json:"created_by,omitempty"`
	CreatedAt string     `json:"created_at"`
	RetiredAt string     `json:"retired_at,omitempty"`
}

func HashKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
