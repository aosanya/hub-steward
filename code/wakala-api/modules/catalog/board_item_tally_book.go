package mwanachamacatalog

import "strings"

type areaBook struct {
	listed   []AreaTally
	extra    []AreaTally
	position map[string]int
	unplaced AreaTally
}

func newAreaBook(listed []AreaPopulation) *areaBook {
	book := &areaBook{position: map[string]int{}}
	for _, a := range listed {
		population := a.Population
		book.position[strings.ToLower(trimmedArea(a.Area))] = len(book.listed)
		book.listed = append(book.listed, AreaTally{Area: a.Area, Population: &population})
	}
	return book
}

func (b *areaBook) row(area string) *AreaTally {
	if area == "" {
		return &b.unplaced
	}
	key := strings.ToLower(area)
	if i, ok := b.position[key]; ok {
		return b.at(i)
	}
	b.extra = append(b.extra, AreaTally{Area: area})
	b.position[key] = len(b.listed) + len(b.extra) - 1
	return &b.extra[len(b.extra)-1]
}

func (b *areaBook) at(i int) *AreaTally {
	if i < len(b.listed) {
		return &b.listed[i]
	}
	return &b.extra[i-len(b.listed)]
}

func (b *areaBook) rows() []AreaTally {
	out := append(append([]AreaTally{}, b.listed...), b.extra...)
	if b.unplaced.RaisedBy != 0 || b.unplaced.MeToo != 0 {
		out = append(out, b.unplaced)
	}
	return out
}
