package models

type WorkbookFilter struct {
	Search string `json:"search,omitempty"`
	Limit  int    `json:"limit,omitempty"`
}

type ReferenceFilter struct {
	Module string `json:"module,omitempty"`
	Item   string `json:"item,omitempty"`
}

type UseFilter struct {
	Action string `json:"action,omitempty"`
	Limit  int    `json:"limit,omitempty"`
}
