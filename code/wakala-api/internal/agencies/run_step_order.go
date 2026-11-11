package agencies

import (
	"slices"

	agencymodels "wakalaserver/modules/agency/models"
)

func followsInOrder(steps []agencymodels.DocumentWorkItem, current, at int) bool {
	if current < 0 {
		return at == 0
	}
	if at == current+1 && !startsAnotherBranch(steps, current, at) {
		return true
	}
	if steps[current].Kind == agencymodels.StepKindRoute && slices.Contains(branchIndexes(steps, current), at) {
		return true
	}
	return at == firstStepAfterBranches(steps, current)
}

func branchIDsOfRoute(route agencymodels.DocumentWorkItem) []string {
	ids := make([]string, 0, len(route.Routes)+1)
	for _, r := range route.Routes {
		ids = append(ids, r.GoToStep)
	}
	if route.OtherwiseStepID != "" {
		ids = append(ids, route.OtherwiseStepID)
	}
	return ids
}

func branchIndexes(steps []agencymodels.DocumentWorkItem, routeAt int) []int {
	ids := branchIDsOfRoute(steps[routeAt])
	var found []int
	for i := routeAt + 1; i < len(steps); i++ {
		if slices.Contains(ids, steps[i].ID) {
			found = append(found, i)
		}
	}
	return found
}

func routesChoosing(steps []agencymodels.DocumentWorkItem, branchAt int) []int {
	var routes []int
	for i := 0; i < branchAt; i++ {
		if steps[i].Kind == agencymodels.StepKindRoute && slices.Contains(branchIndexes(steps, i), branchAt) {
			routes = append(routes, i)
		}
	}
	return routes
}

func startsAnotherBranch(steps []agencymodels.DocumentWorkItem, current, at int) bool {
	for _, route := range routesChoosing(steps, current) {
		if slices.Contains(branchIndexes(steps, route), at) {
			return true
		}
	}
	return false
}

func firstStepAfterBranches(steps []agencymodels.DocumentWorkItem, current int) int {
	after := -1
	for _, route := range routesChoosing(steps, current) {
		branches := branchIndexes(steps, route)
		after = max(after, branches[len(branches)-1]+1)
	}
	return after
}
