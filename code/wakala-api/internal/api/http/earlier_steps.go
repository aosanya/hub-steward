package http

import (
	"slices"
	"strings"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const changedAnswerPrefix = "Changed: "

type earlierAnswer struct {
	Prompt string `json:"prompt"`
	Answer string `json:"answer"`
}

type earlierStep struct {
	StepTitle string          `json:"step_title"`
	RoleName  string          `json:"role_name"`
	Answers   []earlierAnswer `json:"answers"`
}

func earlierStepsOf(chain []formStep, run stepRun, index int, roles []agencymodels.Role) []earlierStep {
	roleNames := make(map[string]string, len(roles))
	for _, r := range roles {
		roleNames[r.ID] = r.Name
	}
	var out []earlierStep
	for i := 0; i < index && i < len(chain) && i < len(run.done); i++ {
		if !run.done[i] {
			continue
		}
		var answers []earlierAnswer
		for _, q := range chain[i].record.Questions {
			if text := answerOf(run.answers[i], q); text != "" {
				answers = append(answers, earlierAnswer{Prompt: q.Prompt, Answer: text})
			}
		}
		answers = append(answers, changedAnswersOf(run.answers[i])...)
		for _, prompt := range []string{stampedByPrompt, stampedAtPrompt} {
			if text := run.answers[i][prompt]; text != "" {
				answers = append(answers, earlierAnswer{Prompt: prompt, Answer: text})
			}
		}
		if len(answers) == 0 {
			continue
		}
		out = append(out, earlierStep{StepTitle: chain[i].step.Title, RoleName: roleNames[chain[i].record.RoleID], Answers: answers})
	}
	return out
}

func changedAnswersOf(answers map[string]string) []earlierAnswer {
	var prompts []string
	for prompt, text := range answers {
		if strings.HasPrefix(prompt, changedAnswerPrefix) && text != "" {
			prompts = append(prompts, prompt)
		}
	}
	slices.Sort(prompts)
	out := make([]earlierAnswer, 0, len(prompts))
	for _, prompt := range prompts {
		out = append(out, earlierAnswer{Prompt: prompt, Answer: answers[prompt]})
	}
	return out
}
