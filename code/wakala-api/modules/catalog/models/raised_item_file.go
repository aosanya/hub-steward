package models

type RaisedItemFile struct {
	ID           string `json:"id"`
	RaisedItemID string `json:"raised_item_id"`
	FileID       string `json:"file_id"`
	AttachedBy   string `json:"attached_by"`
	AttachedAt   string `json:"attached_at"`
	ApprovedBy   string `json:"approved_by"`
	ApprovedAt   string `json:"approved_at"`
}

func (f RaisedItemFile) ApprovedForPublishing() bool {
	return f.ApprovedAt != ""
}
