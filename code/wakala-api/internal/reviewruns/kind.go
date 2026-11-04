package reviewruns

import "strings"

const farmersKindWord = "farm"

const objectivesNotApplicable = "Objectives are reviewed only for the farmers' agency."

func FarmersAgency(kind string) bool {
	return strings.Contains(strings.ToLower(kind), farmersKindWord)
}

func farmersOnly(area string) bool {
	return area == AreaObjectives
}

func AreaApplies(kind, area string) bool {
	return !farmersOnly(area) || FarmersAgency(kind)
}

func AreasFor(kind string) []string {
	var areas []string
	for _, a := range Areas() {
		if AreaApplies(kind, a) {
			areas = append(areas, a)
		}
	}
	return areas
}
