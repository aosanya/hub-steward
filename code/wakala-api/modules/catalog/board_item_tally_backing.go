package mwanachamacatalog

import (
	"context"
	"sort"
)

type boardBacking struct {
	raised    []RaisedItem
	endorsers map[string][]string
}

type placing func(personID string) string

func (m *catalogManager) backingOf(ctx context.Context, items []BoardItem) (boardBacking, error) {
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	raised, err := listOf[RaisedItem](m, m.q(ctx, roleRaisedItem).Where("board_item_id IN ? AND publishable = ?", ids, true).Order("created_at, id"), roleRaisedItem)
	if err != nil {
		return boardBacking{}, err
	}
	backing := boardBacking{raised: raised, endorsers: map[string][]string{}}
	if !m.countsEndorsements() {
		return backing, nil
	}
	endorsements, err := listOf[Endorsement](m, m.q(ctx, roleEndorsement).Where("subject_id IN ?", ids), roleEndorsement)
	if err != nil {
		return boardBacking{}, err
	}
	for _, e := range endorsements {
		backing.endorsers[e.SubjectID] = append(backing.endorsers[e.SubjectID], e.HolderID)
	}
	return backing, nil
}

func (b boardBacking) personIDs() []string {
	seen := map[string]bool{}
	for _, r := range b.raised {
		seen[r.RaisedBy] = true
	}
	for _, holders := range b.endorsers {
		for _, h := range holders {
			seen[h] = true
		}
	}
	delete(seen, "")
	ids := make([]string, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func (b boardBacking) placing(known map[string]string) placing {
	stored := map[string]string{}
	for _, r := range b.raised {
		if area := trimmedArea(r.Area); area != "" && stored[r.RaisedBy] == "" {
			stored[r.RaisedBy] = area
		}
	}
	return func(personID string) string {
		if area := trimmedArea(known[personID]); area != "" {
			return area
		}
		return stored[personID]
	}
}

func (b boardBacking) tallyOf(boardItemID string, listed []AreaPopulation, placed placing) []AreaTally {
	book := newAreaBook(listed)
	raisers := map[string]bool{}
	for _, r := range b.raised {
		if r.BoardItemID != boardItemID || r.RaisedBy == "" || raisers[r.RaisedBy] {
			continue
		}
		raisers[r.RaisedBy] = true
		book.row(placed(r.RaisedBy)).RaisedBy++
	}
	counted := map[string]bool{}
	for _, holder := range b.endorsers[boardItemID] {
		if raisers[holder] || counted[holder] {
			continue
		}
		counted[holder] = true
		book.row(placed(holder)).MeToo++
	}
	return book.rows()
}
