package models

type Removal struct {
	ID           string `json:"id"`
	RaisedItemID string `json:"raised_item_id"`
	Ground       string `json:"ground"`
	RemovedBy    string `json:"removed_by"`
	CreatedAt    string `json:"created_at"`
}
