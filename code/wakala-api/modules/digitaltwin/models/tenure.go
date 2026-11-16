package models

type Tenure struct {
	ID        string `json:"id"`
	PlaceID   string `json:"place_id"`
	Holder    string `json:"holder"`
	Kind      string `json:"kind"`
	Since     string `json:"since,omitempty"`
	CreatedAt string `json:"created_at"`
}

type TenureFilter struct {
	PlaceID string `json:"place_id" query:"place_id"`
	Holder  string `json:"holder" query:"holder"`
	Kind    string `json:"kind" query:"kind"`
	Limit   int    `json:"limit" query:"limit"`
}
