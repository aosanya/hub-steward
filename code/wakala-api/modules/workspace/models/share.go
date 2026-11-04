package models

import (
	"crypto/sha256"
	"encoding/hex"
)

type Share struct {
	ID         string      `json:"id"`
	WorkbookID string      `json:"workbook_id"`
	KeyHash    string      `json:"-"`
	Label      string      `json:"label,omitempty"`
	Status     ShareStatus `json:"status"`
	IssuedBy   string      `json:"issued_by,omitempty"`
	IssuedAt   string      `json:"issued_at"`
	RetiredAt  string      `json:"retired_at,omitempty"`
}

func HashKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
