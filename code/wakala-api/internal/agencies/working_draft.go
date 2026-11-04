package agencies

import "wakalaserver/modules/agency/models"

func WorkingDraft(drafts []models.Draft) (models.Draft, bool) {
	var working models.Draft
	found := false
	for _, d := range drafts {
		if !isOpen(d) {
			continue
		}
		if !found || newerDraft(d, working) {
			working, found = d, true
		}
	}
	return working, found
}

func isOpen(d models.Draft) bool {
	return d.Status == models.DraftStatusOpen && !d.Deleted
}

func newerDraft(a, b models.Draft) bool {
	if a.CreatedAt != b.CreatedAt {
		return a.CreatedAt > b.CreatedAt
	}
	return a.ID > b.ID
}
