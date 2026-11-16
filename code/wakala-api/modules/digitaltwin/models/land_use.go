package models

type LandUse struct {
	ID        string `json:"id"`
	PlaceID   string `json:"place_id,omitempty"`
	Area      string `json:"area,omitempty"`
	Zone      string `json:"zone"`
	Use       string `json:"use"`
	CreatedAt string `json:"created_at"`
}

type LandUseFilter struct {
	PlaceID string `json:"place_id" query:"place_id"`
	Area    string `json:"area" query:"area"`
	Zone    string `json:"zone" query:"zone"`
	Limit   int    `json:"limit" query:"limit"`
}
