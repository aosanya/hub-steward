package http

import (
	"strconv"
	"strings"

	agencymodels "wakalaserver/modules/agency/models"
)

func stepActorRoleID(s agencymodels.WorkItem) string {
	if s.Kind == agencymodels.StepKindSendForm {
		return s.RecipientRoleID
	}
	return s.RoleID
}

func stepTakesAnswers(s agencymodels.WorkItem) bool {
	return s.Kind == agencymodels.StepKindFillForm || s.Kind == agencymodels.StepKindSendForm
}

func routesTo(steps []agencymodels.WorkItem) map[string][]agencymodels.WorkItem {
	out := map[string][]agencymodels.WorkItem{}
	for _, s := range steps {
		if s.Deleted || s.Kind != agencymodels.StepKindRoute || s.SentStepID == "" {
			continue
		}
		for _, r := range s.Routes {
			out[r.GoToStep] = append(out[r.GoToStep], s)
		}
	}
	return out
}

func chosenByRoute(route agencymodels.WorkItem, answers map[string]string) string {
	for _, r := range route.Routes {
		if routeMatches(r, answers) {
			return r.GoToStep
		}
	}
	return ""
}

func routeMatches(r agencymodels.StepRoute, answers map[string]string) bool {
	if len(r.Rules) == 0 {
		return false
	}
	for _, rule := range r.Rules {
		held := ruleHolds(rule, answers[rule.Question])
		if r.Match == agencymodels.RouteMatchAny && held {
			return true
		}
		if r.Match != agencymodels.RouteMatchAny && !held {
			return false
		}
	}
	return r.Match != agencymodels.RouteMatchAny
}

func ruleHolds(rule agencymodels.RouteRule, answer string) bool {
	got, want := strings.ToLower(strings.TrimSpace(answer)), strings.ToLower(strings.TrimSpace(rule.Value))
	switch rule.Operator {
	case agencymodels.RouteIs:
		return got == want
	case agencymodels.RouteIsNot:
		return got != want
	case agencymodels.RouteContains:
		return strings.Contains(got, want)
	}
	left, errLeft := strconv.ParseFloat(got, 64)
	right, errRight := strconv.ParseFloat(want, 64)
	if errLeft != nil || errRight != nil {
		return false
	}
	if rule.Operator == agencymodels.RouteMoreThan {
		return left > right
	}
	return left < right
}

func (r *stepRun) settle(chain []formStep) {
	r.skipped = make([]bool, len(chain))
	at := map[string]int{}
	for i, link := range chain {
		at[link.step.ID] = i
	}
	for i, link := range chain {
		for _, route := range link.routedBy {
			sent, ok := at[route.SentStepID]
			if !ok || !r.done[sent] {
				continue
			}
			if chosenByRoute(route, r.answers[sent]) != link.step.ID {
				r.skipped[i] = true
			}
		}
	}
}
