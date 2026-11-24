package http

import agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

func fieldIdentity(q agencymodels.StepQuestion) string {
	if q.Key != "" {
		return q.Key
	}
	return q.Prompt
}

func answerOf(answers map[string]string, q agencymodels.StepQuestion) string {
	if q.Key != "" {
		if text, stored := answers[q.Key]; stored {
			return text
		}
	}
	return answers[q.Prompt]
}

func givenAnswerOf(answers map[string]string, q agencymodels.StepQuestion) string {
	if q.Key != "" {
		if text, given := answers[q.Key]; given {
			return text
		}
	}
	if q.Code != "" {
		if text, given := answers[q.Code]; given {
			return text
		}
	}
	return answers[q.Prompt]
}

func questionNamed(questions []agencymodels.StepQuestion, name string) (agencymodels.StepQuestion, bool) {
	for _, q := range questions {
		if q.Key != "" && q.Key == name {
			return q, true
		}
	}
	for _, q := range questions {
		if q.Code != "" && q.Code == name {
			return q, true
		}
	}
	for _, q := range questions {
		if q.Prompt == name {
			return q, true
		}
	}
	return agencymodels.StepQuestion{}, false
}

func answerNamed(questions []agencymodels.StepQuestion, answers map[string]string, name string) string {
	if q, found := questionNamed(questions, name); found {
		return answerOf(answers, q)
	}
	return answers[name]
}
