package models

type Tenure struct {
	ID                string `json:"id"`
	PlaceID           string `json:"place_id"`
	Holder            string `json:"holder"`
	HolderActorID     string `json:"holder_actor_id,omitempty"`
	HolderRecordRowID string `json:"holder_record_row_id,omitempty"`
	Kind              string `json:"kind"`
	Since             string `json:"since,omitempty"`
	CreatedAt         string `json:"created_at"`
}

type TenureFilter struct {
	PlaceID            string   `json:"place_id" query:"place_id"`
	Holder             string   `json:"holder" query:"holder"`
	HolderActorID      string   `json:"holder_actor_id" query:"holder_actor_id"`
	HolderRecordRowID  string   `json:"holder_record_row_id" query:"holder_record_row_id"`
	HolderRecordRowIDs []string `json:"-" query:"-"`
	Kind               string   `json:"kind" query:"kind"`
	Limit              int      `json:"limit" query:"limit"`
}
