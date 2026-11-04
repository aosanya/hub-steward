package models

type Reply struct {
	ID           string `json:"id"`
	RaisedItemID string `json:"raised_item_id"`
	Body         string `json:"body"`
	RepliedBy    string `json:"replied_by"`
	CreatedAt    string `json:"created_at"`
}
