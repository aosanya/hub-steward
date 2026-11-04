package models

type PageView struct {
	Page  PageKind `json:"page"`
	Slug  string   `json:"slug,omitempty"`
	Views int64    `json:"views"`
}

func (v PageView) SlugFitsPage() bool {
	if v.Page == PageKindIndex {
		return v.Slug == ""
	}
	return v.Slug != ""
}
