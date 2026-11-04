package http

import (
	"fmt"
	"strconv"
	"strings"

	formsmodels "wakalaserver/modules/forms/models"
)

func answerLines(questions []formsmodels.Question, optionLabels map[string]string, stored []formsmodels.Answer) string {
	given := make(map[string]formsmodels.Answer, len(stored))
	for _, a := range stored {
		given[a.QuestionID] = a
	}
	var lines []string
	for _, q := range questions {
		a, ok := given[q.ID]
		if !ok {
			continue
		}
		if text := answerText(q, a, optionLabels); text != "" {
			lines = append(lines, q.Prompt+": "+text)
		}
	}
	return strings.Join(lines, "\n")
}

func answerText(q formsmodels.Question, a formsmodels.Answer, optionLabels map[string]string) string {
	switch q.AnswerType {
	case formsmodels.AnswerYesNo:
		return yesNoText(q, a)
	case formsmodels.AnswerSingleChoice, formsmodels.AnswerMultiSelect:
		return chosenLabels(a.OptionIDs, optionLabels)
	case formsmodels.AnswerDate:
		return a.ValueDate
	case formsmodels.AnswerTime:
		return a.ValueTime
	case formsmodels.AnswerNumber:
		return measuredText(q, a)
	case formsmodels.AnswerCurrency:
		return strings.TrimSpace(q.CurrencyCode + " " + numberText(a))
	case formsmodels.AnswerPhoto, formsmodels.AnswerFile:
		return fileCountText(a)
	}
	return strings.TrimSpace(a.ValueText)
}

func yesNoText(q formsmodels.Question, a formsmodels.Answer) string {
	switch {
	case a.ValueBool == nil:
		return ""
	case *a.ValueBool && q.YesLabel != "":
		return q.YesLabel
	case *a.ValueBool:
		return "Yes"
	case q.NoLabel != "":
		return q.NoLabel
	}
	return "No"
}

func chosenLabels(optionIDs []string, optionLabels map[string]string) string {
	labels := make([]string, 0, len(optionIDs))
	for _, id := range optionIDs {
		if label := optionLabels[id]; label != "" {
			labels = append(labels, label)
		}
	}
	return strings.Join(labels, ", ")
}

func measuredText(q formsmodels.Question, a formsmodels.Answer) string {
	return strings.TrimSpace(numberText(a) + " " + q.UnitLabel)
}

func numberText(a formsmodels.Answer) string {
	if a.ValueNumber == nil {
		return ""
	}
	return strconv.FormatFloat(*a.ValueNumber, 'f', -1, 64)
}

func fileCountText(a formsmodels.Answer) string {
	if len(a.FileIDs) == 0 {
		return ""
	}
	return fmt.Sprintf("%d attached", len(a.FileIDs))
}
