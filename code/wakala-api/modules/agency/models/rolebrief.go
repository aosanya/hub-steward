package models

type RoleBrief struct {
	PublicationVersion int              `json:"publication_version"`
	PublicationTag     string           `json:"publication_tag"`
	RoleID             string           `json:"role_id"`
	RoleCode           string           `json:"role_code"`
	Name               string           `json:"name"`
	Description        string           `json:"description"`
	Objectives         []BriefObjective `json:"objectives"`
	Controls           []BriefStatement `json:"controls"`
	WorkItems          []BriefWorkItem  `json:"work_items"`
	Text               string           `json:"text"`
}

type BriefObjective struct {
	Code            string `json:"code"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	Label           string `json:"label"`
	GoalCode        string `json:"goal_code"`
	GoalTitle       string `json:"goal_title"`
	GoalDescription string `json:"goal_description"`
}

type BriefStatement struct {
	Code  string `json:"code"`
	Text  string `json:"text"`
	Scope string `json:"scope"`
}

type BriefWorkItem struct {
	Code          string   `json:"code"`
	Title         string   `json:"title"`
	ObjectiveCode string   `json:"objective_code"`
	Labels        []string `json:"labels"`
	Prompt        string   `json:"prompt"`
}
