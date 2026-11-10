package models

type AssistantUsage struct {
	DayTokens   int    `json:"day_tokens"`
	MonthTokens int    `json:"month_tokens"`
	DayLimit    int    `json:"day_limit"`
	MonthLimit  int    `json:"month_limit"`
	Reached     string `json:"reached"`
}
