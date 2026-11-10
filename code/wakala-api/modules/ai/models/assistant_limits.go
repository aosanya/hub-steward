package models

type AssistantLimits struct {
	ID                   string `json:"id"`
	AgencyID             string `json:"agency_id"`
	TokensPerPersonDay   int    `json:"tokens_per_person_day"`
	TokensPerPersonMonth int    `json:"tokens_per_person_month"`

	OwnerTokensPerPersonDay   int    `json:"owner_tokens_per_person_day"`
	OwnerTokensPerPersonMonth int    `json:"owner_tokens_per_person_month"`
	UpdatedAt                 string `json:"updated_at"`
}
