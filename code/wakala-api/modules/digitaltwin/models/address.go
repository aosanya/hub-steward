package models

type Address struct {
	ID        string `json:"id"`
	Street    string `json:"street"`
	Number    string `json:"number"`
	Area      string `json:"area,omitempty"`
	Postcode  string `json:"postcode,omitempty"`
	PlaceID   string `json:"place_id,omitempty"`
	CreatedAt string `json:"created_at"`
}

type AddressFilter struct {
	Street  string `json:"street" query:"street"`
	Area    string `json:"area" query:"area"`
	PlaceID string `json:"place_id" query:"place_id"`
	Limit   int    `json:"limit" query:"limit"`
}
